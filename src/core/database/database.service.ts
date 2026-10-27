import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const rawUrl =
      process.env.DATABASE_URL ||
      this.configService.get<string>('database.url') ||
      this.configService.get<string>('DATABASE_URL');
    const connectionString = rawUrl ? rawUrl.trim().replace(/^["']|["']$/g, '') : undefined;

    const host = this.configService.get<string>('database.host', 'localhost');
    const port = this.configService.get<number>('database.port', 5432);
    const user = this.configService.get<string>('database.user', 'postgres');
    const password = this.configService.get<string>('database.password', 'admin');
    const database = this.configService.get<string>('database.name', 'brightlingo_db');

    // Phân tách rõ ràng giữa cấu hình Local và Production / Cloud Database
    const isExplicitSsl = process.env.DB_SSL !== undefined;
    const useSsl = isExplicitSsl
      ? process.env.DB_SSL === 'true'
      : Boolean(
          (connectionString && (connectionString.includes('sslmode=require') || connectionString.includes('ssl=true') || connectionString.includes('neon.tech'))) ||
          (!connectionString && host !== 'localhost' && host !== '127.0.0.1'),
        );

    const isCloudDb = Boolean(
      (connectionString && !connectionString.includes('localhost') && !connectionString.includes('127.0.0.1')) ||
      (host !== 'localhost' && host !== '127.0.0.1'),
    );

    this.pool = connectionString
      ? new Pool({
          connectionString,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        })
      : new Pool({
          host,
          port,
          user,
          password,
          database,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
        });

    const modeLabel = isCloudDb ? 'REMOTE/CLOUD' : 'LOCAL';
    this.logger.log(`PostgreSQL Pool initialized [Mode: ${modeLabel}] (${connectionString ? (isCloudDb ? 'Cloud DATABASE_URL' : 'Local DATABASE_URL') : `${host}:${port}/${database}`}, SSL: ${useSsl})`);

    if (isCloudDb && process.env.NODE_ENV !== 'production') {
      this.logger.warn(`⚠️ CẢNH BÁO: Đang chạy ở môi trường development (${process.env.NODE_ENV || 'local'}) nhưng kết nối tới CSDL Cloud/Remote! Mọi thay đổi dữ liệu sẽ ảnh hưởng trực tiếp tới hệ thống Cloud.`);
    }
  }

  async query<T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> {
    return this.pool.query<T>(text, params);
  }

  getPool(): Pool {
    return this.pool;
  }

  async onModuleDestroy() {
    this.logger.log('Closing PostgreSQL Connection Pool...');
    await this.pool.end();
  }
}
