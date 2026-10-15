import { Controller, Get, Param } from '@nestjs/common';
import { PagesService } from './pages.service';

@Controller('api/pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Get()
  async getAll() {
    return this.pagesService.getAll();
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.pagesService.getBySlug(slug);
  }
}
