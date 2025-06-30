import { hasRoleGuardFactory } from '../guard-factories/has-role.guard-factory';
import { RoleEnum } from '@onivoro/server-b2b-orm';

export const HasSystemAdministratorRoleGuard = hasRoleGuardFactory(RoleEnum.SYSTEM_ADMIN);
