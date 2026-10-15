import { Controller, Get, Param, Query } from '@nestjs/common';
import { CoursesService } from './courses.service';

@Controller('api/courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get('categories')
  async getCategories() {
    return this.coursesService.getCategories();
  }

  @Get()
  async getAll(@Query('categoryId') categoryId?: string) {
    return this.coursesService.getAll(categoryId);
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.coursesService.getBySlug(slug);
  }
}
