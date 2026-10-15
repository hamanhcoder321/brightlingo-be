import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('app.port', 4000);
  const corsOrigins = configService.get<string[]>('app.corsOrigins', [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ]);

  // Cấu hình CORS cho Next.js Frontend
  app.enableCors({
    origin: corsOrigins,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  await app.listen(port);
  logger.log(`🚀 BrightLingo API is running at: http://localhost:${port}`);
  logger.log(`📚 Public Courses API: http://localhost:${port}/api/courses`);
  logger.log(`💳 Webhook BankNoti: http://localhost:${port}/api/webhooks/banknoti`);
  logger.log(`📊 CMS Admin Dashboard: http://localhost:${port}/api/admin/dashboard`);
}

void bootstrap();
