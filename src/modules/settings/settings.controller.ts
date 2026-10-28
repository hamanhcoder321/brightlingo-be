import { Controller, Get, Post, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller(['api/settings', 'api/admin/settings', 'admin/settings'])
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('public')
  async getPublicSettings() {
    return this.settingsService.getPublicSettings();
  }

  @Get(['all', ''])
  async getAllSettings() {
    return this.settingsService.getAllSettings();
  }

  @Put()
  async updateSettings(@Body() body: Record<string, any>) {
    return this.settingsService.updateSettings(body);
  }

  @Post(['regenerate-sitemap', 'regenerate'])
  async regenerateSitemap() {
    return this.settingsService.regenerateSitemap();
  }
}
