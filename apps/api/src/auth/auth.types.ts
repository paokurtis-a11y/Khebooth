import { UserRole } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
}

export interface JwtPayload {
  sub: string;
  organizationId: string;
  email: string;
  role: UserRole;
}
