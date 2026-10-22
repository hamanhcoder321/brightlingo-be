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
  uploadVideo(@UploadedFile() file: any, @Req() req: Request) {
    if (!file) {
      throw new BadRequestException('Không tìm thấy tệp video được tải lên.');
    }
    const host = req.get('host') || 'localhost:4000';
    const protocol = req.protocol || 'http';
    const fileUrl = `${protocol}://${host}/uploads/videos/${file.filename}`;

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
  uploadImage(@UploadedFile() file: any, @Req() req: Request) {
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

    const host = req.get('host') || 'localhost:4000';
    const protocol = req.protocol || 'http';
    const fileUrl = `${protocol}://${host}/uploads/images/${file.filename}`;

    return {
      success: true,
      url: fileUrl,
      filename: file.filename,
      originalName: SecurityUtil.sanitizeText(file.originalname),
      size: file.size,
    };
  }
}
