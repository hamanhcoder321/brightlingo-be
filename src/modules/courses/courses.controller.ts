import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
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

  @Post()
  async createCourse(@Body() data: any) {
    return this.coursesService.createCourse(data);
  }

  @Put(':id')
  async updateCourse(@Param('id') id: string, @Body() data: any) {
    return this.coursesService.updateCourse(id, data);
  }

  @Delete(':id')
  async deleteCourse(@Param('id') id: string) {
    return this.coursesService.deleteCourse(id);
  }
}
