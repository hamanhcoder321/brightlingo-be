import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class CoursesService {
  constructor(private readonly db: DatabaseService) {}

  // Lấy chi tiết 1 khóa học theo slug (VD: english-for-real-life)
  async getBySlug(slug: string) {
    const res = await this.db.query(
      `SELECT id, slug, category_name, tag_badge, type_badge, title,
              rating, reviews_count, students_count, last_updated,
              price, original_price, discount_percent, image,
              video_demo_title, video_demo_duration, video_demo_subtitle, video_url,
              benefits, curriculum, bank_info, status
       FROM courses 
       WHERE slug = $1 AND status = 'PUBLISHED'`,
      [slug],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy khóa học với slug: ${slug}`);
    }

    const row = res.rows[0];
    // Mapping từ snake_case của PostgreSQL sang camelCase chuẩn của Frontend
    return {
      id: row.id,
      slug: row.slug,
      categoryName: row.category_name,
      tagBadge: row.tag_badge,
      typeBadge: row.type_badge,
      title: row.title,
      rating: parseFloat(row.rating),
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
    };
  }

  // Lấy danh sách tất cả khóa học
  async getAll() {
    const res = await this.db.query(
      `SELECT id, slug, category_name, tag_badge, type_badge, title,
              rating, reviews_count, students_count, last_updated,
              price, original_price, discount_percent, image,
              video_demo_title, video_demo_duration, video_demo_subtitle, video_url,
              benefits, curriculum, bank_info
       FROM courses 
       WHERE status = 'PUBLISHED' 
       ORDER BY created_at DESC`,
    );

    return res.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      categoryName: row.category_name,
      tagBadge: row.tag_badge,
      typeBadge: row.type_badge,
      title: row.title,
      rating: parseFloat(row.rating),
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
    }));
  }
}
