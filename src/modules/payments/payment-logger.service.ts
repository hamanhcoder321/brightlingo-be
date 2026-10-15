import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface PaymentSuccessLogParams {
  orderCode: string;
  amount: number;
  gateway: string;
  externalTransactionId?: string;
  customerEmail?: string;
  customerName?: string;
  bankAccountNumber?: string;
  transactionDate?: Date | string;
  notes?: string;
}

export interface PaymentCancelledLogParams {
  orderCode: string;
  reason?: string;
  cancelledBy?: 'USER' | 'ADMIN' | 'TIMEOUT';
  details?: any;
}

export interface PaymentErrorLogParams {
  context: string;
  errorMessage: string;
  orderCode?: string;
  payload?: any;
  stack?: string;
}

@Injectable()
export class PaymentLoggerService {
  private readonly consoleLogger = new Logger('PaymentLogger');
  private readonly logDir = path.resolve(process.cwd(), 'logs');
  private readonly logFile = path.resolve(this.logDir, 'payments.log');

  constructor() {
    this.ensureLogDirectory();
  }

  private ensureLogDirectory() {
    try {
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    } catch (err: any) {
      this.consoleLogger.error(`Could not create logs directory: ${err?.message}`);
    }
  }

  private getFormattedTimestamp(): string {
    const now = new Date();
    // Định dạng giờ Việt Nam: YYYY-MM-DD HH:mm:ss
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
  }

  private appendLine(level: string, message: string, extra?: any) {
    const time = this.getFormattedTimestamp();
    let line = `[${time}] [${level}] ${message}`;

    if (extra) {
      try {
        const extraStr = typeof extra === 'string' ? extra : JSON.stringify(extra);
        line += ` | DATA: ${extraStr}`;
      } catch {
        // bỏ qua nếu lỗi serialize
      }
    }

    line += '\n';

    // 1. Ghi ra file vật lý logs/payments.log
    try {
      fs.appendFileSync(this.logFile, line, 'utf8');
    } catch (err: any) {
      this.consoleLogger.error(`Failed to write to ${this.logFile}: ${err?.message}`);
    }

    // 2. Đồng thời in ra Console Terminal của NestJS
    if (level === 'ERROR' || level === 'SERVER_ERROR') {
      this.consoleLogger.error(message);
    } else if (level === 'CANCELLED' || level === 'EXPIRED') {
      this.consoleLogger.warn(message);
    } else {
      this.consoleLogger.log(message);
    }
  }

  // 1. Log khi thanh toán thành công
  logSuccess(params: PaymentSuccessLogParams) {
    const formattedAmount = Number(params.amount).toLocaleString('vi-VN') + ' đ';
    const msg = `THANH TOÁN THÀNH CÔNG | Mã đơn: #${params.orderCode} | Số tiền: ${formattedAmount} | Cổng: ${params.gateway} | Mã GD Ngân hàng: ${params.externalTransactionId || 'N/A'} | Khách hàng: ${params.customerName || 'N/A'} (${params.customerEmail || 'N/A'})`;
    this.appendLine('SUCCESS', msg, {
      accountNumber: params.bankAccountNumber,
      txDate: params.transactionDate,
      notes: params.notes,
    });
  }

  // 2. Log khi đơn thanh toán bị hủy
  logCancelled(params: PaymentCancelledLogParams) {
    const msg = `GIAO DỊCH BỊ HỦY | Mã đơn: #${params.orderCode} | Lý do: ${params.reason || 'Người dùng hủy thanh toán'} | Nguồn hủy: ${params.cancelledBy || 'USER'}`;
    this.appendLine('CANCELLED', msg, params.details);
  }

  // 3. Log khi đơn thanh toán hết hạn (quá 10 phút đếm ngược)
  logExpired(orderCode: string, details?: any) {
    const msg = `GIAO DỊCH HẾT HẠN (EXPIRED) | Mã đơn: #${orderCode} | Hết hạn 10 phút chờ thanh toán`;
    this.appendLine('EXPIRED', msg, details);
  }

  // 4. Log khi gặp lỗi Server, lỗi Webhook, lỗi Database Rollback
  logServerError(params: PaymentErrorLogParams) {
    const orderStr = params.orderCode ? ` | Mã đơn: #${params.orderCode}` : '';
    const msg = `LỖI SERVER THANH TOÁN [${params.context}]${orderStr} | Lỗi: ${params.errorMessage}`;
    this.appendLine('SERVER_ERROR', msg, {
      payload: params.payload,
      stack: params.stack,
    });
  }

  // 5. Log khi nhận Webhook từ cổng thanh toán
  logWebhookReceived(gateway: string, payload: any) {
    const orderCode = payload?.data?.orderCode || payload?.orderCode || 'N/A';
    const amount = payload?.data?.amount || payload?.amount || 'N/A';
    const msg = `NHẬN WEBHOOK TỪ ${gateway} | Mã đơn: #${orderCode} | Số tiền: ${amount} | Mã trạng thái: ${payload?.code || 'N/A'}`;
    this.appendLine('WEBHOOK_RECEIVED', msg, payload);
  }

  // 6. Log khi chữ ký Webhook bị sai lệch (nghi vấn giả mạo)
  logSignatureFailed(gateway: string, payload: any, errorReason: string) {
    const msg = `CẢNH BÁO CHỮ KÝ WEBHOOK KHÔNG HỢP LỆ (${gateway}) | Nguyên nhân: ${errorReason}`;
    this.appendLine('SECURITY_WARNING', msg, payload);
  }

  // 7. Log gửi email giao tài liệu thành công
  logEmailSuccess(orderCode: string, recipient: string, messageId?: string) {
    const msg = `GỬI EMAIL THÀNH CÔNG | Mã đơn: #${orderCode} | Người nhận: ${recipient} | MessageID: ${messageId || 'N/A'}`;
    this.appendLine('EMAIL_SUCCESS', msg);
  }

  // 8. Log gửi email giao tài liệu thất bại
  logEmailFailed(orderCode: string, recipient: string, error: string) {
    const msg = `GỬI EMAIL THẤT BẠI | Mã đơn: #${orderCode} | Người nhận: ${recipient} | Lỗi: ${error}`;
    this.appendLine('EMAIL_FAILED', msg);
  }
}
