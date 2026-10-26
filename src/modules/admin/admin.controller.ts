import { Controller, Get, Put, Post, Patch, Delete, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { OrdersService } from '@/modules/orders/orders.service';
import { LeadsService } from '@/modules/leads/leads.service';
import { SettingsService } from '@/modules/settings/settings.service';
import { AuditService } from '@/modules/audit/audit.service';
import { EmailService } from '@/modules/email/email.service';
import { AuthGuard } from '@/modules/auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('api/admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly ordersService: OrdersService,
    private readonly leadsService: LeadsService,
    private readonly settingsService: SettingsService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {}

  @Get('dashboard')
  async getDashboardSummary(@Query('period') period?: string) {
    return this.adminService.getDashboardSummary(period);
  }

  // Lịch sử thao tác Audit Logs cho CMS
  @Get('audit-logs')
  async getAuditLogs(@Query() params: any) {
    return this.auditService.getLogs(params);
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

  // Cập nhật trạng thái xử lý & ghi chú tư vấn cho CMS (Ghi Audit Log)
  @Patch('leads/:id')
  async updateLeadStatus(
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
    @Req() req: any,
  ) {
    return this.leadsService.updateStatus(id, body.status, body.notes, req?.user);
  }

  // Xóa mềm lead trong CMS (Ghi Audit Log)
  @Delete('leads/:id')
  async deleteLead(@Param('id') id: string, @Req() req: any) {
    return this.leadsService.delete(id, req?.user);
  }

  // Lấy toàn bộ cài đặt hệ thống (Giao diện & Banner, SEO & Google, Ngân hàng, Liên hệ)
  @Get('settings')
  async getSettings() {
    return this.settingsService.getAllSettings();
  }

  // Cập nhật cài đặt hệ thống từ CMS (Ghi Audit Log)
  @Put('settings')
  async updateSettings(@Body() body: Record<string, any>, @Req() req: any) {
    return this.settingsService.updateSettings(body, req?.user);
  }

  // Tạo lại Sitemap XML và kiểm tra danh sách đường dẫn SEO
  @Post('seo/regenerate-sitemap')
  async regenerateSitemap() {
    return this.settingsService.regenerateSitemap();
  }

  // Quản lý Mẫu Email tự động (BR-11)
  @Get('email-templates')
  async getEmailTemplates() {
    return this.emailService.getTemplates();
  }

  @Get('email-templates/:id')
  async getEmailTemplateById(@Param('id') id: string) {
    return this.emailService.getTemplateById(id);
  }

  @Put('email-templates/:id')
  async updateEmailTemplate(@Param('id') id: string, @Body() body: any) {
    return this.emailService.updateTemplate(id, body);
  }

  @Post('email-templates/:id/test')
  async sendTestEmailTemplate(@Param('id') id: string, @Body() body: { email: string }) {
    return this.emailService.sendTestEmail(id, body.email);
  }
}
