import { SetMetadata } from '@nestjs/common';
import { Capability } from './capability';

export const CAPABILITIES_KEY = 'requiredCapabilities';

/**
 * Declara las capacidades requeridas por un endpoint. La autorizacion nunca
 * debe basarse en `role === 'algo'` (SS5) -- CapabilitiesGuard es el unico
 * punto que decide, comparando contra las capacidades del JWT del usuario.
 */
export const RequireCapabilities = (...capabilities: Capability[]) =>
  SetMetadata(CAPABILITIES_KEY, capabilities);
