import { Controller, Get, Param } from '@nestjs/common';
import { CoursesService } from './courses.service';

@Controller('api/courses')
export class CoursesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  async getAll() {
    return this.coursesService.getAll();
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string) {
    return this.coursesService.getBySlug(slug);
  }
}
