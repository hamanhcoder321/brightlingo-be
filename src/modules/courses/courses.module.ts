import { Module } from '@nestjs/common';
import { CoursesController } from './courses.controller';
import { CategoriesController } from './categories.controller';
import { CoursesService } from './courses.service';

@Module({
  controllers: [CoursesController, CategoriesController],
  providers: [CoursesService],
  exports: [CoursesService],
})
export class CoursesModule {}
