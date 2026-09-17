import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Capability } from './capability';

export interface UserAuthContext {
  roleCodes: string[];
  capabilities: Capability[];
}

@Injectable()
export class RbacService {
  constructor(private readonly prisma: PrismaService) {}

  async loadUserAuthContext(userId: string): Promise<UserAuthContext> {
    const roles = await this.prisma.role.findMany({
      where: { users: { some: { userId } } },
      include: { permissions: { include: { permission: true } } },
    });

    const capabilities = new Set<Capability>();
    for (const role of roles) {
      for (const rolePermission of role.permissions) {
        capabilities.add(rolePermission.permission.code as Capability);
      }
    }

    return {
      roleCodes: roles.map((role) => role.code),
      capabilities: [...capabilities],
    };
  }
}
