import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResult, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  private pool: Pool;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const connectionString = process.env.DATABASE_URL;
    const host = this.configService.get<string>('database.host', 'localhost');
    const port = this.configService.get<number>('database.port', 5432);
    const user = this.configService.get<string>('database.user', 'postgres');
    const password = this.configService.get<string>('database.password', 'admin');
    const database = this.configService.get<string>('database.name', 'brightlingo_db');
    const useSsl =
      process.env.DB_SSL === 'true' ||
      (connectionString && connectionString.includes('sslmode=')) ||
      (host !== 'localhost' && host !== '127.0.0.1');

    this.pool = connectionString
      ? new Pool({
          connectionString,
          ssl: useSsl ? { rejectUnauthorized: false } : false,
          max: 20,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 5000,
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

    this.logger.log(`PostgreSQL Pool initialized (${connectionString ? 'DATABASE_URL' : `${host}:${port}/${database}`})`);
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
