import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuthService, RequestContext } from '../auth/auth.service';
import { MfaService } from '../mfa/mfa.service';
import { PasswordHasher } from '../common/password-hasher.service';
import {
  encryptSecret,
  generateOpaqueToken,
  hashOpaqueToken,
} from '../common/crypto';
import { MFA_REQUIRED_ROLE_CODES } from '../rbac/mfa-required-roles';
import { InviteUserDto } from './dto/invite-user.dto';
import { ListUsersQueryDto } from './dto/list-users.query.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const INVITATION_TTL_DAYS = 7;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async list(query: ListUsersQueryDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where = {
      status: query.status,
      ...(query.search
        ? {
            OR: [
              {
                email: { contains: query.search, mode: 'insensitive' as const },
              },
              {
                fullName: {
                  contains: query.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.platformUser.findMany({
        where,
        include: { roles: { include: { role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.platformUser.count({ where }),
    ]);

    return {
      items: items.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        status: user.status,
        roles: user.roles.map((r) => r.role.code),
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      })),
      page,
      pageSize,
      total,
    };
  }

  async invite(inviterId: string, dto: InviteUserDto) {
    const existing = await this.prisma.platformUser.findUnique({
      where: { email: dto.email },
    });
    if (existing)
      throw new ConflictException('Ya existe un usuario con ese correo');

    const role = await this.prisma.role.findUnique({
      where: { code: dto.roleCode },
    });
    if (!role) throw new BadRequestException('Rol invalido');

    const invitationToken = generateOpaqueToken();

    const user = await this.prisma.$transaction(async (tx) => {
      const created = await tx.platformUser.create({
        data: {
          email: dto.email,
          fullName: dto.fullName,
          status: 'invited',
          invitationTokenHash: hashOpaqueToken(invitationToken),
          invitationExpiresAt: new Date(
            Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60_000,
          ),
        },
      });
      await tx.userRole.create({
        data: { userId: created.id, roleId: role.id },
      });
      return created;
    });

    await this.audit.record({
      actorId: inviterId,
      action: 'users.invited',
      resourceType: 'platform_user',
      resourceId: user.id,
      metadata: { roleCode: dto.roleCode },
    });

    // Sin proveedor de correo configurado todavia: se deja constancia en el
    // log estructurado, igual que el flujo de forgot-password.
    this.logger.warn(
      { email: dto.email, invitationToken },
      'invitacion de usuario generada (envio de correo pendiente)',
    );

    return { id: user.id, email: user.email, invitationToken };
  }

  async acceptInvitation(
    rawToken: string,
    password: string,
    ctx: RequestContext,
  ) {
    const tokenHash = hashOpaqueToken(rawToken);
    const user = await this.prisma.platformUser.findFirst({
      where: {
        invitationTokenHash: tokenHash,
        invitationExpiresAt: { gt: new Date() },
        status: 'invited',
      },
    });
    if (!user) throw new BadRequestException('Invitacion invalida o expirada');

    const passwordHash = await this.passwordHasher.hash(password);
    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: {
        passwordHash,
        status: 'active',
        invitationTokenHash: null,
        invitationExpiresAt: null,
      },
    });

    const roles = await this.prisma.userRole.findMany({
      where: { userId: user.id },
      include: { role: true },
    });
    const requiresMfa = roles.some((r) =>
      (MFA_REQUIRED_ROLE_CODES as readonly string[]).includes(r.role.code),
    );

    await this.audit.record({
      actorId: user.id,
      action: 'users.activated',
      resourceType: 'platform_user',
      resourceId: user.id,
    });

    if (requiresMfa) {
      const { secret, provisioningUri } = this.mfaService.generateSecret(
        user.email,
      );
      const { hashes } = this.mfaService.generateBackupCodes();
      await this.prisma.mfaMethod.create({
        data: {
          userId: user.id,
          type: 'totp',
          secretEncrypted: encryptSecret(secret),
          backupCodeHashes: hashes,
        },
      });
      return {
        mfaSetupRequired: true,
        provisioningUri,
        challengeToken: this.authService.issueMfaEnrollmentChallenge(user.id),
      };
    }

    return this.authService.completeLogin(user.id, ctx);
  }

  async update(id: string, actorId: string, dto: UpdateUserDto) {
    const user = await this.findOrThrow(id);

    if (dto.roleCode) {
      const role = await this.prisma.role.findUnique({
        where: { code: dto.roleCode },
      });
      if (!role) throw new BadRequestException('Rol invalido');
      await this.prisma.$transaction([
        this.prisma.userRole.deleteMany({ where: { userId: user.id } }),
        this.prisma.userRole.create({
          data: { userId: user.id, roleId: role.id },
        }),
      ]);
    }

    if (dto.fullName) {
      await this.prisma.platformUser.update({
        where: { id: user.id },
        data: { fullName: dto.fullName },
      });
    }

    await this.audit.record({
      actorId,
      action: 'users.updated',
      resourceType: 'platform_user',
      resourceId: user.id,
      metadata: { fullName: dto.fullName, roleCode: dto.roleCode },
    });
  }

  async suspend(id: string, actorId: string, reason: string | undefined) {
    const user = await this.findOrThrow(id);
    await this.prisma.$transaction([
      this.prisma.platformUser.update({
        where: { id: user.id },
        data: { status: 'suspended' },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'suspended' },
      }),
    ]);
    await this.audit.record({
      actorId,
      action: 'users.suspended',
      resourceType: 'platform_user',
      resourceId: user.id,
      reason,
    });
  }

  async revokeSessions(id: string, actorId: string) {
    const user = await this.findOrThrow(id);
    await this.prisma.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: 'admin_revoked' },
    });
    await this.audit.record({
      actorId,
      action: 'users.sessions_revoked',
      resourceType: 'platform_user',
      resourceId: user.id,
    });
  }

  async resetCredentials(id: string, actorId: string) {
    const user = await this.findOrThrow(id);
    const token = generateOpaqueToken();
    await this.prisma.$transaction([
      this.prisma.platformUser.update({
        where: { id: user.id },
        data: {
          passwordResetTokenHash: hashOpaqueToken(token),
          passwordResetExpiresAt: new Date(Date.now() + 30 * 60_000),
          mustChangePassword: true,
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'credentials_reset' },
      }),
    ]);
    await this.audit.record({
      actorId,
      action: 'users.credentials_reset',
      resourceType: 'platform_user',
      resourceId: user.id,
    });
    this.logger.warn(
      { email: user.email, resetToken: token },
      'reinicio de credenciales generado (envio de correo pendiente)',
    );
  }

  private async findOrThrow(id: string) {
    const user = await this.prisma.platformUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return user;
  }
}
