import { Capability } from '../rbac/capability';

export interface JwtPayload {
  sub: string;
  email: string;
  roles: string[];
  capabilities: Capability[];
}
