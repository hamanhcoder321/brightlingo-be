import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response, Request } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    let clientMessage: any;
    if (exception instanceof HttpException) {
      clientMessage =
        typeof exceptionResponse === 'object' && exceptionResponse !== null
          ? (exceptionResponse as any).message || (exceptionResponse as any).error
          : exception.message;
    } else {
      // BẢO VỆ SERVER: Không làm lộ cấu trúc SQL, database, file system hoặc stack trace ra ngoài client
      clientMessage = 'Đã có lỗi hệ thống xử lý yêu cầu. Vui lòng thử lại hoặc liên hệ quản trị viên.';
    }

    const logDetail = exception instanceof Error ? exception.stack || exception.message : JSON.stringify(exception);
    this.logger.error(
      `[${request.method}] ${request.url} - Status: ${status} - Error: ${logDetail}`,
    );

    // Tự động ghi lại lỗi server (5xx) hoặc lỗi liên quan thanh toán/webhook vào file logs/payments.log
    if (status >= 500 || request.url.includes('webhook') || request.url.includes('payment') || request.url.includes('order')) {
      try {
        const fs = require('fs');
        const path = require('path');
        const logDir = path.resolve(process.cwd(), 'logs');
        if (!fs.existsSync(logDir)) {
          fs.mkdirSync(logDir, { recursive: true });
        }
        const now = new Date();
        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        const logLine = `[${timeStr}] [SERVER_ERROR] [${request.method}] ${request.url} | Status: ${status} | Error: ${logDetail} | IP: ${request.ip}\n`;
        fs.appendFileSync(path.resolve(logDir, 'payments.log'), logLine, 'utf8');
      } catch (fileErr) {
        this.logger.error('Failed to append to payments.log:', fileErr);
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: clientMessage,
    });
  }
}
