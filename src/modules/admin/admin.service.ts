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

    // 2. Thống kê đơn hàng thực tế từ Database: Tổng đơn, đơn Paid, đơn Pending, thu nhập thực tế
    const ordersRes = await this.db.query(
      `SELECT 
        COUNT(*)::int AS total_orders,
        COUNT(*) FILTER (WHERE status = 'PAID')::int AS paid_orders,
        COUNT(*) FILTER (WHERE status = 'PENDING')::int AS pending_orders,
        COUNT(*) FILTER (WHERE status = 'EXPIRED')::int AS expired_orders,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::int AS cancelled_orders,
        COALESCE(SUM(total_amount) FILTER (WHERE status = 'PAID'), 0)::int AS total_revenue,
        COUNT(DISTINCT customer_email) FILTER (WHERE status = 'PAID')::int AS unique_customers
       FROM orders`,
    );

    // 3. Thống kê yêu cầu tư vấn thực tế
    const leadsRes = await this.db.query(
      `SELECT 
        COUNT(*)::int AS total_leads,
        COUNT(*) FILTER (WHERE UPPER(status) = 'NEW')::int AS new_leads
       FROM consultation_leads WHERE deleted_at IS NULL`,
    );

    // 4. Danh sách đơn hàng thực tế gần nhất
    const recentOrders = await this.db.query(
      `SELECT id, order_code, customer_name, customer_email, course_title, total_amount, status, ref, utm_source, created_at, paid_at 
       FROM orders 
       ORDER BY created_at DESC 
       LIMIT 10`,
    );

    // 5. Thống kê hiệu quả thực tế từng khóa học (Đã bán thực tế & Doanh thu thực tế)
    const coursePerformance = await this.db.query(
      `SELECT 
        c.title AS name,
        c.slug,
        c.views_count,
        COUNT(o.id)::int AS created,
        COUNT(o.id) FILTER (WHERE o.status = 'PAID')::int AS paid,
        COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'PAID'), 0)::int AS revenue
      FROM courses c
      LEFT JOIN orders o ON (c.id = o.course_id OR c.slug = o.course_slug)
      WHERE c.deleted_at IS NULL
      GROUP BY c.id
      ORDER BY paid DESC, revenue DESC
      LIMIT 10`,
    );

    // 6. Doanh thu thực tế 14 ngày gần nhất
    const chart14Days = await this.db.query(
      `WITH days AS (
         SELECT generate_series(
           CURRENT_DATE - INTERVAL '13 days',
           CURRENT_DATE,
           INTERVAL '1 day'
         )::date AS day
       )
       SELECT 
         to_char(days.day, 'DD/MM') AS date_label,
         days.day,
         COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'PAID'), 0)::int AS revenue,
         COUNT(o.id) FILTER (WHERE o.status = 'PAID')::int AS paid_count
       FROM days
       LEFT JOIN orders o ON DATE(o.paid_at) = days.day
       GROUP BY days.day
       ORDER BY days.day ASC`,
    );

    const o = ordersRes.rows[0];
    const l = leadsRes.rows[0];

    return {
      totalRevenue: o.total_revenue,
      totalOrders: o.total_orders,
      paidOrders: o.paid_orders,
      pendingOrders: o.pending_orders,
      expiredOrders: o.expired_orders,
      totalLeads: l.total_leads,
      newLeads: l.new_leads,
      totalCourses: coursesRes.rows[0].count,
      kpi: {
        publishedCourses: coursesRes.rows[0].count,
        totalOrders: o.total_orders,
        paidOrders: o.paid_orders,
        pendingOrders: o.pending_orders,
        uniqueBuyers: o.unique_customers,
        totalRevenue: o.total_revenue,
      },
      chart14Days: chart14Days.rows,
      coursePerformance: coursePerformance.rows,
      recentOrders: recentOrders.rows,
    };
  }
}
