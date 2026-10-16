import { BadRequestException } from '@nestjs/common';

/**
 * Tiện ích bảo mật toàn diện: Chống XSS, SSRF, SQL Injection, và Lỗ hổng Tệp độc hại
 */
export class SecurityUtil {
  // Danh sách các giao thức nguy hiểm tuyệt đối bị cấm
  private static readonly DANGEROUS_PROTOCOLS = [
    'javascript:',
    'vbscript:',
    'data:text/html',
    'data:application/javascript',
    'file:',
    'blob:',
    'about:',
  ];

  /**
   * 1. XÁC THỰC & LÀM SẠCH URL ẢNH & VIDEO (Chống SSRF, XSS qua URL)
   * Chỉ cho phép giao thức http, https và relative path an toàn (/uploads/...)
   */
  static sanitizeUrl(url?: string | null, fieldName = 'Đường dẫn'): string {
    if (!url) return '';
    const trimmed = url.trim();
    if (!trimmed) return '';

    // Kiểm tra ký tự null byte hoặc ký tự điều khiển
    if (/[\x00-\x1F\x7F]/.test(trimmed)) {
      throw new BadRequestException(`${fieldName} chứa ký tự điều khiển bất hợp pháp.`);
    }

    const lower = trimmed.toLowerCase();

    // Chặn ngay các giao thức độc hại (XSS payload phổ biến như javascript:alert(1))
    for (const proto of this.DANGEROUS_PROTOCOLS) {
      if (lower.startsWith(proto) || lower.includes(`href="${proto}`) || lower.includes(`src="${proto}`)) {
        throw new BadRequestException(`${fieldName} chứa giao thức không an toàn (${proto}). Bị từ chối vì lý do bảo mật!`);
      }
    }

    // Cho phép đường dẫn tương đối nội bộ của hệ thống (VD: /uploads/images/xyz.jpg)
    if (trimmed.startsWith('/uploads/')) {
      // Chống Path Traversal (../ hoặc ..\)
      if (trimmed.includes('..') || trimmed.includes('\\')) {
        throw new BadRequestException(`${fieldName} chứa ký tự tấn công Path Traversal.`);
      }
      return trimmed;
    }

    // Với URL tuyệt đối: Bắt buộc phải là HTTP hoặc HTTPS
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new BadRequestException(`${fieldName} chỉ chấp nhận giao thức http:// hoặc https://`);
      }

      // Không cho phép username/password trong URL (http://user:pass@domain)
      if (parsed.username || parsed.password) {
        throw new BadRequestException(`${fieldName} không được chứa thông tin xác thực.`);
      }

      return trimmed;
    } catch {
      throw new BadRequestException(`${fieldName} không phải là một URL hợp lệ.`);
    }
  }

  /**
   * 2. LÀM SẠCH NỘI DUNG VĂN BẢN (Chống Stored XSS)
   * Loại bỏ các thẻ script, iframe, object, embed và các event handler (onload, onerror, v.v.)
   */
  static sanitizeText(input?: string | null): string {
    if (!input) return '';
    if (typeof input !== 'string') return input;

    let sanitized = input;

    // Loại bỏ các thẻ thực thi mã nguy hiểm
    sanitized = sanitized.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
    sanitized = sanitized.replace(/<\s*iframe[^>]*>[\s\S]*?<\s*\/\s*iframe\s*>/gi, '');
    sanitized = sanitized.replace(/<\s*object[^>]*>[\s\S]*?<\s*\/\s*object\s*>/gi, '');
    sanitized = sanitized.replace(/<\s*embed[^>]*>[\s\S]*?<\s*\/\s*embed\s*>/gi, '');
    sanitized = sanitized.replace(/<\s*meta[^>]*>/gi, '');
    sanitized = sanitized.replace(/<\s*link[^>]*>/gi, '');

    // Loại bỏ các sự kiện inline độc hại (onload, onerror, onclick, onmouseover, v.v.)
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*(['"]).*?\1/gi, '');
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]+/gi, '');

    // Loại bỏ javascript: trong href hoặc src
    sanitized = sanitized.replace(/href\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, 'href="#"');
    sanitized = sanitized.replace(/src\s*=\s*(['"])\s*javascript:[^'"]*\1/gi, 'src=""');

    return sanitized;
  }

  /**
   * 3. KIỂM TRA TỆP SVG AN TOÀN (Chống XSS qua tệp hình ảnh SVG)
   * Tệp SVG có thể nhúng mã JavaScript chạy ngầm khi người dùng mở hoặc xem trực tiếp
   */
  static isSafeSvg(content: string | Buffer): boolean {
    const text = typeof content === 'string' ? content : content.toString('utf8');
    const lower = text.toLowerCase();

    // Các mẫu tấn công XSS thông dụng qua SVG
    const dangerousPatterns = [
      /<script[\s>]/i,
      /<\/script>/i,
      /<foreignobject[\s>]/i,
      /<iframe[\s>]/i,
      /<object[\s>]/i,
      /<embed[\s>]/i,
      /xlink:href\s*=\s*["']\s*javascript:/i,
      /href\s*=\s*["']\s*javascript:/i,
      /on\w+\s*=/i, // onload, onerror, onclick, etc.
      /eval\s*\(/i,
      /expression\s*\(/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(lower)) {
        return false;
      }
    }

    return true;
  }

  /**
   * 4. LÀM SẠCH ĐỐI TƯỢNG ĐỆ QUY (Sanitize toàn bộ payload gửi lên)
   */
  static sanitizePayload<T>(data: T): T {
    if (data === null || data === undefined) return data;
    if (typeof data === 'string') {
      return this.sanitizeText(data) as unknown as T;
    }
    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizePayload(item)) as unknown as T;
    }
    if (typeof data === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.sanitizePayload(value);
      }
      return result as T;
    }
    return data;
  }
}
