import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Yêu cầu xác thực: Thiếu Authorization Header.');
    }

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Định dạng token không đúng (Yêu cầu: Bearer <token>).');
    }

    try {
      const decoded = this.authService.verifyToken(token);
      request.user = decoded;
      return true;
    } catch {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn.');
    }
  }
}
