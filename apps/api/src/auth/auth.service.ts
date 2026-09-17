import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RbacService } from '../rbac/rbac.service';
import { AuditService } from '../audit/audit.service';
import { MfaService } from '../mfa/mfa.service';
import { PasswordHasher } from '../common/password-hasher.service';
import {
  decryptSecret,
  generateOpaqueToken,
  hashOpaqueToken,
  hashIp,
} from '../common/crypto';
import { MFA_REQUIRED_ROLE_CODES } from '../rbac/mfa-required-roles';

const ACCESS_TOKEN_TTL = '15m';
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS = 30;
const MFA_CHALLENGE_TTL = '5m';
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const PASSWORD_RESET_TTL_MINUTES = 30;

export interface RequestContext {
  ip?: string;
  userAgent?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly rbac: RbacService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async login(email: string, password: string, ctx: RequestContext) {
    const user = await this.prisma.platformUser.findUnique({
      where: { email },
      include: { mfaMethods: true },
    });

    // Mensaje generico para no revelar si el correo existe (evita user enumeration).
    const invalidCredentials = () =>
      new UnauthorizedException('Credenciales invalidas');

    if (!user || !user.passwordHash) throw invalidCredentials();

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'Cuenta bloqueada temporalmente. Intenta mas tarde.',
      );
    }

    const passwordValid = await this.passwordHasher.verify(
      user.passwordHash,
      password,
    );
    if (!passwordValid) {
      await this.registerFailedLogin(user.id, user.failedLoginCount);
      await this.audit.record({
        actorEmail: email,
        action: 'auth.login_failed',
        resourceType: 'platform_user',
        resourceId: user.id,
        ipHash: hashIp(ctx.ip),
        userAgent: ctx.userAgent,
      });
      throw invalidCredentials();
    }

    if (user.status !== 'active') {
      throw new UnauthorizedException(
        'La cuenta no esta activa. Si fuiste invitado, completa la aceptacion de invitacion.',
      );
    }

    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: { failedLoginCount: 0, lockedUntil: null },
    });

    const mfaMethod = user.mfaMethods.find((m) => m.type === 'totp');
    const { roleCodes } = await this.rbac.loadUserAuthContext(user.id);
    const requiresMfa = roleCodes.some((code) =>
      (MFA_REQUIRED_ROLE_CODES as readonly string[]).includes(code),
    );

    if (mfaMethod?.verifiedAt) {
      const challengeToken = this.signChallengeToken(user.id, 'mfa_challenge');
      return { mfaRequired: true, challengeToken };
    }

    if (requiresMfa) {
      // No deberia ocurrir si la invitacion fuerza el enrolamiento, pero es
      // una salvaguarda defensiva ante estados inconsistentes.
      throw new ForbiddenException(
        'Tu rol requiere MFA y no esta configurado. Contacta a un Platform Owner.',
      );
    }

    return this.completeLogin(user.id, ctx);
  }

  async verifyMfaChallenge(
    challengeToken: string,
    code: string,
    ctx: RequestContext,
  ) {
    const { userId, type } = this.verifyChallengeToken(challengeToken);

    const mfaMethod = await this.prisma.mfaMethod.findFirst({
      where: { userId, type: 'totp' },
    });
    if (!mfaMethod)
      throw new BadRequestException(
        'No hay un metodo MFA pendiente para este usuario',
      );

    const secret = decryptSecret(mfaMethod.secretEncrypted);
    let valid = this.mfa.verifyCode(secret, code);
    let remainingBackupCodes = mfaMethod.backupCodeHashes;

    if (!valid && mfaMethod.verifiedAt) {
      const backupResult = this.mfa.verifyBackupCode(
        mfaMethod.backupCodeHashes,
        code,
      );
      valid = backupResult.valid;
      remainingBackupCodes = backupResult.remaining;
    }

    if (!valid) throw new UnauthorizedException('Codigo MFA invalido');

    if (
      !mfaMethod.verifiedAt ||
      remainingBackupCodes !== mfaMethod.backupCodeHashes
    ) {
      await this.prisma.mfaMethod.update({
        where: { id: mfaMethod.id },
        data: {
          verifiedAt: mfaMethod.verifiedAt ?? new Date(),
          backupCodeHashes: remainingBackupCodes,
        },
      });
    }

    if (type === 'mfa_enrollment') {
      await this.audit.record({
        actorId: userId,
        action: 'auth.mfa_enrolled',
        resourceType: 'platform_user',
        resourceId: userId,
        ipHash: hashIp(ctx.ip),
        userAgent: ctx.userAgent,
      });
    }

    return this.completeLogin(userId, ctx);
  }

  async refresh(refreshToken: string, ctx: RequestContext): Promise<TokenPair> {
    const tokenHash = hashOpaqueToken(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: {
        refreshTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) throw new UnauthorizedException('Sesion invalida o expirada');

    const user = await this.prisma.platformUser.findUnique({
      where: { id: session.userId },
    });
    if (!user || user.status !== 'active') {
      await this.prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date(), revokedReason: 'user_inactive' },
      });
      throw new UnauthorizedException('Cuenta inactiva');
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: 'rotated' },
    });

    return this.issueTokens(user.id, ctx);
  }

  async logout(
    refreshToken: string,
    actorId: string | undefined,
    ctx: RequestContext,
  ): Promise<void> {
    const tokenHash = hashOpaqueToken(refreshToken);
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: tokenHash, revokedAt: null },
    });
    if (!session) return;

    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: 'logout' },
    });

    await this.audit.record({
      actorId: actorId ?? session.userId,
      action: 'auth.logout',
      resourceType: 'platform_user',
      resourceId: session.userId,
      ipHash: hashIp(ctx.ip),
      userAgent: ctx.userAgent,
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.platformUser.findUnique({
      where: { email },
    });
    // Respuesta identica exista o no el correo, para evitar user enumeration.
    if (!user) return;

    const token = generateOpaqueToken();
    await this.prisma.platformUser.update({
      where: { id: user.id },
      data: {
        passwordResetTokenHash: hashOpaqueToken(token),
        passwordResetExpiresAt: new Date(
          Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000,
        ),
      },
    });

    // No hay proveedor de correo configurado todavia (AWS SES queda para
    // cuando se defina el dominio de envio). Por ahora se deja constancia
    // en el log estructurado para que el operador complete el flujo a mano.
    this.logger.warn(
      { email, resetToken: token },
      'password reset token generado (envio de correo pendiente)',
    );
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashOpaqueToken(token);
    const user = await this.prisma.platformUser.findFirst({
      where: {
        passwordResetTokenHash: tokenHash,
        passwordResetExpiresAt: { gt: new Date() },
      },
    });
    if (!user) throw new BadRequestException('Token invalido o expirado');

    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.prisma.$transaction([
      this.prisma.platformUser.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          mustChangePassword: false,
          failedLoginCount: 0,
          lockedUntil: null,
        },
      }),
      this.prisma.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: 'password_reset' },
      }),
    ]);

    await this.audit.record({
      actorId: user.id,
      action: 'auth.password_reset',
      resourceType: 'platform_user',
      resourceId: user.id,
    });
  }

  /** Usado por UsersService al aceptar una invitacion que requiere MFA. */
  issueMfaEnrollmentChallenge(userId: string): string {
    return this.signChallengeToken(userId, 'mfa_enrollment');
  }

  /**
   * Emite el par de tokens y registra el evento de login exitoso. Publico
   * porque UsersService lo reutiliza al activar una cuenta sin MFA
   * inmediatamente despues de aceptar una invitacion.
   */
  async completeLogin(userId: string, ctx: RequestContext): Promise<TokenPair> {
    await this.prisma.platformUser.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
    const tokens = await this.issueTokens(userId, ctx);
    await this.audit.record({
      actorId: userId,
      action: 'auth.login_succeeded',
      resourceType: 'platform_user',
      resourceId: userId,
      ipHash: hashIp(ctx.ip),
      userAgent: ctx.userAgent,
    });
    return tokens;
  }

  private async issueTokens(
    userId: string,
    ctx: RequestContext,
  ): Promise<TokenPair> {
    const user = await this.prisma.platformUser.findUniqueOrThrow({
      where: { id: userId },
    });
    const { roleCodes, capabilities } =
      await this.rbac.loadUserAuthContext(userId);

    const accessToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email, roles: roleCodes, capabilities },
      { expiresIn: ACCESS_TOKEN_TTL },
    );

    const refreshToken = generateOpaqueToken();
    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashOpaqueToken(refreshToken),
        userAgent: ctx.userAgent,
        ipHash: hashIp(ctx.ip),
        expiresAt: new Date(
          Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60_000,
        ),
      },
    });

    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  private async registerFailedLogin(
    userId: string,
    currentCount: number,
  ): Promise<void> {
    const failedLoginCount = currentCount + 1;
    const lockedUntil =
      failedLoginCount >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000)
        : null;
    await this.prisma.platformUser.update({
      where: { id: userId },
      data: { failedLoginCount, lockedUntil },
    });
  }

  private signChallengeToken(
    userId: string,
    type: 'mfa_challenge' | 'mfa_enrollment',
  ): string {
    return this.jwtService.sign(
      { sub: userId, type },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: MFA_CHALLENGE_TTL,
      },
    );
  }

  private verifyChallengeToken(token: string): {
    userId: string;
    type: 'mfa_challenge' | 'mfa_enrollment';
  } {
    try {
      const payload = this.jwtService.verify<{ sub: string; type: string }>(
        token,
        {
          secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        },
      );
      if (
        payload.type !== 'mfa_challenge' &&
        payload.type !== 'mfa_enrollment'
      ) {
        throw new Error('tipo de token invalido');
      }
      return { userId: payload.sub, type: payload.type };
    } catch {
      throw new UnauthorizedException('Challenge token invalido o expirado');
    }
  }
}
