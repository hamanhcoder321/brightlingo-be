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
}
