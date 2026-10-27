import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '@/core/database';
import { SecurityUtil } from '@/common/security/security.util';
import { AuditService } from '@/modules/audit/audit.service';

export const RESERVED_COURSE_SLUGS = new Set([
  'admin',
  'api',
  'checkout',
  'payment',
  'payments',
  'policies',
  'policy',
  'chinh-sach',
  'khoa-hoc',
  'courses',
  'orders',
  'leads',
  'coupons',
  'auth',
  'login',
  'register',
  'dang-ky',
  'dashboard',
  'settings',
  'danh-gia',
  'loi-ich',
  'giao-tai-lieu-so',
  'chinh-sach-thanh-toan',
  'chinh-sach-bao-mat',
  'dieu-khoan-su-dung',
  'uploads',
  'sitemap',
  'robots',
  'categories',
]);

@Injectable()
export class CoursesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly auditService: AuditService,
  ) {}

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
  async getBySlug(slug: string, isAdmin: boolean = false) {
    let query = `
      SELECT c.id, c.slug, c.category_id, c.category_name, c.tag_badge, c.type_badge, c.title,
              c.rating, c.reviews_count, c.students_count, c.last_updated,
              c.price, c.original_price, c.discount_percent, c.image,
              c.video_demo_title, c.video_demo_duration, c.video_demo_subtitle, c.video_url,
              c.benefits, c.curriculum, c.bank_info, c.views_count, c.is_featured, c.status,
              c.resource_link, c.seo_title, c.seo_description, c.og_image,
              COUNT(o.id) FILTER (WHERE o.status = 'PAID')::int AS buyers_count,
              COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'PAID'), 0)::int AS real_revenue,
              COUNT(o.id)::int AS created_count
       FROM courses c
       LEFT JOIN orders o ON (c.id = o.course_id OR c.slug = o.course_slug)
       WHERE (c.slug = $1 OR c.id = $1) AND c.deleted_at IS NULL
    `;

    // BR-14: Public API chỉ trả về khóa học PUBLISHED
    if (!isAdmin) {
      query += ` AND UPPER(c.status) = 'PUBLISHED'`;
    }

    query += ` GROUP BY c.id`;

    const res = await this.db.query(query, [slug]);

    if (res.rows.length === 0) {
      // Kiểm tra bảng chuyển hướng 301 (nếu đã đổi slug trước đó)
      try {
        const redRes = await this.db.query(`SELECT value FROM settings WHERE key = 'redirects_301'`);
        if (redRes.rows[0]?.value) {
          const rules = JSON.parse(redRes.rows[0].value);
          const matched = Array.isArray(rules)
            ? rules.find(
                (r: any) =>
                  r.from === `/khoa-hoc/${slug}` ||
                  r.from === slug ||
                  r.from?.replace(/^\/khoa-hoc\//, '') === slug,
              )
            : null;
          if (matched && matched.to) {
            const targetSlug = matched.to.replace(/^\/khoa-hoc\//, '').replace(/^\//, '');
            if (targetSlug && targetSlug !== slug) {
              return this.getBySlug(targetSlug, isAdmin);
            }
          }
        }
      } catch {
        // Ignore redirect parse error
      }
      throw new NotFoundException(`Không tìm thấy khóa học với ID/Slug: ${slug}`);
    }

    const row = res.rows[0];
    return this.mapToDto(row, isAdmin);
  }

  // Lấy danh sách tất cả khóa học đang bán (Public API, hỗ trợ lọc theo categoryId)
  async getAll(categoryId?: string, isAdmin: boolean = false) {
    let query = `
      SELECT c.id, c.slug, c.category_id, c.category_name, c.tag_badge, c.type_badge, c.title,
             c.rating, c.reviews_count, c.students_count, c.last_updated,
             c.price, c.original_price, c.discount_percent, c.image,
             c.video_demo_title, c.video_demo_duration, c.video_demo_subtitle, c.video_url,
             c.benefits, c.curriculum, c.bank_info, c.views_count, c.is_featured, c.status,
             c.resource_link, c.seo_title, c.seo_description, c.og_image,
             COUNT(o.id) FILTER (WHERE o.status = 'PAID')::int AS buyers_count,
             COALESCE(SUM(o.total_amount) FILTER (WHERE o.status = 'PAID'), 0)::int AS real_revenue,
             COUNT(o.id)::int AS created_count
      FROM courses c
      LEFT JOIN orders o ON (c.id = o.course_id OR c.slug = o.course_slug)
      WHERE c.deleted_at IS NULL
    `;
    const params: any[] = [];

    // BR-14: Public API chỉ trả về khóa học PUBLISHED
    if (!isAdmin) {
      query += ` AND UPPER(c.status) = 'PUBLISHED'`;
    }

    if (categoryId && categoryId !== 'all') {
      params.push(categoryId);
      query += ` AND (c.category_id = $${params.length} OR c.slug = $${params.length})`;
    }

    query += ` GROUP BY c.id ORDER BY buyers_count DESC, real_revenue DESC, c.views_count DESC, c.id ASC`;

    const res = await this.db.query(query, params);
    return res.rows.map((row) => this.mapToDto(row, isAdmin));
  }

  // Tự động tra cứu tên danh mục từ bảng categories theo categoryId
  private async resolveCategoryName(categoryId: string, fallbackName?: string): Promise<string> {
    try {
      const res = await this.db.query(
        `SELECT name FROM categories WHERE id = $1 OR slug = $1 LIMIT 1`,
        [categoryId],
      );
      if (res.rows.length > 0 && res.rows[0].name) {
        return res.rows[0].name;
      }
    } catch {
      // Ignore lookup error
    }
    return fallbackName || 'Giao tiếp thực tế';
  }

  // Tạo khóa học mới (Bảo mật: Validate & Làm sạch tất cả input, link ảnh/video & Ghi Audit Log)
  async createCourse(data: any, adminUser?: any) {
    const id = data.id ? SecurityUtil.sanitizeText(data.id) : `course-${Date.now()}`;
    const rawSlug = data.slug ? SecurityUtil.sanitizeText(data.slug) : id;
    const slug = rawSlug.toLowerCase().trim();

    // BR-01: Cấm đặt slug trùng với các route hệ thống được bảo lưu
    if (RESERVED_COURSE_SLUGS.has(slug)) {
      throw new BadRequestException(`Slug "${slug}" trùng với đường dẫn hệ thống được bảo lưu. Vui lòng chọn slug khác.`);
    }

    // Kiểm tra trùng lặp slug trong DB
    const checkDuplicate = await this.db.query(
      `SELECT id FROM courses WHERE slug = $1 AND deleted_at IS NULL`,
      [slug],
    );
    if (checkDuplicate.rows.length > 0) {
      throw new BadRequestException(`Đường dẫn (slug) "${slug}" đã được sử dụng bởi khóa học khác.`);
    }

    const title = SecurityUtil.sanitizeText(data.title || data.name || 'Khóa học mới');
    const categoryId = SecurityUtil.sanitizeText(data.categoryId || data.category_id || 'communication');
    const categoryName = await this.resolveCategoryName(
      categoryId,
      data.categoryName || data.category_name ? SecurityUtil.sanitizeText(data.categoryName || data.category_name) : undefined,
    );

    const formatBadge = SecurityUtil.sanitizeText(data.tagBadge || data.tag_badge || '32 video · 6 PDF · Audio');
    const shortDescription = SecurityUtil.sanitizeText(data.description || formatBadge || title);
    const duration = SecurityUtil.sanitizeText(data.duration || data.videoDemoDuration || data.curriculum?.totalDuration || '9 giờ');
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
    const seoDescription = SecurityUtil.sanitizeText(data.seoDescription || data.seo_description || shortDescription);
    
    const parsedBenefits = typeof data.benefits === 'string' ? JSON.parse(data.benefits) : (data.benefits || []);
    const benefits = SecurityUtil.sanitizePayload(parsedBenefits);
    const parsedCurriculum = typeof data.curriculum === 'string' ? JSON.parse(data.curriculum) : (data.curriculum || { summary: formatBadge, sections: [] });
    const sanitizedCurriculum = SecurityUtil.sanitizePayload(parsedCurriculum);
    const rawFaqs = Array.isArray(data.faqs) ? data.faqs : (Array.isArray(sanitizedCurriculum?.faqs) ? sanitizedCurriculum.faqs : []);
    const cleanFaqs = SecurityUtil.sanitizePayload(rawFaqs).map((f: any, idx: number) => ({
      id: f.id || `faq-${idx + 1}`,
      question: String(f.question || '').trim(),
      answer: String(f.answer || '').trim(),
    })).filter((f: any) => f.question);

    const curriculum = {
      ...(typeof sanitizedCurriculum === 'object' && sanitizedCurriculum !== null ? sanitizedCurriculum : {}),
      summary: formatBadge || sanitizedCurriculum?.summary || 'Tài liệu & Video trọn đời',
      totalDuration: duration,
      description: shortDescription,
      faqs: cleanFaqs,
      sections: Array.isArray(sanitizedCurriculum?.sections) ? sanitizedCurriculum.sections : [],
    };

    const bankInfo = data.bankInfo || { bankName: 'MBBANK', accountName: 'HA VAN MANH', accountNumber: '0399046519', orderCodePrefix: 'BL' };

    const isFeatured = Boolean(data.isFeatured ?? data.is_featured ?? false);
    if (isFeatured) {
      await this.db.query(`UPDATE courses SET is_featured = false`);
    }

    const query = `
      INSERT INTO courses (
        id, slug, category_id, category_name, tag_badge, type_badge, title,
        rating, reviews_count, students_count, last_updated,
        price, original_price, discount_percent, image, video_demo_duration, video_url,
        benefits, curriculum, bank_info, resource_link, status,
        seo_title, seo_description, og_image, is_featured, views_count, buyers_count, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        5.0, '1.2k đánh giá', '100+ học viên đã học', 'Cập nhật 2026',
        $8, $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21, $22, 0, 0, NOW()
      )
      RETURNING *
    `;

    const res = await this.db.query(query, [
      id, slug, categoryId, categoryName, shortDescription, typeBadge, title,
      price, originalPrice, discountPercent, image, duration, videoUrl,
      JSON.stringify(benefits), JSON.stringify(curriculum), JSON.stringify(bankInfo), resourceLink, status,
      seoTitle, seoDescription, ogImage, isFeatured,
    ]);

    const adminIdNum = (adminUser?.id || adminUser?.sub) ? Number(adminUser.id || adminUser.sub) : undefined;
    const adminDisplayName = adminUser?.name || adminUser?.email || 'Admin';

    await this.auditService.log({
      adminId: adminIdNum,
      adminName: adminDisplayName,
      action: 'CREATE_COURSE',
      targetEntity: 'courses',
      targetId: String(res.rows[0].id),
      details: {
        title: res.rows[0].title,
        slug: res.rows[0].slug,
        price: res.rows[0].price,
        status: res.rows[0].status,
        categoryId: res.rows[0].category_id,
      },
    });

    return this.mapToDto(res.rows[0], true);
  }

  // Cập nhật thông tin khóa học
  async updateCourse(id: string, data: any, adminUser?: any) {
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
    const rawSlug = data.slug !== undefined ? SecurityUtil.sanitizeText(data.slug).toLowerCase().trim() : current.slug;
    const slug = rawSlug || current.slug;

    // BR-01: Chặn đổi sang slug trùng route hệ thống hoặc trùng khóa học khác
    if (slug !== current.slug) {
      if (RESERVED_COURSE_SLUGS.has(slug)) {
        throw new BadRequestException(`Slug "${slug}" trùng với đường dẫn hệ thống được bảo lưu. Vui lòng chọn slug khác.`);
      }
      const checkDuplicate = await this.db.query(
        `SELECT id FROM courses WHERE slug = $1 AND id != $2 AND deleted_at IS NULL`,
        [slug, targetId],
      );
      if (checkDuplicate.rows.length > 0) {
        throw new BadRequestException(`Đường dẫn (slug) "${slug}" đã được sử dụng bởi khóa học khác.`);
      }
    }

    const categoryId = SecurityUtil.sanitizeText(data.categoryId ?? data.category_id ?? current.category_id ?? 'communication');
    const categoryName = await this.resolveCategoryName(
      categoryId,
      data.categoryName || data.category_name ? SecurityUtil.sanitizeText(data.categoryName || data.category_name) : current.category_name,
    );

    const currentCurr = current.curriculum || {};
    const formatBadge = SecurityUtil.sanitizeText(
      data.tagBadge ?? data.tag_badge ?? currentCurr.summary ?? current.tag_badge ?? '',
    );
    const shortDescription = SecurityUtil.sanitizeText(
      data.description ?? currentCurr.description ?? current.tag_badge ?? title,
    );
    const duration = SecurityUtil.sanitizeText(
      data.duration ?? data.videoDemoDuration ?? data.curriculum?.totalDuration ?? currentCurr.totalDuration ?? current.video_demo_duration ?? '9 giờ',
    );
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
    const parsedCurriculum = data.curriculum ? (typeof data.curriculum === 'string' ? JSON.parse(data.curriculum) : data.curriculum) : currentCurr;
    const sanitizedCurriculum = SecurityUtil.sanitizePayload(parsedCurriculum);

    const rawFaqs = data.faqs !== undefined
      ? data.faqs
      : (Array.isArray(sanitizedCurriculum?.faqs) ? sanitizedCurriculum.faqs : (Array.isArray(currentCurr.faqs) ? currentCurr.faqs : []));
    const cleanFaqs = SecurityUtil.sanitizePayload(rawFaqs).map((f: any, idx: number) => ({
      id: f.id || `faq-${idx + 1}`,
      question: String(f.question || '').trim(),
      answer: String(f.answer || '').trim(),
    })).filter((f: any) => f.question);

    const curriculum = {
      ...(typeof currentCurr === 'object' && currentCurr !== null ? currentCurr : {}),
      ...(typeof sanitizedCurriculum === 'object' && sanitizedCurriculum !== null ? sanitizedCurriculum : {}),
      summary: formatBadge || sanitizedCurriculum?.summary || currentCurr.summary || 'Tài liệu & Video trọn đời',
      totalDuration: duration,
      description: shortDescription,
      faqs: cleanFaqs,
      sections: Array.isArray(sanitizedCurriculum?.sections)
        ? sanitizedCurriculum.sections
        : (Array.isArray(currentCurr.sections) ? currentCurr.sections : []),
    };

    const isFeaturedProvided = data.isFeatured !== undefined || data.is_featured !== undefined;
    const isFeatured = isFeaturedProvided
      ? Boolean(data.isFeatured !== undefined ? data.isFeatured : data.is_featured)
      : Boolean(current.is_featured);

    if (isFeaturedProvided && isFeatured) {
      await this.db.query(`UPDATE courses SET is_featured = false WHERE id != $1`, [targetId]);
    }

    const adminIdNum = (adminUser?.id || adminUser?.sub) ? Number(adminUser.id || adminUser.sub) : undefined;
    const adminDisplayName = adminUser?.name || adminUser?.email || 'Admin';

    // BR-15: Ghi Audit Log khi Admin sửa giá khóa học
    const oldPrice = Number(current.price) || 0;
    const newPrice = Number(price);
    if (data.price !== undefined && newPrice !== oldPrice) {
      await this.auditService.log({
        adminId: adminIdNum,
        adminName: adminDisplayName,
        action: 'UPDATE_PRICE',
        targetEntity: 'courses',
        targetId: String(targetId),
        details: {
          oldPrice,
          newPrice,
          courseTitle: title,
          slug,
        },
      });
    }

    // BR-15: Ghi Audit Log khi Admin sửa link tài nguyên (resource_link)
    const oldResourceLink = (current.resource_link || '').trim();
    const newResourceLink = (resourceLink || '').trim();
    if ((data.resourceLink !== undefined || data.resource_link !== undefined) && newResourceLink !== oldResourceLink) {
      await this.auditService.log({
        adminId: adminIdNum,
        adminName: adminDisplayName,
        action: 'UPDATE_RESOURCE_LINK',
        targetEntity: 'courses',
        targetId: String(targetId),
        details: {
          oldResourceLink,
          newResourceLink,
          courseTitle: title,
          slug,
          note: 'Admin cập nhật link tài nguyên học tập (BR-15)',
        },
      });
    }

    // Ghi Audit Log khi thay đổi trạng thái khóa học (DRAFT <-> PUBLISHED)
    if (data.status && String(data.status).toUpperCase() !== current.status) {
      await this.auditService.log({
        adminId: adminIdNum,
        adminName: adminDisplayName,
        action: 'CHANGE_COURSE_STATUS',
        targetEntity: 'courses',
        targetId: String(targetId),
        details: {
          oldStatus: current.status,
          newStatus: status,
          courseTitle: title,
        },
      });
    }

    // Ghi Audit Log cập nhật thông tin khóa học
    await this.auditService.log({
      adminId: adminIdNum,
      adminName: adminDisplayName,
      action: 'UPDATE_COURSE',
      targetEntity: 'courses',
      targetId: String(targetId),
      details: {
        courseTitle: title,
        slug,
        status,
        price,
      },
    });

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
          video_demo_duration = $11,
          video_url = $12,
          resource_link = $13,
          status = $14,
          seo_title = $15,
          seo_description = $16,
          og_image = $17,
          benefits = $18,
          curriculum = $19,
          is_featured = $20
      WHERE id = $21
      RETURNING *
    `;

    const res = await this.db.query(query, [
      title, slug, categoryId, categoryName, shortDescription, typeBadge,
      price, originalPrice, discountPercent, image, duration, videoUrl,
      resourceLink, status, seoTitle, seoDescription, ogImage,
      JSON.stringify(benefits), JSON.stringify(curriculum), isFeatured, targetId,
    ]);

    // Tự động thêm chuyển hướng 301 nếu đổi slug
    if (current.slug && slug && current.slug !== slug) {
      try {
        const redRes = await this.db.query(`SELECT value FROM settings WHERE key = 'redirects_301'`);
        let rules: any[] = [];
        if (redRes.rows[0]?.value) {
          rules = JSON.parse(redRes.rows[0].value);
        }
        const fromPath = `/khoa-hoc/${current.slug}`;
        const toPath = `/khoa-hoc/${slug}`;
        const filtered = Array.isArray(rules) ? rules.filter((r) => r.from !== fromPath) : [];
        filtered.unshift({
          id: `red-${Date.now()}`,
          from: fromPath,
          to: toPath,
          note: 'Tự tạo khi đổi slug',
        });
        await this.db.query(
          `INSERT INTO settings (group_name, key, value, updated_at)
           VALUES ('SEO', 'redirects_301', $1, NOW())
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
          [JSON.stringify(filtered)],
        );
      } catch {
        // Ignore error
      }
    }

    return this.mapToDto(res.rows[0], true);
  }

  // Đặt một khóa học làm khóa nổi bật duy nhất (Ghi Audit Log)
  async setFeatured(id: string, adminUser?: any) {
    const existing = await this.db.query(
      `SELECT id, slug, title, is_featured FROM courses WHERE (id = $1 OR slug = $1) AND deleted_at IS NULL`,
      [id],
    );
    if (existing.rows.length === 0) {
      throw new NotFoundException(`Khóa học không tồn tại (ID/Slug: ${id})`);
    }
    const targetId = existing.rows[0].id;
    const currentlyFeatured = Boolean(existing.rows[0].is_featured);

    if (currentlyFeatured) {
      await this.db.query(`UPDATE courses SET is_featured = false WHERE id = $1`, [targetId]);
    } else {
      await this.db.query(`UPDATE courses SET is_featured = false`);
      await this.db.query(`UPDATE courses SET is_featured = true WHERE id = $1`, [targetId]);
    }

    const adminIdNum = (adminUser?.id || adminUser?.sub) ? Number(adminUser.id || adminUser.sub) : undefined;
    const adminDisplayName = adminUser?.name || adminUser?.email || 'Admin';

    await this.auditService.log({
      adminId: adminIdNum,
      adminName: adminDisplayName,
      action: 'UPDATE_FEATURED',
      targetEntity: 'courses',
      targetId: String(targetId),
      details: {
        courseTitle: existing.rows[0].title,
        slug: existing.rows[0].slug,
        isFeatured: !currentlyFeatured,
      },
    });

    return this.getBySlug(targetId, true);
  }

  // Xóa chỉ khóa học này (Soft delete & Ghi Audit Log)
  async deleteCourse(id: string, adminUser?: any) {
    const res = await this.db.query(
      `UPDATE courses SET deleted_at = NOW() WHERE (id = $1 OR slug = $1) AND deleted_at IS NULL RETURNING id, title, slug, category_id`,
      [id],
    );
    if (res.rows.length === 0) {
      throw new NotFoundException(`Khóa học không tồn tại hoặc đã được xóa`);
    }

    const adminIdNum = (adminUser?.id || adminUser?.sub) ? Number(adminUser.id || adminUser.sub) : undefined;
    const adminDisplayName = adminUser?.name || adminUser?.email || 'Admin';

    await this.auditService.log({
      adminId: adminIdNum,
      adminName: adminDisplayName,
      action: 'DELETE_COURSE',
      targetEntity: 'courses',
      targetId: String(res.rows[0].id),
      details: {
        title: res.rows[0].title,
        slug: res.rows[0].slug,
      },
    });

    return {
      success: true,
      message: `Đã xóa khóa học "${res.rows[0].title}". Danh mục khóa học được giữ nguyên.`,
      deletedId: res.rows[0].id,
      categoryId: res.rows[0].category_id,
    };
  }

  // Ghi nhận lượt xem trang thực tế của khóa học (chống spam trùng IP trong 5 phút)
  async trackView(slugOrId: string, ip: string, userAgent: string) {
    const existing = await this.db.query(
      `SELECT id, slug, views_count FROM courses WHERE (id = $1 OR slug = $1) AND deleted_at IS NULL`,
      [slugOrId],
    );
    if (existing.rows.length === 0) {
      return { success: false, message: 'Course not found' };
    }
    const course = existing.rows[0];

    // Chống spam: Kiểm tra xem cùng IP này đã xem khóa học này trong vòng 5 phút chưa
    const recent = await this.db.query(
      `SELECT id FROM course_views 
       WHERE course_id = $1 AND ip_address = $2 AND created_at > NOW() - INTERVAL '5 minutes'
       LIMIT 1`,
      [course.id, ip],
    );

    if (recent.rows.length === 0) {
      // Ghi log lượt xem thực tế
      await this.db.query(
        `INSERT INTO course_views (course_id, course_slug, ip_address, user_agent, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [course.id, course.slug, ip, userAgent],
      );

      // Tăng số lượt xem trong bảng courses
      await this.db.query(
        `UPDATE courses SET views_count = views_count + 1 WHERE id = $1`,
        [course.id],
      );
    }

    const countRes = await this.db.query(
      `SELECT views_count FROM courses WHERE id = $1`,
      [course.id],
    );

    return { 
      success: true, 
      courseId: course.id, 
      viewsCount: countRes.rows[0]?.views_count || 0 
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

  private normalizeMediaUrl(url?: string): string {
    if (!url) return '';
    const defaultUrl =
      process.env.NODE_ENV === 'production'
        ? 'https://brightlingo-be.onrender.com'
        : 'http://localhost:4000';
    const publicUrl = (process.env.PUBLIC_URL || process.env.BACKEND_URL || defaultUrl).trim().replace(/\/+$/, '');
    if (publicUrl.includes('localhost') || publicUrl.includes('127.0.0.1')) {
      return url;
    }
    return url.replace(/https?:\/\/(localhost|127\.0\.0\.1):4000\/uploads\//g, `${publicUrl}/uploads/`);
  }

  private mapToDto(row: any, isAdmin: boolean = false) {
    const isFeatured = Boolean(row.is_featured);
    const rawCurriculum = typeof row.curriculum === 'object' && row.curriculum !== null ? row.curriculum : {};
    const formatSummary = rawCurriculum.summary || row.tag_badge || '32 video · 6 PDF · Audio';
    const shortDescription = rawCurriculum.description || row.tag_badge || row.title;
    const totalDuration = rawCurriculum.totalDuration || row.video_demo_duration || '9 giờ';
    const courseFaqs = Array.isArray(rawCurriculum.faqs) ? rawCurriculum.faqs : [];

    const normalizedImage = this.normalizeMediaUrl(row.image);
    const normalizedVideoUrl = this.normalizeMediaUrl(row.video_url);
    const normalizedOgImage = this.normalizeMediaUrl(row.og_image || row.image);

    const dto: any = {
      id: row.id,
      slug: row.slug,
      categoryId: row.category_id || 'communication',
      categoryName: row.category_name,
      tagBadge: formatSummary,
      typeBadge: row.type_badge,
      title: row.title,
      description: shortDescription,
      duration: totalDuration,
      rating: parseFloat(row.rating || 5.0),
      reviewsCount: row.reviews_count,
      studentsCount: row.students_count,
      status: row.status || 'PUBLISHED',
      lastUpdated: row.last_updated,
      price: row.price,
      originalPrice: row.original_price,
      discountPercent: row.discount_percent,
      image: normalizedImage,
      videoDemoTitle: (row.video_demo_title || 'Xem video demo bài giảng').replace(/\s*\(\s*\d+\s*phút\s*\)/gi, '').trim(),
      videoDemoDuration: totalDuration,
      videoDemoSubtitle: row.video_demo_subtitle || 'Phương pháp phản xạ tình huống độc quyền',
      videoUrl: normalizedVideoUrl,
      benefits: row.benefits,
      curriculum: {
        ...rawCurriculum,
        summary: formatSummary,
        totalDuration,
        sections: Array.isArray(rawCurriculum.sections) ? rawCurriculum.sections : [],
      },
      faqs: courseFaqs,
      seoTitle: row.seo_title || row.title,
      seoDescription: row.seo_description || shortDescription || '',
      ogImage: normalizedOgImage,
      meta: formatSummary.split('•')[0].trim(),
      highlights: Array.isArray(row.benefits) ? row.benefits.map((b: any) => b.title) : [],
      isFeatured,
      badge: isFeatured
        ? { text: 'Bán chạy', variant: 'danger' }
        : row.discount_percent > 95
        ? { text: 'Ưu đãi sốc', variant: 'primary' }
        : undefined,
    };

    // BẢO MẬT P0 (C5 & BR-02):
    // 1. DTO công khai: Tuyệt đối KHÔNG trả realRevenue, buyersCount, createdCount, viewsCount, bankInfo, resourceLink
    // 2. Chỉ trả về các số liệu nhạy cảm kinh doanh & thông tin quản trị khi là Quản trị viên (CMS) đã xác thực
    if (isAdmin) {
      dto.viewsCount = row.views_count ? parseInt(row.views_count, 10) : 0;
      dto.buyersCount = row.buyers_count !== undefined ? parseInt(row.buyers_count, 10) : 0;
      dto.realRevenue = row.real_revenue !== undefined ? parseInt(row.real_revenue, 10) : 0;
      dto.createdCount = row.created_count !== undefined ? parseInt(row.created_count, 10) : 0;
      dto.bankInfo = row.bank_info;
      dto.resourceLink = row.resource_link || '';
      dto.resource_link = row.resource_link || '';
    }

    return dto;
  }
}
