import { IsEmail, IsNotEmpty, IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'Email quản trị không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập email quản trị' })
  @MaxLength(100, { message: 'Email không được vượt quá 100 ký tự' })
  email: string;

  @IsString({ message: 'Mật khẩu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  @MinLength(6, { message: 'Mật khẩu phải có tối thiểu 6 ký tự' })
  @MaxLength(100, { message: 'Mật khẩu không được vượt quá 100 ký tự' })
  password: string;
}
