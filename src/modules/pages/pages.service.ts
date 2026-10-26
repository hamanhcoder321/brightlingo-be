import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '@/core/database';
import { SecurityUtil } from '@/common/security/security.util';

@Injectable()
export class PagesService {
  constructor(private readonly db: DatabaseService) {}

  // Lấy nội dung trang chính sách / điều khoản theo slug (Mục 14.2 BA)
  async getBySlug(slug: string) {
    const res = await this.db.query(
      `SELECT id, slug, title, content, seo_title, seo_description, status, created_at, updated_at 
       FROM pages 
       WHERE slug = $1 AND status = 'PUBLISHED' AND deleted_at IS NULL`,
      [slug],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Trang không tồn tại: ${slug}`);
    }

    return res.rows[0];
  }

  // Danh sách các trang chính sách cho cả FE lẫn CMS
  async getAll(isAdmin: boolean = false) {
    let query = `SELECT id, slug, title, content, seo_title, seo_description, status, created_at, updated_at FROM pages WHERE deleted_at IS NULL`;
    if (!isAdmin) {
      query += ` AND status = 'PUBLISHED'`;
    }
    query += ` ORDER BY id ASC`;
    const res = await this.db.query(query);
    return res.rows;
  }

  // Tạo mới trang chính sách (CMS)
  async create(data: {
    title: string;
    slug: string;
    content: string;
    seoTitle?: string;
    seoDescription?: string;
    status?: string;
  }) {
    if (!data.title || !data.slug || !data.content) {
      throw new BadRequestException('Tiêu đề, đường dẫn (slug) và nội dung trang không được để trống.');
    }
    const slug = SecurityUtil.sanitizeText(data.slug).toLowerCase().trim();
    const title = SecurityUtil.sanitizeText(data.title);
    const content = data.content; // Cho phép HTML phong phú đã được render
    const seoTitle = data.seoTitle ? SecurityUtil.sanitizeText(data.seoTitle) : title;
    const seoDescription = data.seoDescription ? SecurityUtil.sanitizeText(data.seoDescription) : '';
    const status = data.status ? String(data.status).toUpperCase() : 'PUBLISHED';

    const checkRes = await this.db.query(
      `SELECT id FROM pages WHERE slug = $1 AND deleted_at IS NULL`,
      [slug],
    );
    if (checkRes.rows.length > 0) {
      throw new BadRequestException(`Đường dẫn (slug) "${slug}" đã tồn tại.`);
    }

    const res = await this.db.query(
      `INSERT INTO pages (slug, title, content, seo_title, seo_description, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [slug, title, content, seoTitle, seoDescription, status],
    );
    return res.rows[0];
  }

  // Cập nhật trang chính sách (CMS)
  async update(id: string | number, data: Partial<{
    title: string;
    slug: string;
    content: string;
    seoTitle?: string;
    seoDescription?: string;
    status?: string;
  }>) {
    const existing = await this.db.query(
      `SELECT * FROM pages WHERE (id::text = $1 OR slug = $1) AND deleted_at IS NULL`,
      [String(id)],
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException(`Trang chính sách không tồn tại (ID: ${id})`);
    }
    const current = existing.rows[0];

    const title = data.title !== undefined ? SecurityUtil.sanitizeText(data.title) : current.title;
    const slug = data.slug !== undefined ? SecurityUtil.sanitizeText(data.slug).toLowerCase().trim() : current.slug;
    const content = data.content !== undefined ? data.content : current.content;
    const seoTitle = data.seoTitle !== undefined ? SecurityUtil.sanitizeText(data.seoTitle) : current.seo_title;
    const seoDescription = data.seoDescription !== undefined ? SecurityUtil.sanitizeText(data.seoDescription) : current.seo_description;
    const status = data.status !== undefined ? String(data.status).toUpperCase() : current.status;

    if (slug !== current.slug) {
      const checkRes = await this.db.query(
        `SELECT id FROM pages WHERE slug = $1 AND id != $2 AND deleted_at IS NULL`,
        [slug, current.id],
      );
      if (checkRes.rows.length > 0) {
        throw new BadRequestException(`Đường dẫn (slug) "${slug}" đã được sử dụng.`);
      }
    }

    const res = await this.db.query(
      `UPDATE pages 
       SET title = $1, slug = $2, content = $3, seo_title = $4, seo_description = $5, status = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [title, slug, content, seoTitle, seoDescription, status, current.id],
    );
    return res.rows[0];
  }

  // Xóa mềm trang chính sách
  async delete(id: string | number) {
    const res = await this.db.query(
      `UPDATE pages SET deleted_at = NOW() WHERE (id::text = $1 OR slug = $1) AND deleted_at IS NULL RETURNING id, title`,
      [String(id)],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Trang không tồn tại hoặc đã được xóa`);
    }
    return { success: true, message: `Đã xóa trang "${res.rows[0].title}"` };
  }
}
