import { Controller, Get, Post, Put, Body, UseGuards, Req } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { AuthGuard } from '@/modules/auth/auth.guard';

@Controller(['api/settings', 'api/admin/settings', 'admin/settings'])
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  async getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @UseGuards(AuthGuard)
  @Get(['all', ''])
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  @UseGuards(AuthGuard)
  @Put()
  async updateSettings(@Body() body: Record<string, any>, @Req() req: any) {
    return this.settingsService.updateSettings(body, req?.user);
  }

  @UseGuards(AuthGuard)
  @Post(['regenerate-sitemap', 'regenerate'])
  async regenerateSitemap() {
    return this.settingsService.regenerateSitemap();
  }
}
