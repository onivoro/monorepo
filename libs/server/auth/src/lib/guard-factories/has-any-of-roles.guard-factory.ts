import { RoleEnum } from '@onivoro/server/b2b-orm';
import { _HasAnyOfRolesGuard } from '../guards/_has-any-of-roles.guard';

export function hasAnyOfRolesGuardFactory(roles: RoleEnum[]) {
    return new _HasAnyOfRolesGuard(roles);
}
