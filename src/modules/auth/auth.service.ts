import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '@/core/database';
import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'crypto';
import { SecurityUtil } from '@/common/security/security.util';
import { LoginDto } from './dto/login.dto';

interface FailedAttempt {
  count: number;
  lastAttempt: number;
  lockedUntil?: number;
}

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  // BẢO VỆ CHỐNG BRUTE-FORCE / TẤN CÔNG TỪ ĐIỂN: Theo dõi lần đăng nhập lỗi theo IP
  private readonly failedLogins = new Map<string, FailedAttempt>();

  constructor(
    private readonly db: DatabaseService,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') ||
      'brightlingo_secure_jwt_secret_key_2026_super_safe_token';
  }

  async onModuleInit() {
    await this.seedDefaultAdmin();
  }

  /**
   * Tạo tài khoản SuperAdmin mặc định nếu cơ sở dữ liệu chưa có tài khoản nào
   */
  private async seedDefaultAdmin() {
    try {
      const res = await this.db.query('SELECT COUNT(*) as count FROM admins');
      const count = parseInt(res.rows[0]?.count || '0', 10);
      if (count === 0) {
        const defaultEmail = 'admin@brightlingo.vn';
        const defaultPass = 'Admin@123456';
        const hash = this.hashPassword(defaultPass);

        await this.db.query(
          `INSERT INTO admins (username, email, password_hash, full_name, role, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, true, NOW())`,
          ['admin', defaultEmail, hash, 'Quản trị viên Hệ thống', 'superadmin'],
        );
        this.logger.log(`✅ Khởi tạo tài khoản Quản trị viên mặc định: ${defaultEmail} / [Mật khẩu bảo mật]`);
      }
    } catch (err: any) {
      this.logger.error(`Lỗi kiểm tra/khởi tạo bảng admins: ${err.message}`);
    }
  }

  /**
   * Mã hóa mật khẩu bằng thuật toán scrypt với Salt ngẫu nhiên 16 bytes (Chuẩn OWASP)
   */
  hashPassword(password: string): string {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = scryptSync(password, salt, 64);
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  /**
   * So sánh mật khẩu an toàn, chống tấn công dò thời gian (Timing Attack Safe)
   */
  verifyPassword(password: string, storedHash: string): boolean {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;

    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKeyBuffer = scryptSync(password, salt, 64);

    return (
      keyBuffer.length === derivedKeyBuffer.length &&
      timingSafeEqual(keyBuffer, derivedKeyBuffer)
    );
  }

  /**
   * Sinh Token HMAC-SHA256 có chữ ký và thời hạn hợp lệ
   */
  generateToken(user: { id: string; email: string; role: string }): string {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        sub: user.id,
        email: user.email,
        role: user.role,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // Hết hạn sau 24h
        iat: Math.floor(Date.now() / 1000),
      }),
    ).toString('base64url');

    const signature = createHmac('sha256', this.jwtSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    return `${header}.${payload}.${signature}`;
  }

  /**
   * Xác thực và giải mã Token
   */
  verifyToken(token: string): any {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new UnauthorizedException('Token không hợp lệ.');
    }
    const [header, payload, signature] = parts;
    const expectedSignature = createHmac('sha256', this.jwtSecret)
      .update(`${header}.${payload}`)
      .digest('base64url');

    const sigBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException('Chữ ký Token không hợp lệ.');
    }

    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      throw new UnauthorizedException('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    return decoded;
  }

  /**
   * ĐĂNG NHẬP QUẢN TRỊ VIÊN (Bảo vệ 3 lớp: Chống Brute-Force, Chống SQLi bằng Parameterized Query, Timing Safe)
   */
  async login(dto: LoginDto, clientIp: string) {
    const now = Date.now();
    const cleanEmail = SecurityUtil.sanitizeText(dto.email).toLowerCase().trim();
    const rawPassword = dto.password;

    // 1. Kiểm tra khóa IP do thử sai quá 5 lần (Brute-force protection)
    const ipAttempt = this.failedLogins.get(clientIp);
    if (ipAttempt && ipAttempt.lockedUntil && ipAttempt.lockedUntil > now) {
      const waitMinutes = Math.ceil((ipAttempt.lockedUntil - now) / 60000);
      throw new BadRequestException(
        `Địa chỉ IP của bạn bị tạm khóa do nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau ${waitMinutes} phút.`,
      );
    }

    // 2. Truy vấn an toàn tuyệt đối bằng Parameterized Query ($1), không thể bị SQL Injection
    const res = await this.db.query(
      `SELECT id, username, email, password_hash, full_name, role, is_active 
       FROM admins 
       WHERE LOWER(email) = $1 AND is_active = true`,
      [cleanEmail],
    );

    const admin = res.rows[0];

    // 3. Xác thực mật khẩu
    let isPasswordValid = false;
    if (admin) {
      try {
        isPasswordValid = this.verifyPassword(rawPassword, admin.password_hash);
      } catch {
        isPasswordValid = false;
      }
    }

    if (!admin || !isPasswordValid) {
      // Ghi nhận lỗi đăng nhập và tăng đếm
      const currentFail = (ipAttempt?.count || 0) + 1;
      const lockedUntil = currentFail >= 5 ? now + 15 * 60 * 1000 : undefined; // Khóa 15 phút nếu sai 5 lần
      this.failedLogins.set(clientIp, {
        count: currentFail,
        lastAttempt: now,
        lockedUntil,
      });

      this.logger.warn(
        `Đăng nhập thất bại cho email: ${cleanEmail} từ IP: ${clientIp}. Lần thử: ${currentFail}/5`,
      );

      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    // Đăng nhập thành công -> Xóa bộ đếm lỗi của IP
    this.failedLogins.delete(clientIp);

    const user = {
      id: String(admin.id),
      name: admin.full_name,
      email: admin.email,
      role: (admin.role || 'admin').toLowerCase(),
    };

    const accessToken = this.generateToken(user);

    this.logger.log(`Quản trị viên đăng nhập thành công: ${user.email} (${clientIp})`);

    return {
      accessToken,
      user,
    };
  }

  /**
   * Lấy thông tin hồ sơ Quản trị viên
   */
  async getProfile(userId: string) {
    const res = await this.db.query(
      `SELECT id, username, email, full_name, role, is_active 
       FROM admins 
       WHERE id = $1 AND is_active = true`,
      [userId],
    );

    if (res.rows.length === 0) {
      throw new UnauthorizedException('Tài khoản không tồn tại hoặc đã bị khóa.');
    }

    const admin = res.rows[0];
    return {
      id: String(admin.id),
      name: admin.full_name,
      email: admin.email,
      role: (admin.role || 'admin').toLowerCase(),
    };
  }
}
