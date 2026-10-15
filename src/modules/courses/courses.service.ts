import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@/core/database';

@Injectable()
export class CoursesService {
  constructor(private readonly db: DatabaseService) {}

  // Lấy danh sách danh mục (Categories)
  async getCategories() {
    const res = await this.db.query(
      `SELECT id, name, slug, description, display_order 
       FROM categories 
       ORDER BY display_order ASC`,
    );

    return res.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
    }));
  }

  // Lấy chi tiết 1 khóa học theo slug (Public API - Ẩn resource_link theo BR-02)
  async getBySlug(slug: string) {
    const res = await this.db.query(
      `SELECT id, slug, category_id, category_name, tag_badge, type_badge, title,
              rating, reviews_count, students_count, last_updated,
              price, original_price, discount_percent, image,
              video_demo_title, video_demo_duration, video_demo_subtitle, video_url,
              benefits, curriculum, bank_info, views_count, buyers_count, status
       FROM courses 
       WHERE slug = $1 AND status = 'PUBLISHED' AND deleted_at IS NULL`,
      [slug],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy khóa học với slug: ${slug}`);
    }

    const row = res.rows[0];
    return this.mapToDto(row);
  }

  // Lấy danh sách tất cả khóa học đang bán (Public API, hỗ trợ lọc theo categoryId)
  async getAll(categoryId?: string) {
    let query = `
      SELECT id, slug, category_id, category_name, tag_badge, type_badge, title,
             rating, reviews_count, students_count, last_updated,
             price, original_price, discount_percent, image,
             video_demo_title, video_demo_duration, video_demo_subtitle, video_url,
             benefits, curriculum, bank_info, views_count, buyers_count
      FROM courses 
      WHERE status = 'PUBLISHED' AND deleted_at IS NULL
    `;
    const params: any[] = [];

    if (categoryId && categoryId !== 'all') {
      params.push(categoryId);
      query += ` AND (category_id = $${params.length} OR slug = $${params.length})`;
    }

    query += ` ORDER BY views_count DESC, id ASC`;

    const res = await this.db.query(query, params);
    return res.rows.map((row) => this.mapToDto(row));
  }

  // Lấy chi tiết nội bộ bao gồm resource_link (Chỉ dành cho CMS Admin hoặc Order Delivery sau khi Paid)
  async getInternalById(id: string) {
    const res = await this.db.query(
      `SELECT * FROM courses WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Khóa học không tồn tại (ID: ${id})`);
    }
    return res.rows[0];
  }

  private mapToDto(row: any) {
    const isFeatured = (row.views_count && row.views_count >= 1400) || row.id === 'course-1';
    return {
      id: row.id,
      slug: row.slug,
      categoryId: row.category_id || 'communication',
      categoryName: row.category_name,
      tagBadge: row.tag_badge,
      typeBadge: row.type_badge,
      title: row.title,
      description: row.tag_badge || row.title,
      rating: parseFloat(row.rating || 5.0),
      reviewsCount: row.reviews_count,
      studentsCount: row.students_count,
      lastUpdated: row.last_updated,
      price: row.price,
      originalPrice: row.original_price,
      discountPercent: row.discount_percent,
      image: row.image,
      videoDemoTitle: row.video_demo_title,
      videoDemoDuration: row.video_demo_duration,
      videoDemoSubtitle: row.video_demo_subtitle,
      videoUrl: row.video_url || '',
      benefits: row.benefits,
      curriculum: row.curriculum,
      bankInfo: row.bank_info,
      meta: row.curriculum?.summary ? row.curriculum.summary.split('•')[0].trim() : '42 video · PDF · Audio',
      highlights: Array.isArray(row.benefits) ? row.benefits.map((b: any) => b.title) : [],
      isFeatured,
      badge: isFeatured
        ? { text: 'Bán chạy', variant: 'danger' }
        : row.discount_percent > 95
        ? { text: 'Ưu đãi sốc', variant: 'primary' }
        : undefined,
    };
  }
}
