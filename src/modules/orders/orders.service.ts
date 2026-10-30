import { Injectable, NotFoundException, BadRequestException, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { DatabaseService } from '@/core/database';
import { PaymentsService } from '@/modules/payments';
import { SecurityUtil } from '@/common/security/security.util';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private expireInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly db: DatabaseService,
    private readonly paymentsService: PaymentsService,
  ) {}

  onModuleInit() {
    // Quét dọn các đơn hàng PENDING cũ quá 15 phút ngay khi khởi động
    this.expirePendingOrders();
    // Chạy định kỳ mỗi 60 giây để tự động chuyển đơn quá 15 phút sang EXPIRED
    this.expireInterval = setInterval(() => {
      this.expirePendingOrders();
    }, 60 * 1000);
  }

  onModuleDestroy() {
    if (this.expireInterval) {
      clearInterval(this.expireInterval);
    }
  }

  // Tự động quét và chuyển trạng thái EXPIRED cho các đơn chờ quá 15 phút (BR-08)
  async expirePendingOrders(): Promise<number> {
    try {
      const result = await this.db.query(
        `UPDATE orders 
         SET status = 'EXPIRED', updated_at = NOW() 
         WHERE status = 'PENDING' 
           AND created_at < NOW() - INTERVAL '15 minutes'
         RETURNING id, order_code`,
      );
      if (result.rows.length > 0) {
        this.logger.log(
          `⏰ Đã tự động chuyển ${result.rows.length} đơn hàng PENDING quá hạn sang EXPIRED: ${result.rows.map((r: any) => '#' + r.order_code).join(', ')}`,
        );
      }
      return result.rows.length;
    } catch (err: any) {
      this.logger.error('Lỗi khi tự động quét đơn hàng hết hạn:', err?.message || err);
      return 0;
    }
  }

  // Tạo đơn hàng mới ở trạng thái PENDING + Sinh link thanh toán VietQR qua PayOS
  async create(createOrderDto: CreateOrderDto) {
    // 1. Lấy thông tin khóa học để snapshot giá bán thực tế từ DB
    const courseQueryResult = await this.db.query(
      `SELECT id, slug, title, price, original_price 
       FROM courses 
       WHERE (id = $1 OR slug = $2) AND status = 'PUBLISHED' AND deleted_at IS NULL`,
      [createOrderDto.courseId || null, createOrderDto.courseSlug || null],
    );

    if (courseQueryResult.rows.length === 0) {
      throw new NotFoundException('Khóa học không tồn tại hoặc đã ngừng bán');
    }

    const targetCourse = courseQueryResult.rows[0];
    const originalPrice = targetCourse.original_price;
    let unitPrice = targetCourse.price;
    let discountAmount = 0;
    let couponId = null;
    let couponCode = null;

    // 2. Validate Coupon nếu có (Server-side validation theo BR-07)
    if (createOrderDto.couponCode) {
      const normalizedCouponCode = createOrderDto.couponCode.trim().toUpperCase();
      const couponQueryResult = await this.db.query(
        `SELECT id, code, type, value, min_order_amount, max_discount_amount, usage_limit, usage_count, scope 
         FROM coupons 
         WHERE code = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
           AND (start_date IS NULL OR start_date <= NOW())
           AND (end_date IS NULL OR end_date >= NOW())`,
        [normalizedCouponCode],
      );

      if (couponQueryResult.rows.length > 0) {
        const foundCoupon = couponQueryResult.rows[0];

        // Kiểm tra phạm vi áp dụng (scope)
        let isScopeValid = true;
        if (foundCoupon.scope === 'SPECIFIC') {
          const courseScopeQueryResult = await this.db.query(
            `SELECT id FROM coupon_courses WHERE coupon_id = $1 AND course_id = $2`,
            [foundCoupon.id, targetCourse.id],
          );
          if (courseScopeQueryResult.rows.length === 0) {
            isScopeValid = false;
          }
        }

        if (isScopeValid && (!foundCoupon.usage_limit || foundCoupon.usage_count < foundCoupon.usage_limit)) {
          if (unitPrice >= (foundCoupon.min_order_amount || 0)) {
            couponId = foundCoupon.id;
            couponCode = foundCoupon.code;
            if (foundCoupon.type === 'PERCENT') {
              discountAmount = Math.round((unitPrice * foundCoupon.value) / 100);
              if (foundCoupon.max_discount_amount && discountAmount > foundCoupon.max_discount_amount) {
                discountAmount = foundCoupon.max_discount_amount;
              }
            } else {
              discountAmount = foundCoupon.value;
            }
          }
        }
      }
    }

    const totalAmount = unitPrice - discountAmount;
    if (totalAmount < 10000) {
      throw new BadRequestException('Số tiền thanh toán đơn hàng sau giảm giá tối thiểu phải từ 10.000đ.');
    }
    const orderId = 'ord_' + Date.now();
    // Sinh số mã đơn nguyên dương duy nhất tương thích 100% với PayOS
    const numericOrderCode = 100000 + (Math.floor(Date.now() / 1000) % 900000);
    const orderCodeStr = `EN-${numericOrderCode}`;

    const cleanCustomerName = SecurityUtil.sanitizeText(createOrderDto.customerName);
    const cleanCustomerEmail = SecurityUtil.sanitizeText(createOrderDto.customerEmail).toLowerCase().trim();
    const cleanCustomerPhone = createOrderDto.customerPhone ? SecurityUtil.sanitizeText(createOrderDto.customerPhone) : null;
    const cleanLandingUrl = createOrderDto.landingUrl ? SecurityUtil.sanitizeUrl(createOrderDto.landingUrl, 'Landing URL') : null;
    const cleanReferrerUrl = createOrderDto.referrerUrl ? SecurityUtil.sanitizeUrl(createOrderDto.referrerUrl, 'Referrer URL') : null;

    const isIgnoredAttributionHost = (val?: string | null) => {
      if (!val) return false;
      const v = val.toLowerCase().trim();
      return ['vercel.com', 'vercel.app', 'onrender.com', 'render.com', 'localhost', '127.0.0.1'].some((h) => v.includes(h));
    };

    const cleanUtmSource = (createOrderDto.utmSource && !isIgnoredAttributionHost(createOrderDto.utmSource))
      ? SecurityUtil.sanitizeText(createOrderDto.utmSource)
      : null;
    const cleanUtmMedium = (createOrderDto.utmMedium && !isIgnoredAttributionHost(createOrderDto.utmMedium) && !isIgnoredAttributionHost(createOrderDto.utmSource))
      ? SecurityUtil.sanitizeText(createOrderDto.utmMedium)
      : null;

    // 3. Lưu đơn hàng vào Database (Snapshot giá & Attribution theo BR-07, BR-08, BR-09)
    await this.db.query(
      `INSERT INTO orders (
        id, order_code, customer_name, customer_email, customer_phone,
        course_id, course_title, course_slug, original_price, unit_price,
        discount_amount, total_amount, coupon_id, coupon_code, status,
        ref, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
        landing_url, referrer_url
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10,
        $11, $12, $13, $14, 'PENDING',
        $15, $16, $17, $18, $19, $20,
        $21, $22
      )`,
      [
        orderId, orderCodeStr, cleanCustomerName, cleanCustomerEmail, cleanCustomerPhone,
        targetCourse.id, targetCourse.title, targetCourse.slug, originalPrice, unitPrice,
        discountAmount, totalAmount, couponId, couponCode,
        createOrderDto.ref ? SecurityUtil.sanitizeText(createOrderDto.ref) : null,
        cleanUtmSource,
        cleanUtmMedium,
        createOrderDto.utmCampaign ? SecurityUtil.sanitizeText(createOrderDto.utmCampaign) : null,
        createOrderDto.utmContent ? SecurityUtil.sanitizeText(createOrderDto.utmContent) : null,
        createOrderDto.utmTerm ? SecurityUtil.sanitizeText(createOrderDto.utmTerm) : null,
        cleanLandingUrl, cleanReferrerUrl,
      ],
    );

    // 4. Gọi PaymentsService để tạo Link thanh toán & VietQR chính thức qua PayOS
    const paymentInfo = await this.paymentsService.createPaymentLink({
      orderCode: numericOrderCode,
      amount: totalAmount,
      description: orderCodeStr.replace("-", " "),
      items: [
        {
          name: targetCourse.title.slice(0, 50),
          quantity: 1,
          price: totalAmount,
        },
      ],
    });

    this.logger.log(`Created Pending Order #${orderCodeStr} (ID: ${orderId}) for ${createOrderDto.customerEmail}`);

    return {
      orderId,
      orderCode: orderCodeStr,
      amount: totalAmount,
      bankName: paymentInfo.bankName,
      accountName: paymentInfo.accountName,
      accountNumber: paymentInfo.accountNumber,
      qrCodeUrl: paymentInfo.qrCodeUrl,
      checkoutUrl: paymentInfo.checkoutUrl,
      expiresInSeconds: paymentInfo.expiresInSeconds || 600,
      createdAt: new Date().toISOString(),
    };
  }

  // Khách hàng hoặc cổng thanh toán hủy đơn hàng
  async cancel(orderIdOrCode: string, reason = 'Khách hủy thanh toán') {
    const cleanCode = orderIdOrCode.replace(/^(BL|EN)-/, '');
    const orderRes = await this.db.query(
      `SELECT id, order_code, status, total_amount, customer_email, customer_name 
       FROM orders 
       WHERE id = $1 OR order_code = $1 OR order_code = $2 OR order_code = $3`,
      [orderIdOrCode, cleanCode, `EN-${cleanCode}`],
    );

    if (orderRes.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderIdOrCode}`);
    }

    const order = orderRes.rows[0];

    // Không thể hủy đơn đã thanh toán thành công
    if (order.status === 'PAID') {
      throw new BadRequestException('Không thể hủy đơn hàng đã thanh toán thành công.');
    }

    if (order.status === 'CANCELLED') {
      return {
        success: true,
        message: 'Đơn hàng đã ở trạng thái hủy.',
        orderId: order.id,
        orderCode: order.order_code,
        status: 'CANCELLED',
      };
    }

    await this.db.query(
      `UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [order.id],
    );

    // Hủy Payment Link trên cổng PayOS
    try {
      if (this.paymentsService) {
        await this.paymentsService.cancelPaymentLink(order.order_code, reason);
      }
    } catch (err: any) {
      this.logger.warn(`Could not cancel PayOS payment link: ${err?.message || err}`);
    }

    this.logger.log(`🚫 Đơn hàng #${order.order_code} đã chuyển sang CANCELLED (Lý do: ${reason})`);

    return {
      success: true,
      message: 'Đã hủy đơn hàng thành công.',
      orderId: order.id,
      orderCode: order.order_code,
      status: 'CANCELLED',
    };
  }

  // Polling kiểm tra trạng thái thanh toán từ Frontend (Tự động hết hạn sau 15 phút)
  async getStatus(orderIdOrCode: string, verifyEmail?: string) {
    const orderQueryResult = await this.db.query(
      `SELECT id, order_code, course_id, course_slug, status, total_amount, paid_at, customer_email, customer_name, created_at 
       FROM orders 
       WHERE id = $1 OR order_code = $1 OR order_code = $2 OR order_code = $3`,
      [orderIdOrCode, orderIdOrCode.replace(/^(BL|EN)-/, ''), `EN-${orderIdOrCode.replace(/^(BL|EN)-/, '')}`],
    );

    if (orderQueryResult.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderIdOrCode}`);
    }

    const orderRecord = orderQueryResult.rows[0];

    // Kiểm tra nếu đơn vẫn PENDING nhưng đã quá thời hạn 15 phút thì tự động chuyển EXPIRED
    if (orderRecord.status === 'PENDING') {
      const orderCreatedAt = new Date(orderRecord.created_at).getTime();
      const fifteenMinutesMs = 15 * 60 * 1000;
      if (Date.now() - orderCreatedAt > fifteenMinutesMs) {
        await this.db.query(
          `UPDATE orders SET status = 'EXPIRED', updated_at = NOW() WHERE id = $1`,
          [orderRecord.id],
        );
        orderRecord.status = 'EXPIRED';
        this.logger.log(`⏰ Đơn hàng #${orderRecord.order_code} đã hết hạn thời gian thanh toán (EXPIRED).`);
      }
    }

    // Hàm che giấu thông tin Email khách hàng để bảo mật dữ liệu PII (Vá lỗ hổng N-01)
    const maskEmail = (email?: string) => {
      if (!email || !email.includes('@')) return undefined;
      const [local, domain] = email.split('@');
      if (local.length <= 2) return `${local[0] || '*'}***@${domain}`;
      return `${local.slice(0, 2)}***${local.slice(-1)}@${domain}`;
    };

    // Khi đã thanh toán (PAID), tự động lấy link Google Drive tài liệu
    // Bảo mật N-01: Chỉ trả resourceLink khi:
    // 1. Truy vấn bằng orderId bí mật (UUID / ID nội bộ mà hệ thống sinh ra lúc tạo đơn)
    // HOẶC 2. Có email đối chiếu khớp với email người mua
    // Ngăn chặn kẻ xấu đoán mò mã 6 số công khai (EN-xxxxxx) để lấy tài liệu trái phép.
    let resourceLink: string | undefined = undefined;
    if (orderRecord.status === 'PAID') {
      const isQueriedBySecretOrderId = (orderIdOrCode === orderRecord.id);
      const isEmailVerified = Boolean(
        verifyEmail && verifyEmail.toLowerCase().trim() === (orderRecord.customer_email || '').toLowerCase().trim(),
      );

      if (isQueriedBySecretOrderId || isEmailVerified) {
        const courseQueryResult = await this.db.query(
          `SELECT resource_link FROM courses WHERE id = $1 OR slug = $2`,
          [orderRecord.course_id, orderRecord.course_slug],
        );
        if (courseQueryResult.rows.length > 0 && courseQueryResult.rows[0].resource_link) {
          resourceLink = courseQueryResult.rows[0].resource_link;
        }
      }
    }

    return {
      orderId: orderRecord.id,
      orderCode: orderRecord.order_code,
      status: orderRecord.status,
      amount: orderRecord.total_amount,
      paidAt: orderRecord.paid_at,
      customerEmail: maskEmail(orderRecord.customer_email),
      resourceLink,
      // Bỏ customerName khỏi endpoint public để chống dò quét PII người mua
      message:
        orderRecord.status === 'PAID'
          ? 'Giao dịch thanh toán thành công!'
          : orderRecord.status === 'EXPIRED'
            ? 'Mã thanh toán VietQR đã hết hạn (sau 15 phút). Vui lòng tạo đơn hàng mới.'
            : orderRecord.status === 'CANCELLED'
              ? 'Đơn hàng đã bị hủy.'
              : 'Đang chờ xác nhận chuyển khoản từ ngân hàng...',
    };
  }

  // Lấy danh sách toàn bộ đơn hàng cho CMS Admin (Thống kê & Đối soát)
  async findAll(params?: { status?: string; search?: string }) {
    let query = `
      SELECT o.id, o.order_code, o.customer_name, o.customer_email, o.customer_phone,
             o.course_id, o.course_title, o.course_slug, o.original_price, o.unit_price,
             o.discount_amount, o.total_amount as final_amount, o.status, o.ref,
             o.utm_source, o.utm_campaign, o.created_at, o.updated_at, o.paid_at,
             COALESCE(el.resend_count, 0)::int as resend_count
      FROM orders o
      LEFT JOIN (
        SELECT order_id, MAX(resend_count) as resend_count
        FROM email_logs
        GROUP BY order_id
      ) el ON o.id = el.order_id
      WHERE 1=1
    `;
    const queryParams: any[] = [];

    if (params?.status) {
      queryParams.push(params.status.toUpperCase());
      query += ` AND UPPER(o.status) = $${queryParams.length}`;
    }

    if (params?.search) {
      queryParams.push(`%${params.search}%`);
      query += ` AND (o.order_code ILIKE $${queryParams.length} OR o.customer_name ILIKE $${queryParams.length} OR o.customer_email ILIKE $${queryParams.length} OR o.customer_phone ILIKE $${queryParams.length})`;
    }

    query += ` ORDER BY o.created_at DESC`;

    const res = await this.db.query(query, queryParams);
    return {
      items: res.rows.map((r) => ({
        ...r,
        customer_phone: r.customer_phone || '',
        course_price: r.original_price || r.unit_price,
        status:
          r.status === 'PAID'
            ? 'Paid'
            : r.status === 'PENDING'
              ? 'Pending'
              : r.status === 'EXPIRED'
                ? 'Expired'
                : r.status === 'CANCELLED'
                  ? 'Cancelled'
                  : r.status,
      })),
      total: res.rows.length,
    };
  }

  // Chi tiết 1 đơn hàng theo ID cho CMS Admin
  async findOne(id: string) {
    const res = await this.db.query(
      `SELECT o.*, o.total_amount as final_amount,
              COALESCE(el.resend_count, 0)::int as resend_count
       FROM orders o
       LEFT JOIN (
         SELECT order_id, MAX(resend_count) as resend_count
         FROM email_logs
         GROUP BY order_id
       ) el ON o.id = el.order_id
       WHERE o.id = $1 OR o.order_code = $1`,
      [id],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${id}`);
    }

    const r = res.rows[0];
    return {
      ...r,
      customer_phone: r.customer_phone || '',
      course_price: r.original_price || r.unit_price,
      status:
        r.status === 'PAID'
          ? 'Paid'
          : r.status === 'PENDING'
            ? 'Pending'
            : r.status === 'EXPIRED'
              ? 'Expired'
              : r.status === 'CANCELLED'
                ? 'Cancelled'
                : r.status,
    };
  }
}
