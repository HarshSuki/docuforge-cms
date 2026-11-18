import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('media')
export class MediaController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('projectId') projectId?: string,
  ) {
    if (projectId) {
      await this.assertProjectAccess(projectId, userId);
      return this.prisma.mediaAsset.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
    }

    // Without a project filter, only return assets for projects the user can access.
    const projects = await this.prisma.project.findMany({
      where: {
        OR: [
          { members: { some: { userId } } },
          { workspace: { members: { some: { userId } } } },
        ],
      },
      select: { id: true },
    });
    const projectIds = projects.map((p) => p.id);

    return this.prisma.mediaAsset.findMany({
      where: {
        OR: [
          { projectId: { in: projectIds } },
          // Unscoped assets are not listed globally (avoid cross-tenant leak).
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      filename: string;
      originalName: string;
      mimeType: string;
      size: number;
      url: string;
      storageKey: string;
      projectId?: string;
    },
  ) {
    if (!body.projectId) {
      throw new ForbiddenException('projectId is required');
    }
    await this.assertProjectAccess(body.projectId, userId);

    return this.prisma.mediaAsset.create({ data: body });
  }

  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser('id') userId: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException('Media asset not found');
    if (!asset.projectId) {
      throw new ForbiddenException('Cannot delete unscoped media asset');
    }
    await this.assertProjectAccess(asset.projectId, userId);
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { success: true };
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
