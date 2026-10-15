export class BaseResponseDto<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: any;

  constructor(success: boolean, data?: T, message?: string, error?: any) {
    this.success = success;
    this.data = data;
    this.message = message;
    this.error = error;
  }

  static ok<T>(data: T, message?: string): BaseResponseDto<T> {
    return new BaseResponseDto(true, data, message);
  }

  static fail(message: string, error?: any): BaseResponseDto<null> {
    return new BaseResponseDto(false, null, message, error);
  }
}

export class PaginationDto {
  page?: number = 1;
  limit?: number = 20;
}
