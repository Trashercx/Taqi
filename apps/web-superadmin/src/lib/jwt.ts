import type { Capability } from './capabilities';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  capabilities: Capability[];
  iat: number;
  exp: number;
}

/**
 * Decodifica (sin verificar firma) el payload de un JWT para uso de UI:
 * mostrar el correo, filtrar navegacion por capacidades, etc. La
 * autorizacion real siempre la hace la API -- esto nunca decide si una
 * accion se permite, solo si mostrar o no un boton.
 */
export function decodeJwt(token: string): JwtPayload | null {
  try {
    const [, payloadB64] = token.split('.');
    if (!payloadB64) return null;
    const base64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isExpired(payload: JwtPayload, skewSeconds = 10): boolean {
  return payload.exp * 1000 <= Date.now() + skewSeconds * 1000;
}
