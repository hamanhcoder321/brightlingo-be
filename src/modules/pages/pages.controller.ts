import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { PagesService } from './pages.service';
import { AuthGuard } from '@/modules/auth/auth.guard';
import { AuthService } from '@/modules/auth/auth.service';

@Controller(['api/pages', 'api/admin/pages'])
export class PagesController {
  constructor(
    private readonly pagesService: PagesService,
    private readonly authService: AuthService,
  ) {}

  private checkIsAdmin(req: any): boolean {
    try {
      const authHeader = req?.headers?.['authorization'];
      if (!authHeader) return false;
      const [scheme, token] = authHeader.split(' ');
      if (scheme !== 'Bearer' || !token) return false;
      const decoded = this.authService.verifyToken(token);
      return Boolean(decoded && (decoded.id || decoded.sub));
    } catch {
      return false;
    }
  }

  @Get()
  async getAll(@Req() req: any) {
    const isAdmin = this.checkIsAdmin(req);
    return this.pagesService.getAll(isAdmin);
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.pagesService.getBySlug(slug);
  }

  @UseGuards(AuthGuard)
  @Post()
  async createPage(@Body() body: any) {
    return this.pagesService.create(body);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  async updatePage(@Param('id') id: string, @Body() body: any) {
    return this.pagesService.update(id, body);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  async deletePage(@Param('id') id: string) {
    return this.pagesService.delete(id);
  }
}
