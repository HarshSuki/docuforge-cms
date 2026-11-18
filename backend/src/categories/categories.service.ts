import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService) {}

  async findByProject(projectId: string, userId: string) {
    await this.assertProjectAccess(projectId, userId);
    return this.prisma.category.findMany({
      where: { projectId },
      include: { children: true, parent: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async create(projectId: string, dto: CreateCategoryDto, userId: string) {
    await this.assertProjectAccess(projectId, userId);
    return this.prisma.category.create({
      data: { ...dto, projectId, sortOrder: dto.sortOrder ?? 0 },
    });
  }

  async update(id: string, dto: Partial<CreateCategoryDto>, userId: string) {
    const cat = await this.findOne(id);
    await this.assertProjectAccess(cat.projectId, userId);
    return this.prisma.category.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    const cat = await this.findOne(id);
    await this.assertProjectAccess(cat.projectId, userId);
    return this.prisma.category.delete({ where: { id } });
  }

  private async findOne(id: string) {
    const cat = await this.prisma.category.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException(`Category ${id} not found`);
    return cat;
  }

  private async assertProjectAccess(projectId: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        OR: [
          { members: { some: { userId } } },
          { workspace: { members: { some: { userId } } } },
        ],
      },
    });
    if (!project) throw new ForbiddenException('Not a member of this project');
  }
}
