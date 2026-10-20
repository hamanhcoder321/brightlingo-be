import { Controller, Get, Put, Post, Patch, Delete, Param, Query, Body } from '@nestjs/common';
import { AdminService } from './admin.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { LeadsService } from '@/modules/leads/leads.service';
import { SettingsService } from '@/modules/settings/settings.service';

@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ordersService: OrdersService,
    private readonly leadsService: LeadsService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get('dashboard')
  async getDashboardSummary() {
    return this.adminService.getDashboardSummary();
  }

  // Danh sách toàn bộ đơn hàng thực tế cho CMS
  @Get('orders')
  async getOrders(@Query() params: any) {
    return this.ordersService.findAll(params);
  }

  // Chi tiết đơn hàng cho CMS
  @Get('orders/:id')
  async getOrderById(@Param('id') id: string) {
    return this.ordersService.findOne(id);
  }

  // Danh sách toàn bộ leads tư vấn cho CMS
  @Get('leads')
  async getLeads(@Query() params: any) {
    return this.leadsService.getAllForAdmin(params);
  }

  // Số lượng lead mới chưa tư vấn cho badge CMS
  @Get('leads/count-new')
  async getNewLeadsCount() {
    return this.leadsService.countNew();
  }

  // Cập nhật trạng thái xử lý & ghi chú tư vấn cho CMS
  @Patch('leads/:id')
  async updateLeadStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
  ) {
    return this.leadsService.updateStatus(id, body.status, body.notes);
  }

  // Xóa mềm lead trong CMS
  @Delete('leads/:id')
  async deleteLead(@Param('id') id: string) {
    return this.leadsService.delete(id);
  }

  // Lấy toàn bộ cài đặt hệ thống (Giao diện & Banner, SEO & Google, Ngân hàng, Liên hệ)
  @Get('settings')
  async getSettings() {
    return this.settingsService.getAllSettings();
  }

  // Cập nhật cài đặt hệ thống từ CMS
  @Put('settings')
  async updateSettings(@Body() body: Record<string, any>) {
    return this.settingsService.updateSettings(body);
  }

  // Tạo lại Sitemap XML và kiểm tra danh sách đường dẫn SEO
  @Post('seo/regenerate-sitemap')
  async regenerateSitemap() {
    return this.settingsService.regenerateSitemap();
  }
}
