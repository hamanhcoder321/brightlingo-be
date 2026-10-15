import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@/core/database';

@Injectable()
export class PagesService {
  constructor(private readonly db: DatabaseService) {}

  // Lấy nội dung trang chính sách / điều khoản theo slug (Mục 14.2 BA)
  async getBySlug(slug: string) {
    const res = await this.db.query(
      `SELECT id, slug, title, content, seo_title, seo_description 
       FROM pages 
       WHERE slug = $1 AND status = 'PUBLISHED' AND deleted_at IS NULL`,
      [slug],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Trang không tồn tại: ${slug}`);
    }

    return res.rows[0];
  }

  async getAll() {
    const res = await this.db.query(
      `SELECT id, slug, title, status FROM pages WHERE deleted_at IS NULL`,
    );
    return res.rows;
  }
}
