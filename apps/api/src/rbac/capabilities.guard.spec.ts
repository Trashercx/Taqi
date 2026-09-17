import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CapabilitiesGuard } from './capabilities.guard';

function buildContext(capabilities: string[] | undefined): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { sub: 'user-1', capabilities } }),
    }),
  } as unknown as ExecutionContext;
}

describe('CapabilitiesGuard', () => {
  it('allows access when no capabilities are required', () => {
    const reflector = {
      getAllAndOverride: () => undefined,
    } as unknown as Reflector;
    const guard = new CapabilitiesGuard(reflector);
    expect(guard.canActivate(buildContext(undefined))).toBe(true);
  });

  it('allows access when the user has every required capability', () => {
    const reflector = {
      getAllAndOverride: () => ['organizations.read'],
    } as unknown as Reflector;
    const guard = new CapabilitiesGuard(reflector);
    expect(
      guard.canActivate(buildContext(['organizations.read', 'audit.read'])),
    ).toBe(true);
  });

  it('denies access when a required capability is missing', () => {
    const reflector = {
      getAllAndOverride: () => ['organizations.create'],
    } as unknown as Reflector;
    const guard = new CapabilitiesGuard(reflector);
    expect(() =>
      guard.canActivate(buildContext(['organizations.read'])),
    ).toThrow(ForbiddenException);
  });

  it('denies access when the request has no user capabilities at all', () => {
    const reflector = {
      getAllAndOverride: () => ['organizations.read'],
    } as unknown as Reflector;
    const guard = new CapabilitiesGuard(reflector);
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
