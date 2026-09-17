import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CAPABILITIES_KEY } from './capabilities.decorator';
import { Capability } from './capability';
import { AuthenticatedRequest } from '../auth/authenticated-request';

@Injectable()
export class CapabilitiesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Capability[]>(
      CAPABILITIES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userCapabilities = new Set(request.user?.capabilities ?? []);
    const missing = required.filter(
      (capability) => !userCapabilities.has(capability),
    );

    if (missing.length > 0) {
      throw new ForbiddenException(
        `Faltan capacidades requeridas: ${missing.join(', ')}`,
      );
    }
    return true;
  }
}
