import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { AuthGuard } from '@/modules/auth/auth.guard';

@Controller('api/leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  // 1. Nhận thông tin đăng ký tư vấn từ Frontend (Landing page, modal, form) - CÔNG KHAI
  @Post()
  async create(@Body() dto: CreateLeadDto) {
    return this.leadsService.create(dto);
  }

  // 2. Danh sách leads cho CMS - BẮT BUỘC ĐĂNG NHẬP ADMIN (P0 Security fix)
  @UseGuards(AuthGuard)
  @Get('admin')
  async getAll(@Query() params: any) {
    return this.leadsService.getAllForAdmin(params);
  }

  // 3. Số lượng lead mới chưa tư vấn cho badge CMS - BẮT BUỘC ĐĂNG NHẬP ADMIN
  @UseGuards(AuthGuard)
  @Get('count-new')
  async getCountNew() {
    return this.leadsService.countNew();
  }

  // 4. Cập nhật trạng thái xử lý & ghi chú cho CMS - BẮT BUỘC ĐĂNG NHẬP ADMIN
  @UseGuards(AuthGuard)
  @Patch(':id')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
  ) {
    return this.leadsService.updateStatus(id, body.status, body.notes);
  }

  // 5. Xóa mềm lead - BẮT BUỘC ĐĂNG NHẬP ADMIN
  @UseGuards(AuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.leadsService.delete(id);
  }
}
