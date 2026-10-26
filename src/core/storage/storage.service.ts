import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client | null = null;
  private readonly bucketName: string;
  private readonly publicUrl: string;
  private readonly isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled = this.configService.get<boolean>('storage.enabled', false);
    this.bucketName = this.configService.get<string>(
      'storage.bucketName',
      'engnest-media',
    );
    this.publicUrl = (
      this.configService.get<string>('storage.publicUrl', '') || ''
    ).replace(/\/+$/, '');

    const endpoint = this.configService.get<string>('storage.endpoint');
    const accessKeyId = this.configService.get<string>('storage.accessKeyId');
    const secretAccessKey = this.configService.get<string>(
      'storage.secretAccessKey',
    );

    if (this.isEnabled && endpoint && accessKeyId && secretAccessKey) {
      try {
        this.s3Client = new S3Client({
          region: 'auto',
          endpoint,
          credentials: {
            accessKeyId,
            secretAccessKey,
          },
        });
        this.logger.log(
          `Cloudflare R2 Storage ready (Bucket: ${this.bucketName}, Public CDN: ${this.publicUrl})`,
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to initialize Cloudflare R2 S3 client: ${err.message}`,
        );
        this.s3Client = null;
      }
    } else {
      this.logger.warn(
        'Cloudflare R2 is disabled or missing credentials. Falling back to local disk storage.',
      );
    }
  }

  isR2Configured(): boolean {
    return Boolean(this.isEnabled && this.s3Client);
  }

  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
  ): Promise<string> {
    if (!this.s3Client) {
      throw new Error('Cloudflare R2 is not configured or disabled');
    }

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);
    return `${this.publicUrl}/${key}`;
  }

  async deleteFile(key: string): Promise<void> {
    if (!this.s3Client) return;

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      this.logger.log(`Deleted object from R2: ${key}`);
    } catch (err: any) {
      this.logger.error(
        `Failed to delete object from R2 (${key}): ${err.message}`,
      );
    }
  }

  getR2PublicUrl(): string {
    return this.publicUrl;
  }
}
