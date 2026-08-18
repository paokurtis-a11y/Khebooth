import { SetMetadata } from '@nestjs/common';
import type { KhePermission } from './permissions';

export const PERMISSIONS_KEY = 'khe_permissions';
export const Permissions = (...permissions: KhePermission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
