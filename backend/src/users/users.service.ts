import {
  Injectable,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export type SafeUser = Omit<User, 'passwordHash'>;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateUserDto): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        role: dto.role ?? Role.VIEWER,
      },
    });

    return this.omitPassword(user);
  }

  async findAll(): Promise<SafeUser[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return users.map(this.omitPassword);
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.omitPassword(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    requestingUserId: string,
    requestingUserRole: Role,
  ): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const isAdmin =
      requestingUserRole === Role.SUPER_ADMIN || requestingUserRole === Role.ADMIN;
    const isSelf = requestingUserId === id;

    // Non-admins may only edit their own profile fields.
    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('You can only update your own profile');
    }

    // Role / active status are admin-only — including self-escalation.
    if (dto.role !== undefined || dto.isActive !== undefined) {
      if (!isAdmin) {
        throw new ForbiddenException('Insufficient permissions to change role or status');
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.firstName && { firstName: dto.firstName }),
        ...(dto.lastName && { lastName: dto.lastName }),
        ...(dto.role && { role: dto.role }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.avatarUrl && { avatarUrl: dto.avatarUrl }),
      },
    });

    return this.omitPassword(updated);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  private omitPassword(user: User): SafeUser {
    const { passwordHash: _, ...safe } = user;
    return safe;
  }
}
