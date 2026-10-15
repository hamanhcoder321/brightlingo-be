import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = ctxGetRequest(context);
    const authHeader = request.headers['authorization'];

    if (!authHeader) {
      throw new UnauthorizedException('Thiếu Authorization Header');
    }

    // Phase 1 đơn giản: Hỗ trợ Bearer Token hoặc CMS Static Secret
    const token = authHeader.replace(/^Bearer\s+/, '');
    if (!token) {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    return true;
  }
}

function ctxGetRequest(context: ExecutionContext) {
  return context.switchToHttp().getRequest();
}
