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
      [dto.courseId, dto.courseSlug],
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
}
