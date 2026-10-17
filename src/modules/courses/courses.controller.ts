import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
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

  @Post(':slug/view')
  async trackView(@Param('slug') slug: string, @Req() req: any) {
    const ip = req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'] || '';
    return this.coursesService.trackView(slug, String(ip), String(userAgent));
  }

  @Post()
  async createCourse(@Body() data: any) {
    return this.coursesService.createCourse(data);
  }

  @Put(':id')
  async updateCourse(@Param('id') id: string, @Body() data: any) {
    return this.coursesService.updateCourse(id, data);
  }

  @Patch(':id/featured')
  async setFeaturedPatch(@Param('id') id: string) {
    return this.coursesService.setFeatured(id);
  }

  @Put(':id/featured')
  async setFeaturedPut(@Param('id') id: string) {
    return this.coursesService.setFeatured(id);
  }

  @Delete(':id')
  async deleteCourse(@Param('id') id: string) {
    return this.coursesService.deleteCourse(id);
  }
}
