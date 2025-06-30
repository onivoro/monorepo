import { RoleEnum } from '@onivoro/server-b2b-orm';
import { hasAnyOfRolesGuardFactory } from './has-any-of-roles.guard-factory';

export function hasRoleGuardFactory(role: RoleEnum) {
    return hasAnyOfRolesGuardFactory([role]);
}
