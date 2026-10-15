import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '@/core/database';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(private readonly db: DatabaseService) {}

  // Tiếp nhận Lead đăng ký tư vấn 30 phút từ Landing page (Mục 13 BA)
  async create(dto: CreateLeadDto) {
    if (!dto.fullName || !dto.phone) {
      throw new BadRequestException('Vui lòng nhập đầy đủ họ tên và số điện thoại');
    }

    const res = await this.db.query(
      `INSERT INTO consultation_leads (
        full_name, phone, email, course_slug, course_name, message, status,
        ref, utm_source, utm_medium, utm_campaign
      ) VALUES ($1, $2, $3, $4, $5, $6, 'NEW', $7, $8, $9, $10)
      RETURNING id, created_at`,
      [
        dto.fullName,
        dto.phone,
        dto.email || null,
        dto.courseSlug || null,
        dto.courseName || null,
        dto.message || null,
        dto.ref || null,
        dto.utmSource || null,
        dto.utmMedium || null,
        dto.utmCampaign || null,
      ],
    );

    this.logger.log(`New lead received: ${dto.fullName} - ${dto.phone} (${dto.courseName || 'General'})`);

    return {
      success: true,
      message: 'Đăng ký tư vấn thành công! Chuyên viên sẽ liên hệ với bạn trong 30 phút.',
      leadId: res.rows[0].id,
    };
  }

  // Danh sách Lead cho CMS Admin
  async getAllForAdmin() {
    const res = await this.db.query(
      `SELECT * FROM consultation_leads WHERE deleted_at IS NULL ORDER BY created_at DESC`,
    );
    return res.rows;
  }
}
