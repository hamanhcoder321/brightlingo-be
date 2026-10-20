import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { DatabaseService } from '@/core/database';
import { SecurityUtil } from '@/common/security/security.util';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly db: DatabaseService) {}

  // Tiếp nhận Lead đăng ký tư vấn 30 phút từ Landing page / Form tư vấn (Mục 13 BA)
  async create(dto: CreateLeadDto) {
    if (!dto.fullName || !dto.phone) {
      throw new BadRequestException('Vui lòng nhập đầy đủ họ tên và số điện thoại');
    }

    const cleanName = SecurityUtil.sanitizeText(dto.fullName);
    const cleanPhone = SecurityUtil.sanitizeText(dto.phone);
    const cleanEmail = dto.email ? SecurityUtil.sanitizeText(dto.email) : null;
    const targetCourseName = dto.courseName || dto.courseInterest || dto.courseTitle || null;
    const cleanCourseName = targetCourseName ? SecurityUtil.sanitizeText(targetCourseName) : null;

    let courseSlug = dto.courseSlug ? SecurityUtil.sanitizeText(dto.courseSlug) : null;
    if (!courseSlug && cleanCourseName) {
      courseSlug = cleanCourseName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
    }

    const rawNote = dto.note || dto.message || dto.notes;
    const cleanMessage = rawNote && rawNote.trim() ? SecurityUtil.sanitizeText(rawNote.trim()) : null;
    const cleanRef = dto.ref ? SecurityUtil.sanitizeText(dto.ref) : null;
    const cleanLandingUrl = dto.landingUrl ? SecurityUtil.sanitizeText(dto.landingUrl) : null;
    const cleanReferrerUrl = dto.referrerUrl ? SecurityUtil.sanitizeText(dto.referrerUrl) : null;

    // Xác định chính xác nguồn trang gửi thông tin
    let pageSource = dto.source ? SecurityUtil.sanitizeText(dto.source) : null;
    if (!pageSource) {
      if (cleanLandingUrl) {
        if (cleanLandingUrl.includes('/register') || cleanLandingUrl.includes('/dang-ky')) {
          pageSource = 'Trang đăng ký';
        } else if (cleanLandingUrl.includes('/khoa-hoc')) {
          pageSource = 'Trang khóa học';
        } else {
          pageSource = 'Trang chủ';
        }
      } else {
        pageSource = 'Trang chủ';
      }
    }

    // Chuẩn hóa nguồn đầu vào (Ưu tiên: Chiến dịch Marketing > Ref > Nguồn trang cụ thể)
    let cleanUtmSource: string = pageSource;
    if (dto.utmSource && dto.utmSource.trim()) {
      const raw = dto.utmSource.trim().toLowerCase();
      if (raw === 'facebook' || raw === 'fb') {
        cleanUtmSource = 'Facebook';
      } else if (raw === 'google' || raw === 'adwords' || raw === 'cpc') {
        cleanUtmSource = 'Google';
      } else if (raw === 'tiktok') {
        cleanUtmSource = 'TikTok';
      } else if (raw === 'zalo') {
        cleanUtmSource = 'Zalo';
      } else if (raw === 'youtube') {
        cleanUtmSource = 'YouTube';
      } else if (raw === 'organic' || raw === 'direct') {
        cleanUtmSource = pageSource;
      } else {
        cleanUtmSource = SecurityUtil.sanitizeText(dto.utmSource);
      }
    } else if (cleanRef) {
      cleanUtmSource = `Ref: ${cleanRef}`;
    }

    const cleanUtmMedium = dto.utmMedium ? SecurityUtil.sanitizeText(dto.utmMedium) : 'website_form';
    const cleanUtmCampaign = dto.utmCampaign ? SecurityUtil.sanitizeText(dto.utmCampaign) : null;

    const res = await this.db.query(
      `INSERT INTO consultation_leads (
        full_name, phone, email, course_slug, course_name, message, status,
        ref, utm_source, utm_medium, utm_campaign, landing_url, referrer_url, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, 'NEW', $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING id, created_at`,
      [
        cleanName,
        cleanPhone,
        cleanEmail,
        courseSlug,
        cleanCourseName,
        cleanMessage,
        cleanRef,
        cleanUtmSource,
        cleanUtmMedium,
        cleanUtmCampaign,
        cleanLandingUrl,
        cleanReferrerUrl,
      ],
    );

    this.logger.log(`New lead received: ${dto.fullName} - ${dto.phone} [Nguồn: ${cleanUtmSource}] (${cleanCourseName || 'General'})`);

    return {
      success: true,
      message: 'Đăng ký tư vấn thành công! Chuyên viên sẽ liên hệ với bạn trong 30 phút.',
      leadId: res.rows[0].id,
      data: {
        id: res.rows[0].id,
        source: cleanUtmSource,
        createdAt: res.rows[0].created_at,
      },
    };
  }

  // Danh sách Lead cho CMS Admin (Hỗ trợ tìm kiếm, lọc theo trạng thái)
  async getAllForAdmin(params?: { status?: string; search?: string }) {
    let sql = `SELECT * FROM consultation_leads WHERE deleted_at IS NULL`;
    const queryParams: any[] = [];

    if (params?.status) {
      const s = params.status.trim().toUpperCase();
      queryParams.push(s);
      sql += ` AND UPPER(status) = $${queryParams.length}`;
    }

    if (params?.search) {
      queryParams.push(`%${params.search.trim()}%`);
      sql += ` AND (full_name ILIKE $${queryParams.length} OR phone ILIKE $${queryParams.length} OR email ILIKE $${queryParams.length} OR course_name ILIKE $${queryParams.length} OR utm_source ILIKE $${queryParams.length} OR utm_campaign ILIKE $${queryParams.length})`;
    }

    sql += ` ORDER BY created_at DESC`;

    const res = await this.db.query(sql, queryParams);

    const statusMap: Record<string, string> = {
      NEW: 'New',
      CONTACTED: 'Contacted',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
    };

    const items = res.rows.map((row) => ({
      ...row,
      course_title: row.course_name || row.course_slug || 'Tư vấn tổng quát',
      status: statusMap[row.status] || row.status,
      raw_status: row.status,
      ref_code: row.ref,
    }));

    const statsRes = await this.db.query(
      `SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE UPPER(status) = 'NEW')::int AS new,
        COUNT(*) FILTER (WHERE UPPER(status) = 'CONTACTED')::int AS contacted,
        COUNT(*) FILTER (WHERE UPPER(status) = 'COMPLETED')::int AS completed
       FROM consultation_leads WHERE deleted_at IS NULL`,
    );

    return {
      items,
      total: items.length,
      stats: {
        total: statsRes.rows[0]?.total || 0,
        new: statsRes.rows[0]?.new || 0,
        contacted: statsRes.rows[0]?.contacted || 0,
        completed: statsRes.rows[0]?.completed || 0,
      },
    };
  }

  // Cập nhật trạng thái và ghi chú tư vấn cho Admin CMS
  async updateStatus(id: string, status: string, notes?: string) {
    if (!id) {
      throw new BadRequestException('Lead ID không hợp lệ');
    }

    const cleanStatus = (status || 'NEW').trim().toUpperCase();
    const cleanNotes = notes !== undefined && notes !== null ? SecurityUtil.sanitizeText(notes) : null;

    let res;
    if (notes !== undefined && notes !== null) {
      res = await this.db.query(
        `UPDATE consultation_leads 
         SET status = $1, notes = $2, updated_at = NOW() 
         WHERE id = $3 AND deleted_at IS NULL 
         RETURNING *`,
        [cleanStatus, cleanNotes, id],
      );
    } else {
      res = await this.db.query(
        `UPDATE consultation_leads 
         SET status = $1, updated_at = NOW() 
         WHERE id = $2 AND deleted_at IS NULL 
         RETURNING *`,
        [cleanStatus, id],
      );
    }

    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy lead với ID ${id}`);
    }

    const row = res.rows[0];
    const statusMap: Record<string, string> = {
      NEW: 'New',
      CONTACTED: 'Contacted',
      COMPLETED: 'Completed',
      CANCELLED: 'Cancelled',
    };

    return {
      ...row,
      course_title: row.course_name || row.course_slug || 'Tư vấn tổng quát',
      status: statusMap[row.status] || row.status,
      raw_status: row.status,
      ref_code: row.ref,
    };
  }

  // Đếm số lượng lead mới chưa tư vấn cho badge CMS
  async countNew() {
    const res = await this.db.query(
      `SELECT COUNT(*)::int AS count FROM consultation_leads WHERE deleted_at IS NULL AND UPPER(status) = 'NEW'`,
    );
    return { count: res.rows[0]?.count || 0 };
  }

  // Xóa mềm lead
  async delete(id: string) {
    await this.db.query(
      `UPDATE consultation_leads SET deleted_at = NOW() WHERE id = $1`,
      [id],
    );
    return { success: true };
  }
}
