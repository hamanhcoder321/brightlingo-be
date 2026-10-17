import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class BankNotiWebhookDto {
  @IsString()
  @IsOptional()
  event?: string;

  @IsString()
  @IsOptional()
  gateway?: string;

  @IsString()
  @IsOptional()
  transaction_date?: string;

  @IsString()
  @IsOptional()
  account_number?: string;

  @IsString()
  @IsOptional()
  virtual_account?: string;

  @IsNumber()
  @IsNotEmpty()
  amount: number;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsString()
  @IsOptional()
  bill_id?: string;

  @IsOptional()
  id?: string | number; // external_transaction_id
}
