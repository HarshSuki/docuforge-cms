import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { Role } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async create(workspaceId: string, dto: CreateProjectDto, userId: string) {
    await this.assertWorkspaceMember(workspaceId, userId);

    const existing = await this.prisma.project.findUnique({
      where: { workspaceId_slug: { workspaceId, slug: dto.slug } },
    });
    if (existing) throw new ConflictException('Project slug already in use in this workspace');

    return this.prisma.project.create({
      data: {
        workspaceId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        isPublic: dto.isPublic ?? false,
        members: { create: { userId, role: Role.ADMIN } },
      },
      include: { _count: { select: { documents: true, members: true } } },
    });
  }

  async findAllInWorkspace(workspaceId: string, userId: string) {
    await this.assertWorkspaceMember(workspaceId, userId);
    return this.prisma.project.findMany({
      where: { workspaceId, isActive: true },
      include: { _count: { select: { documents: true, members: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(userId: string) {
    return this.prisma.project.findMany({
      where: {
        isActive: true,
        OR: [
          { members: { some: { userId } } },
          { workspace: { members: { some: { userId } } } },
        ],
      },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        _count: { select: { documents: true, members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: {
        id,
        isActive: true,
        OR: [
          { members: { some: { userId } } },
          { workspace: { members: { some: { userId } } } },
        ],
      },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        _count: { select: { documents: true, members: true, apiSpecs: true, graphqlSchemas: true } },
      },
    });
    if (!project) throw new NotFoundException('Project not found');
    return project;
  }

  async update(id: string, dto: UpdateProjectDto, userId: string) {
    await this.assertProjectAdmin(id, userId);
    return this.prisma.project.update({ where: { id }, data: dto });
  }

  async remove(id: string, userId: string) {
    await this.assertProjectAdmin(id, userId);
    await this.prisma.project.update({ where: { id }, data: { isActive: false } });
  }

  private async assertWorkspaceMember(workspaceId: string, userId: string) {
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) throw new ForbiddenException('Not a member of this workspace');
  }

  private async assertProjectAdmin(projectId: string, userId: string) {
    const member = await this.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });
    if (member) {
      if (member.role !== Role.ADMIN && member.role !== Role.SUPER_ADMIN) {
        throw new ForbiddenException('Admin access required');
      }
      return;
    }

    // Fall back to workspace admin (not any workspace member).
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: { include: { members: { where: { userId } } } } },
    });
    const wsMember = project?.workspace?.members?.[0];
    if (!wsMember) throw new ForbiddenException('Access denied');
    if (wsMember.role !== Role.ADMIN && wsMember.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Admin access required');
    }
  }
}
