import { IsEmail, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  courseId?: string;

  @IsString()
  @IsOptional()
  courseSlug?: string;

  @IsString({ message: 'Họ tên khách hàng phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng cung cấp họ và tên khách hàng' })
  customerName: string;

  @IsEmail({}, { message: 'Email khách hàng không đúng định dạng' })
  @IsNotEmpty({ message: 'Vui lòng cung cấp email nhận tài liệu' })
  customerEmail: string;

  @IsString()
  @IsOptional()
  customerPhone?: string;

  @IsNumber()
  @IsOptional()
  amount?: number;

  @IsString()
  @IsOptional()
  couponCode?: string;

  @IsString()
  @IsOptional()
  ref?: string;

  @IsString()
  @IsOptional()
  utmSource?: string;

  @IsString()
  @IsOptional()
  utmMedium?: string;

  @IsString()
  @IsOptional()
  utmCampaign?: string;

  @IsString()
  @IsOptional()
  utmContent?: string;

  @IsString()
  @IsOptional()
  utmTerm?: string;

  @IsString()
  @IsOptional()
  landingUrl?: string;

  @IsString()
  @IsOptional()
  referrerUrl?: string;
}
