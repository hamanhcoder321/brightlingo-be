import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '@/core/database';
import { SecurityUtil } from '@/common/security/security.util';

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

  // Lấy chi tiết 1 khóa học theo id hoặc slug
  async getBySlug(slug: string) {
    const res = await this.db.query(
      `SELECT id, slug, category_id, category_name, tag_badge, type_badge, title,
              rating, reviews_count, students_count, last_updated,
              price, original_price, discount_percent, image,
              video_demo_title, video_demo_duration, video_demo_subtitle, video_url,
              benefits, curriculum, bank_info, views_count, buyers_count, status,
              resource_link, seo_title, seo_description, og_image
       FROM courses 
       WHERE (slug = $1 OR id = $1) AND deleted_at IS NULL`,
      [slug],
    );

    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy khóa học với ID/Slug: ${slug}`);
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
             benefits, curriculum, bank_info, views_count, buyers_count, status,
             resource_link, seo_title, seo_description, og_image
      FROM courses 
      WHERE deleted_at IS NULL
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

  // Tạo khóa học mới (Bảo mật: Validate & Làm sạch tất cả input, link ảnh/video)
  async createCourse(data: any) {
    const id = data.id ? SecurityUtil.sanitizeText(data.id) : `course-${Date.now()}`;
    const slug = data.slug ? SecurityUtil.sanitizeText(data.slug) : id;
    const title = SecurityUtil.sanitizeText(data.title || data.name || 'Khóa học mới');
    const categoryId = SecurityUtil.sanitizeText(data.categoryId || data.category_id || 'communication');
    const categoryName = SecurityUtil.sanitizeText(data.categoryName || data.category_name || 'Giao tiếp thực tế');
    const tagBadge = SecurityUtil.sanitizeText(data.tagBadge || data.tag_badge || data.description || '');
    const typeBadge = SecurityUtil.sanitizeText(data.typeBadge || data.type_badge || 'Trọn đời');
    const price = Math.max(0, Number(data.price) || 0);
    const originalPrice = Math.max(price, Number(data.originalPrice || data.original_price) || price);
    const discountPercent = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
    
    // Bảo vệ URL ảnh & video độc
    const rawImage = data.image || data.thumbnail || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80';
    const image = SecurityUtil.sanitizeUrl(rawImage, 'Ảnh khóa học');
    const videoUrl = SecurityUtil.sanitizeUrl(data.videoUrl || data.video_url || '', 'Video bài giảng');
    const resourceLink = SecurityUtil.sanitizeUrl(data.resourceLink || data.resource_link || '', 'Link tài liệu');
    const ogImage = SecurityUtil.sanitizeUrl(data.ogImage || data.og_image || image, 'Ảnh chia sẻ mạng xã hội');

    const status = (data.status || 'PUBLISHED').toUpperCase();
    const seoTitle = SecurityUtil.sanitizeText(data.seoTitle || data.seo_title || title);
    const seoDescription = SecurityUtil.sanitizeText(data.seoDescription || data.seo_description || tagBadge);
    
    const parsedBenefits = typeof data.benefits === 'string' ? JSON.parse(data.benefits) : (data.benefits || []);
    const benefits = SecurityUtil.sanitizePayload(parsedBenefits);
    const parsedCurriculum = typeof data.curriculum === 'string' ? JSON.parse(data.curriculum) : (data.curriculum || { summary: 'Tài liệu & Video trọn đời', sections: [] });
    const curriculum = SecurityUtil.sanitizePayload(parsedCurriculum);
    const bankInfo = data.bankInfo || { bankName: 'MBBANK', accountName: 'HA VAN MANH', accountNumber: '0399046519', orderCodePrefix: 'BL' };

    const query = `
      INSERT INTO courses (
        id, slug, category_id, category_name, tag_badge, type_badge, title,
        rating, reviews_count, students_count, last_updated,
        price, original_price, discount_percent, image, video_url,
        benefits, curriculum, bank_info, resource_link, status,
        seo_title, seo_description, og_image, views_count, buyers_count, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        5.0, '1.2k đánh giá', '100+ học viên đã học', 'Cập nhật 2026',
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16, $17,
        $18, $19, $20, 0, 0, NOW()
      )
      RETURNING *
    `;

    const res = await this.db.query(query, [
      id, slug, categoryId, categoryName, tagBadge, typeBadge, title,
      price, originalPrice, discountPercent, image, videoUrl,
      JSON.stringify(benefits), JSON.stringify(curriculum), JSON.stringify(bankInfo), resourceLink, status,
      seoTitle, seoDescription, ogImage,
    ]);

    return this.mapToDto(res.rows[0]);
  }

  // Cập nhật thông tin khóa học
  async updateCourse(id: string, data: any) {
    const existing = await this.db.query(
      `SELECT * FROM courses WHERE (id = $1 OR slug = $1) AND deleted_at IS NULL`,
      [id],
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException(`Khóa học không tồn tại (ID/Slug: ${id})`);
    }
    const current = existing.rows[0];
    const targetId = current.id;

    const title = SecurityUtil.sanitizeText(data.title ?? data.name ?? current.title);
    const slug = SecurityUtil.sanitizeText(data.slug ?? current.slug);
    const categoryId = SecurityUtil.sanitizeText(data.categoryId ?? data.category_id ?? current.category_id);
    const categoryName = SecurityUtil.sanitizeText(data.categoryName ?? data.category_name ?? current.category_name);
    const tagBadge = SecurityUtil.sanitizeText(data.tagBadge ?? data.tag_badge ?? data.description ?? current.tag_badge);
    const typeBadge = SecurityUtil.sanitizeText(data.typeBadge ?? data.type_badge ?? current.type_badge);
    const price = data.price !== undefined ? Math.max(0, Number(data.price)) : current.price;
    const originalPrice = (data.originalPrice !== undefined || data.original_price !== undefined)
      ? Math.max(price, Number(data.originalPrice ?? data.original_price))
      : current.original_price;
    const discountPercent = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : current.discount_percent;
    
    // Bảo vệ URL ảnh & video độc khi cập nhật
    const rawImage = data.image ?? data.thumbnail ?? current.image;
    const image = SecurityUtil.sanitizeUrl(rawImage, 'Ảnh khóa học');
    const rawVideo = data.videoUrl ?? data.video_url ?? current.video_url;
    const videoUrl = SecurityUtil.sanitizeUrl(rawVideo, 'Video bài giảng');
    const rawResource = data.resourceLink ?? data.resource_link ?? current.resource_link;
    const resourceLink = SecurityUtil.sanitizeUrl(rawResource, 'Link tài liệu');
    const status = data.status ? String(data.status).toUpperCase() : current.status;
    const seoTitle = SecurityUtil.sanitizeText(data.seoTitle ?? data.seo_title ?? current.seo_title);
    const seoDescription = SecurityUtil.sanitizeText(data.seoDescription ?? data.seo_description ?? current.seo_description);
    const ogImage = SecurityUtil.sanitizeUrl(data.ogImage ?? data.og_image ?? current.og_image, 'Ảnh OG SEO');
    
    const parsedBenefits = data.benefits ? (typeof data.benefits === 'string' ? JSON.parse(data.benefits) : data.benefits) : current.benefits;
    const benefits = SecurityUtil.sanitizePayload(parsedBenefits);
    const parsedCurriculum = data.curriculum ? (typeof data.curriculum === 'string' ? JSON.parse(data.curriculum) : data.curriculum) : current.curriculum;
    const curriculum = SecurityUtil.sanitizePayload(parsedCurriculum);

    const query = `
      UPDATE courses
      SET title = $1,
          slug = $2,
          category_id = $3,
          category_name = $4,
          tag_badge = $5,
          type_badge = $6,
          price = $7,
          original_price = $8,
          discount_percent = $9,
          image = $10,
          video_url = $11,
          resource_link = $12,
          status = $13,
          seo_title = $14,
          seo_description = $15,
          og_image = $16,
          benefits = $17,
          curriculum = $18
      WHERE id = $19
      RETURNING *
    `;

    const res = await this.db.query(query, [
      title, slug, categoryId, categoryName, tagBadge, typeBadge,
      price, originalPrice, discountPercent, image, videoUrl,
      resourceLink, status, seoTitle, seoDescription, ogImage,
      JSON.stringify(benefits), JSON.stringify(curriculum), targetId,
    ]);

    return this.mapToDto(res.rows[0]);
  }

  // Xóa chỉ khóa học này (Soft delete, tuyệt đối KHÔNG đụng đến bảng categories)
  async deleteCourse(id: string) {
    const res = await this.db.query(
      `UPDATE courses SET deleted_at = NOW() WHERE (id = $1 OR slug = $1) AND deleted_at IS NULL RETURNING id, title, category_id`,
      [id],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Khóa học không tồn tại hoặc đã được xóa`);
    }
    return {
      success: true,
      message: `Đã xóa khóa học "${res.rows[0].title}". Danh mục khóa học được giữ nguyên.`,
      deletedId: res.rows[0].id,
      categoryId: res.rows[0].category_id,
    };
  }

  // Lấy chi tiết nội bộ bao gồm resource_link
  async getInternalById(id: string) {
    const res = await this.db.query(
      `SELECT * FROM courses WHERE (id = $1 OR slug = $1) AND deleted_at IS NULL`,
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
      viewsCount: row.views_count ? parseInt(row.views_count, 10) : 0,
      buyersCount: row.buyers_count ? parseInt(row.buyers_count, 10) : 0,
      status: row.status || 'PUBLISHED',
      lastUpdated: row.last_updated,
      price: row.price,
      originalPrice: row.original_price,
      discountPercent: row.discount_percent,
      image: row.image,
      videoDemoTitle: (row.video_demo_title || 'Xem video demo bài giảng').replace(/\s*\(\s*\d+\s*phút\s*\)/gi, '').trim(),
      videoDemoDuration: row.video_demo_duration || '',
      videoDemoSubtitle: row.video_demo_subtitle || 'Phương pháp phản xạ tình huống độc quyền',
      videoUrl: row.video_url || '',
      benefits: row.benefits,
      curriculum: row.curriculum,
      bankInfo: row.bank_info,
      resourceLink: row.resource_link || '',
      resource_link: row.resource_link || '',
      seoTitle: row.seo_title || row.title,
      seoDescription: row.seo_description || row.tag_badge || '',
      ogImage: row.og_image || row.image,
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
