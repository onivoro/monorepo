import { hasRoleGuardFactory } from '../guard-factories/has-role.guard-factory';
import { RoleEnum } from '@onivoro/server-b2b-orm';

export const HasCompanyAdminRoleGuard = hasRoleGuardFactory(RoleEnum.COMPANY_ADMIN);
