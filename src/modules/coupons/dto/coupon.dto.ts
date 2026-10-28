import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsIn,
  Min,
  Max,
  Matches,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ApplyCouponDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  courseId: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;
}

export class CreateCouponDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Za-z0-9_-]{1,50}$/, {
    message: 'Mã coupon chỉ bao gồm chữ, số, dấu gạch nối và gạch dưới (1-50 ký tự)',
  })
  code: string;

  @IsString()
  @IsIn(['PERCENT', 'FIXED'])
  type: 'PERCENT' | 'FIXED';

  @IsNumber()
  @Min(1)
  value: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'SPECIFIC'])
  scope?: 'ALL' | 'SPECIFIC';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  courseIds?: string[];

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateCouponDto {
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,50}$/, {
    message: 'Mã coupon chỉ bao gồm chữ, số, dấu gạch nối và gạch dưới (1-50 ký tự)',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @IsIn(['PERCENT', 'FIXED'])
  type?: 'PERCENT' | 'FIXED';

  @IsOptional()
  @IsNumber()
  @Min(1)
  value?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxDiscountAmount?: number;

  @IsOptional()
  @IsString()
  @IsIn(['ALL', 'SPECIFIC'])
  scope?: 'ALL' | 'SPECIFIC';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  courseIds?: string[];

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  usageLimit?: number;

  @IsOptional()
  @IsString()
  @IsIn(['ACTIVE', 'INACTIVE'])
  status?: 'ACTIVE' | 'INACTIVE';

  @IsOptional()
  @IsString()
  note?: string;
}

export class QueryCouponDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  scope?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
