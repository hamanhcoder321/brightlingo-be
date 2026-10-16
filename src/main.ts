import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import * as express from 'express';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 1. BẢO VỆ HTTP HEADERS BẰNG HELMET (Chống MIME Sniffing, Clickjacking, XSS)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // Cho phép API hoạt động trơn tru với các client
      frameguard: { action: 'sameorigin' },
      noSniff: true,
      xssFilter: true,
    }),
  );

  // 2. GIỚI HẠN DUNG LƯỢNG PAYLOAD (Chống tấn công DoS Memory Exhaustion)
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true, limit: '5mb' }));

  // 3. CƠ CHẾ BẢO VỆ SERVER: RATE LIMITING (Chống DoS / Brute-force Flooding)
  const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
  app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket.remoteAddress ||
      '127.0.0.1';
    const now = Date.now();
    const windowMs = 60 * 1000; // 1 phút
    const maxRequests = 300; // Tối đa 300 requests / phút / IP

    const entry = rateLimitMap.get(ip) || { count: 0, resetTime: now + windowMs };
    if (now > entry.resetTime) {
      entry.count = 1;
      entry.resetTime = now + windowMs;
    } else {
      entry.count++;
    }
    rateLimitMap.set(ip, entry);

    if (entry.count > maxRequests) {
      return res.status(429).json({
        statusCode: 429,
        message: 'Hệ thống phát hiện tần suất yêu cầu bất thường từ IP của bạn. Vui lòng thử lại sau 1 phút.',
        error: 'Too Many Requests',
      });
    }
    next();
  });

  // 4. BẢO VỆ Ô NHẬP INPUT: Global ValidationPipe (Lọc sạch thuộc tính lạ, validate dữ liệu đầu vào)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động loại bỏ mọi trường dữ liệu không khai báo trong DTO
      transform: true, // Tự động chuyển đổi kiểu dữ liệu an toàn
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 4000);
  const corsOrigins = configService.get<string[]>('app.corsOrigins', [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:3001',
    'http://127.0.0.1:3001',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ]);

  // 5. CẤU HÌNH CORS CHẶT CHẼ
  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // Phục vụ tệp tĩnh tải lên (Video, Hình ảnh) từ thư mục uploads với đầy đủ CORS headers
  const uploadsPath = join(process.cwd(), 'uploads');
  app.use(
    '/uploads',
    express.static(uploadsPath, {
      setHeaders: (res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      },
    }),
  );

  await app.listen(port);
  logger.log(`🚀 BrightLingo API is running at: http://localhost:${port}`);
  logger.log(`📚 Public Courses API: http://localhost:${port}/api/courses`);
  logger.log(`💳 Webhook BankNoti: http://localhost:${port}/api/webhooks/banknoti`);
  logger.log(`📊 CMS Admin Dashboard: http://localhost:${port}/api/admin/dashboard`);
}

void bootstrap();
