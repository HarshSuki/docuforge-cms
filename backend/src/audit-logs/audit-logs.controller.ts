import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('audit-logs')
@UseGuards(RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.ADMIN)
export class AuditLogsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async findAll(
    @Query('limit') limit = '50',
    @Query('offset') offset = '0',
  ) {
    return this.prisma.auditLog.findMany({
      take: Math.min(parseInt(limit, 10) || 50, 200),
      skip: parseInt(offset, 10) || 0,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
