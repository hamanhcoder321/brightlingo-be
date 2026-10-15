import { Controller, Get } from '@nestjs/common';
import { CoursesService } from './courses.service';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly coursesService: CoursesService) {}

  @Get()
  async getCategories() {
    return this.coursesService.getCategories();
  }
}
