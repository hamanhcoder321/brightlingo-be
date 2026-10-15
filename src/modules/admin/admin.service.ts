import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/core/database';

@Injectable()
export class AdminService {
  constructor(private readonly db: DatabaseService) {}

  // Lấy các chỉ số KPI tổng quan cho CMS Dashboard theo Mục 12.1 BA
  async getDashboardSummary() {
    // 1. Số khóa học đang Published
    const coursesRes = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM courses WHERE status = 'PUBLISHED' AND deleted_at IS NULL`,
    );

    // 2. Thống kê đơn hàng Paid: Tổng đơn, tổng doanh thu, số khách unique
    const ordersRes = await this.db.query(
      `SELECT 
        COUNT(*)::int AS total_paid_orders,
        COALESCE(SUM(total_amount), 0)::bigint AS total_revenue,
        COUNT(DISTINCT customer_email)::int AS unique_customers
       FROM orders 
       WHERE status = 'PAID'`,
    );

    // 3. Đơn hàng gần đây
    const recentOrders = await this.db.query(
      `SELECT id, order_code, customer_name, customer_email, course_title, total_amount, status, ref, utm_source, created_at 
       FROM orders 
       ORDER BY created_at DESC 
       LIMIT 10`,
    );

    return {
      kpi: {
        publishedCourses: coursesRes.rows[0].count,
        paidOrders: ordersRes.rows[0].total_paid_orders,
        uniqueBuyers: ordersRes.rows[0].unique_customers,
        totalRevenue: ordersRes.rows[0].total_revenue,
      },
      recentOrders: recentOrders.rows,
    };
  }
}
