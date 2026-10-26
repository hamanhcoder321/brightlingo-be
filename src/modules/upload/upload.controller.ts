import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { SecurityUtil } from '@/common/security/security.util';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { StorageService } from '@/core/storage';

const ALLOWED_VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov']);
const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif']);

const videoStorage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = join(process.cwd(), 'uploads', 'videos');
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const randomHex = randomBytes(16).toString('hex');
    const ext = extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_VIDEO_EXTS.has(ext) ? ext : '.mp4';
    cb(null, `video-${Date.now()}-${randomHex}${safeExt}`);
  },
});

const imageStorage = diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = join(process.cwd(), 'uploads', 'images');
    if (!existsSync(uploadPath)) {
      mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const randomHex = randomBytes(16).toString('hex');
    const ext = extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_IMAGE_EXTS.has(ext) ? ext : '.jpg';
    cb(null, `image-${Date.now()}-${randomHex}${safeExt}`);
  },
});

@UseGuards(AuthGuard)
@Controller('api/upload')
export class UploadController {
  constructor(private readonly storageService: StorageService) {}

  private getPublicBaseUrl(req: Request): string {
    const configuredPublicUrl = process.env.PUBLIC_URL || process.env.BACKEND_URL;
    if (configuredPublicUrl) {
      return configuredPublicUrl.trim().replace(/\/+$/, '');
    }
    const host = req.get('host') || 'localhost:4000';
    const isHttps =
      req.get('x-forwarded-proto') === 'https' ||
      req.protocol === 'https' ||
      (!host.startsWith('localhost') && !host.startsWith('127.0.0.1'));
    const protocol = isHttps ? 'https' : 'http';
    return `${protocol}://${host}`;
  }

  @Post('video')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: videoStorage,
      limits: { fileSize: 200 * 1024 * 1024 }, // 200MB max
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime'];
        if (ALLOWED_VIDEO_EXTS.has(ext) && (allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('video/'))) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Định dạng video không được hỗ trợ. Chỉ chấp nhận .mp4 hoặc .webm.'), false);
        }
      },
    }),
  )
  async uploadVideo(@UploadedFile() file: any, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('Không tìm thấy tệp video được tải lên.');
    }

    let fileUrl: string;

    // Tích hợp Cloudflare R2 Object Storage bền vững (Task C1)
    if (this.storageService.isR2Configured()) {
      try {
        const buffer = readFileSync(file.path);
        const r2Key = `videos/${file.filename}`;
        fileUrl = await this.storageService.uploadFile(
          buffer,
          r2Key,
          file.mimetype || 'video/mp4',
        );
        // Dọn dẹp tệp tạm trên ổ đĩa server vì đã lưu trên R2
        try {
          unlinkSync(file.path);
        } catch {}
      } catch (r2Err: any) {
        // Fallback sang local disk nếu kết nối R2 gặp sự cố
        const baseUrl = this.getPublicBaseUrl(req);
        fileUrl = `${baseUrl}/uploads/videos/${file.filename}`;
      }
    } else {
      const baseUrl = this.getPublicBaseUrl(req);
      fileUrl = `${baseUrl}/uploads/videos/${file.filename}`;
    }

    return {
      success: true,
      url: fileUrl,
      filename: file.filename,
      originalName: SecurityUtil.sanitizeText(file.originalname),
      size: file.size,
    };
  }

  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: imageStorage,
      limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
      fileFilter: (req, file, cb) => {
        const ext = extname(file.originalname).toLowerCase();
        if (ALLOWED_IMAGE_EXTS.has(ext) && (file.mimetype.startsWith('image/') || ext === '.svg')) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Chỉ hỗ trợ tệp hình ảnh an toàn (.jpg, .png, .webp, .svg, .gif).'), false);
        }
      },
    }),
  )
  async uploadImage(@UploadedFile() file: any, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('Không tìm thấy tệp ảnh được tải lên.');
    }

    // BẢO VỆ XSS: Quét nội dung tệp SVG nếu có
    const ext = extname(file.filename).toLowerCase();
    if (ext === '.svg' || file.mimetype.includes('svg')) {
      try {
        const svgContent = readFileSync(file.path, 'utf8');
        if (!SecurityUtil.isSafeSvg(svgContent)) {
          // Xóa ngay tệp độc hại khỏi đĩa
          unlinkSync(file.path);
          throw new BadRequestException('Phát hiện tệp SVG chứa mã độc hại nguy hiểm (chứa thẻ script hoặc sự kiện thực thi mã). Tệp đã bị hủy!');
        }
      } catch (err: any) {
        if (existsSync(file.path)) {
          unlinkSync(file.path);
        }
        throw err instanceof BadRequestException ? err : new BadRequestException('Tệp SVG không hợp lệ hoặc chứa mã độc.');
      }
    }

    let fileUrl: string;

    // Tích hợp Cloudflare R2 Object Storage bền vững (Task C1)
    if (this.storageService.isR2Configured()) {
      try {
        const buffer = readFileSync(file.path);
        const r2Key = `images/${file.filename}`;
        fileUrl = await this.storageService.uploadFile(
          buffer,
          r2Key,
          file.mimetype || 'image/jpeg',
        );
        // Dọn dẹp tệp tạm trên ổ đĩa server vì đã lưu trên R2
        try {
          unlinkSync(file.path);
        } catch {}
      } catch (r2Err: any) {
        // Fallback sang local disk nếu kết nối R2 gặp sự cố
        const baseUrl = this.getPublicBaseUrl(req);
        fileUrl = `${baseUrl}/uploads/images/${file.filename}`;
      }
    } else {
      const baseUrl = this.getPublicBaseUrl(req);
      fileUrl = `${baseUrl}/uploads/images/${file.filename}`;
    }

    return {
      success: true,
      url: fileUrl,
      filename: file.filename,
      originalName: SecurityUtil.sanitizeText(file.originalname),
      size: file.size,
    };
  }
}
