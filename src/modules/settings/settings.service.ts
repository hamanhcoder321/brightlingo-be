import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/core/database';

@Injectable()
export class SettingsService {
  constructor(private readonly db: DatabaseService) {}

  // Lấy danh sách cấu hình công khai (Branding, Support, SEO) theo Mục 14.1 BA
  async getPublicSettings() {
    const res = await this.db.query(
      `SELECT group_name, key, value FROM settings WHERE group_name IN ('BRANDING', 'SUPPORT', 'SEO')`,
    );

    const result: Record<string, string> = {};
    for (const row of res.rows) {
      result[row.key] = row.value;
    }
    return result;
  }
}
