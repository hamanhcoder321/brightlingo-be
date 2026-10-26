import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import {
  appConfig,
  databaseConfig,
  mailConfig,
  paymentConfig,
  storageConfig,
} from '@/config';

import { DatabaseModule, MailModule, StorageModule } from '@/core';
import { HttpExceptionFilter, LoggingInterceptor } from '@/common';

import {
  CoursesModule,
  OrdersModule,
  PaymentsModule,
  CouponsModule,
  LeadsModule,
  EmailModule,
  PagesModule,
  SettingsModule,
  AuditModule,
  AdminModule,
  UploadModule,
  AuthModule,
} from '@/modules';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, mailConfig, paymentConfig, storageConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    DatabaseModule,
    MailModule,
    StorageModule,
    AuditModule,
    CoursesModule,
    OrdersModule,
    PaymentsModule,
    CouponsModule,
    LeadsModule,
    EmailModule,
    PagesModule,
    SettingsModule,
    AdminModule,
    UploadModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
  ],
})
export class AppModule {}
