import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '@/core/database';

export interface LogAuditOptions {
  adminId?: number;
  adminName?: string;
  action: string;
  targetEntity: string;
  targetId: string;
  details?: any;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly db: DatabaseService) {}

  // Ghi nhật ký thao tác nhạy cảm của Admin theo Mục 16.2 BA
  async log(options: LogAuditOptions) {
    try {
      await this.db.query(
        `INSERT INTO audit_logs (
          admin_id, admin_name, action, target_entity, target_id, details, ip_address
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          options.adminId || null,
          options.adminName || 'System',
          options.action,
          options.targetEntity,
          options.targetId,
          JSON.stringify(options.details || {}),
          options.ipAddress || null,
        ],
      );
    } catch (err) {
      this.logger.error('Failed to write audit log:', err);
    }
  }

  // Lấy danh sách lịch sử thao tác của Admin cho CMS
  async getLogs(params?: any) {
    const page = Math.max(1, parseInt(params?.page || '1', 10));
    const limit = Math.max(1, Math.min(100, parseInt(params?.limit || '20', 10)));
    const offset = (page - 1) * limit;

    let query = `SELECT * FROM audit_logs`;
    let countQuery = `SELECT COUNT(*) as total FROM audit_logs`;
    const conditions: string[] = [];
    const values: any[] = [];

    if (params?.action) {
      values.push(params.action);
      conditions.push(`action = $${values.length}`);
    }
    if (params?.entity_type || params?.targetEntity) {
      values.push(params.entity_type || params.targetEntity);
      conditions.push(`target_entity = $${values.length}`);
    }

    if (conditions.length > 0) {
      const whereClause = ` WHERE ` + conditions.join(' AND ');
      query += whereClause;
      countQuery += whereClause;
    }

    query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;

    const [logsRes, countRes] = await Promise.all([
      this.db.query(query, [...values, limit, offset]),
      this.db.query(countQuery, values),
    ]);

    const total = parseInt(countRes.rows[0]?.total || '0', 10);
    const items = logsRes.rows.map((row) => ({
      id: String(row.id),
      action: row.action,
      entity_type: row.target_entity,
      entity_id: row.target_id,
      actor_name: row.admin_name || 'Quản trị viên',
      actor_email: 'admin@engnest.vn',
      metadata: typeof row.details === 'string' ? JSON.parse(row.details) : row.details || {},
      ip_address: row.ip_address,
      created_at: row.created_at,
      updated_at: row.created_at,
    }));

    return {
      items,
      total,
    };
  }
}
