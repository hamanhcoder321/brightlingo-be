import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLeadDto {
  @IsString({ message: 'Họ tên phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập họ và tên' })
  fullName: string;

  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập số điện thoại' })
  phone: string;

  @IsEmail({}, { message: 'Email không đúng định dạng' })
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  courseSlug?: string;

  @IsString()
  @IsOptional()
  courseName?: string;

  @IsString()
  @IsOptional()
  courseInterest?: string;

  @IsString()
  @IsOptional()
  courseTitle?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  ref?: string;

  @IsString()
  @IsOptional()
  source?: string; // Nguồn trang điền form: "Trang chủ", "Trang đăng ký", "Trang khóa học"

  @IsString()
  @IsOptional()
  landingUrl?: string; // URL đầy đủ của trang người dùng gửi thông tin

  @IsString()
  @IsOptional()
  referrerUrl?: string; // Nguồn giới thiệu (HTTP Referer)

  @IsString()
  @IsOptional()
  utmSource?: string; // Marketing source (facebook, google, tiktok, zalo, youtube...)

  @IsString()
  @IsOptional()
  utmMedium?: string; // cpc, banner, bio, organic, website_form...

  @IsString()
  @IsOptional()
  utmCampaign?: string; // Tên chiến dịch marketing
}
