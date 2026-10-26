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
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { AuthService } from '@/modules/auth/auth.service';
import { AuthGuard } from '@/modules/auth/auth.guard';

@Controller('api/courses')
export class CoursesController {
  constructor(
    private readonly coursesService: CoursesService,
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

  @Get('categories')
  async getCategories() {
    return this.coursesService.getCategories();
  }

  @Get()
  async getAll(@Query('categoryId') categoryId: string | undefined, @Req() req: any) {
    const isAdmin = this.checkIsAdmin(req);
    return this.coursesService.getAll(categoryId, isAdmin);
  }

  @Get(':slug')
  async getBySlug(@Param('slug') slug: string, @Req() req: any) {
    const isAdmin = this.checkIsAdmin(req);
    return this.coursesService.getBySlug(slug, isAdmin);
  }

  @Post(':slug/view')
  async trackView(@Param('slug') slug: string, @Req() req: any) {
    const ip = req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers?.['user-agent'] || '';
    return this.coursesService.trackView(slug, String(ip), String(userAgent));
  }

  @UseGuards(AuthGuard)
  @Post()
  async createCourse(@Body() data: any, @Req() req: any) {
    return this.coursesService.createCourse(data, req?.user);
  }

  @UseGuards(AuthGuard)
  @Put(':id')
  async updateCourse(@Param('id') id: string, @Body() data: any, @Req() req: any) {
    return this.coursesService.updateCourse(id, data, req?.user);
  }

  @UseGuards(AuthGuard)
  @Patch(':id/featured')
  async setFeaturedPatch(@Param('id') id: string, @Req() req: any) {
    return this.coursesService.setFeatured(id, req?.user);
  }

  @UseGuards(AuthGuard)
  @Put(':id/featured')
  async setFeaturedPut(@Param('id') id: string, @Req() req: any) {
    return this.coursesService.setFeatured(id, req?.user);
  }

  @UseGuards(AuthGuard)
  @Delete(':id')
  async deleteCourse(@Param('id') id: string, @Req() req: any) {
    return this.coursesService.deleteCourse(id, req?.user);
  }
}
