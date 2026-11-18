import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('projects/:projectId/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findAll(@Param('projectId') projectId: string, @CurrentUser('id') userId: string) {
    return this.categoriesService.findByProject(projectId, userId);
  }

  @Post()
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateCategoryDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.categoriesService.create(projectId, dto, userId);
  }

  @Put(':id')
  update(
    @Param('id') id: string,
    @Body() dto: Partial<CreateCategoryDto>,
    @CurrentUser('id') userId: string,
  ) {
    return this.categoriesService.update(id, dto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    return this.categoriesService.remove(id, userId);
  }
}
