import { IsArray, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCourseDto {
  @IsString()
  @IsNotEmpty()
  slug: string;

  @IsString()
  @IsNotEmpty()
  categoryName: string;

  @IsString()
  @IsNotEmpty()
  tagBadge: string;

  @IsString()
  @IsOptional()
  typeBadge?: string;

  @IsString()
  @IsNotEmpty()
  title: string;

  @IsNumber()
  @IsNotEmpty()
  price: number;

  @IsNumber()
  @IsNotEmpty()
  originalPrice: number;

  @IsNumber()
  @IsOptional()
  discountPercent?: number;

  @IsString()
  @IsNotEmpty()
  image: string;

  @IsString()
  @IsOptional()
  videoDemoTitle?: string;

  @IsString()
  @IsOptional()
  videoDemoDuration?: string;

  @IsString()
  @IsOptional()
  videoDemoSubtitle?: string;

  @IsString()
  @IsOptional()
  videoUrl?: string;

  @IsArray()
  @IsOptional()
  benefits?: any[];

  @IsOptional()
  curriculum?: any;

  @IsOptional()
  bankInfo?: any;

  @IsString()
  @IsNotEmpty()
  resourceLink: string;

  @IsString()
  @IsOptional()
  seoTitle?: string;

  @IsString()
  @IsOptional()
  seoDescription?: string;

  @IsString()
  @IsOptional()
  ogImage?: string;

  @IsIn(['DRAFT', 'PUBLISHED', 'HIDDEN'])
  @IsOptional()
  status?: 'DRAFT' | 'PUBLISHED' | 'HIDDEN';
}
