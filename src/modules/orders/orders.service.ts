import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '@/core/database';
import { PaymentsService } from '@/modules/payments';
import { SecurityUtil } from '@/common/security/security.util';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly paymentsService: PaymentsService,
  ) {}

  // Tạo đơn hàng mới ở trạng thái PENDING + Sinh link thanh toán VietQR qua PayOS
  async create(dto: CreateOrderDto) {
    // 1. Lấy thông tin khóa học để snapshot giá bán thực tế từ DB
    const courseRes = await this.db.query(
      `SELECT id, slug, title, price, original_price 
       FROM courses 
       WHERE (id = $1 OR slug = $2) AND status = 'PUBLISHED' AND deleted_at IS NULL`,
      [dto.courseId || null, dto.courseSlug || null],
    );

    if (courseRes.rows.length === 0) {
      throw new NotFoundException('Khóa học không tồn tại hoặc đã ngừng bán');
    }

    const course = courseRes.rows[0];
    const originalPrice = course.original_price;
    let unitPrice = course.price;
    let discountAmount = 0;
    let couponId = null;
    let couponCode = null;

    // 2. Validate Coupon nếu có (Server-side validation theo BR-07)
    if (dto.couponCode) {
      const cleanCode = dto.couponCode.trim().toUpperCase();
      const couponRes = await this.db.query(
        `SELECT id, code, type, value, min_order_amount, max_discount_amount, usage_limit, usage_count 
         FROM coupons 
         WHERE code = $1 AND status = 'ACTIVE' AND deleted_at IS NULL
           AND (start_date IS NULL OR start_date <= NOW())
           AND (end_date IS NULL OR end_date >= NOW())`,
        [cleanCode],
      );

      if (couponRes.rows.length > 0) {
        const coupon = couponRes.rows[0];
        if (!coupon.usage_limit || coupon.usage_count < coupon.usage_limit) {
          if (unitPrice >= (coupon.min_order_amount || 0)) {
            couponId = coupon.id;
            couponCode = coupon.code;
            if (coupon.type === 'PERCENT') {
              discountAmount = Math.round((unitPrice * coupon.value) / 100);
              if (coupon.max_discount_amount && discountAmount > coupon.max_discount_amount) {
                discountAmount = coupon.max_discount_amount;
              }
            } else {
              discountAmount = coupon.value;
            }
          }
        }
      }
    }

    const totalAmount = Math.max(0, unitPrice - discountAmount);
    const orderId = 'ord_' + Date.now();
    // Sinh số mã đơn nguyên dương duy nhất tương thích 100% với PayOS
    const numericOrderCode = Math.floor(Date.now() / 1000);
    const orderCodeStr = String(numericOrderCode);

    const cleanCustomerName = SecurityUtil.sanitizeText(dto.customerName);
    const cleanCustomerEmail = SecurityUtil.sanitizeText(dto.customerEmail).toLowerCase().trim();
    const cleanCustomerPhone = dto.customerPhone ? SecurityUtil.sanitizeText(dto.customerPhone) : null;
    const cleanLandingUrl = dto.landingUrl ? SecurityUtil.sanitizeUrl(dto.landingUrl, 'Landing URL') : null;
    const cleanReferrerUrl = dto.referrerUrl ? SecurityUtil.sanitizeUrl(dto.referrerUrl, 'Referrer URL') : null;

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
        course.id, course.title, course.slug, originalPrice, unitPrice,
        discountAmount, totalAmount, couponId, couponCode,
        dto.ref ? SecurityUtil.sanitizeText(dto.ref) : null,
        dto.utmSource ? SecurityUtil.sanitizeText(dto.utmSource) : null,
        dto.utmMedium ? SecurityUtil.sanitizeText(dto.utmMedium) : null,
        dto.utmCampaign ? SecurityUtil.sanitizeText(dto.utmCampaign) : null,
        dto.utmContent ? SecurityUtil.sanitizeText(dto.utmContent) : null,
        dto.utmTerm ? SecurityUtil.sanitizeText(dto.utmTerm) : null,
        cleanLandingUrl, cleanReferrerUrl,
      ],
    );

    // 4. Gọi PaymentsService để tạo Link thanh toán & VietQR chính thức qua PayOS
    const paymentInfo = await this.paymentsService.createPaymentLink({
      orderCode: numericOrderCode,
      amount: totalAmount,
      description: `BL ${orderCodeStr}`,
      items: [
        {
          name: course.title.slice(0, 50),
          quantity: 1,
          price: totalAmount,
        },
      ],
    });

    this.logger.log(`Created Pending Order #${orderCodeStr} (ID: ${orderId}) for ${dto.customerEmail}`);

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

  // Polling kiểm tra trạng thái thanh toán từ Frontend
  async getStatus(orderIdOrCode: string) {
    const res = await this.db.query(
      `SELECT id, order_code, status, total_amount, paid_at, customer_email, customer_name 
       FROM orders 
       WHERE id = $1 OR order_code = $1 OR order_code = $2`,
      [orderIdOrCode, orderIdOrCode.replace(/^BL-/, '')],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy đơn hàng: ${orderIdOrCode}`);
    }

    const row = res.rows[0];
    return {
      orderId: row.id,
      orderCode: row.order_code,
      status: row.status,
      amount: row.total_amount,
      paidAt: row.paid_at,
      customerEmail: row.customer_email,
      customerName: row.customer_name,
      message:
        row.status === 'PAID'
          ? 'Giao dịch thanh toán thành công!'
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
            : r.status === 'CANCELLED'
              ? 'Cancelled'
              : r.status,
    };
  }
}
