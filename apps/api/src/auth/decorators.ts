// B-006 (docs/16 par. 4, docs/14 par. 7 A01): dekoratory autoryzacji endpointow /v1/admin/*.
// `@Roles(min)` = minimalna rola (owner > editor > viewer). `@AdminPublic()` = jawnie bez sesji (logowanie).
// Brak ktoregokolwiek na trasie admina = start aplikacji przerwany (admin-routes.check.ts) i odmowa w guardzie.
import { SetMetadata } from "@nestjs/common";
import type { Role } from "@taktyl/contracts";

export const ROLES_KEY = "taktyl:roles";
export const ADMIN_PUBLIC_KEY = "taktyl:admin-public";

export const ROLE_RANK: Record<Role, number> = { viewer: 1, editor: 2, owner: 3 };

export const Roles = (minRole: Role) => SetMetadata(ROLES_KEY, minRole);
export const AdminPublic = () => SetMetadata(ADMIN_PUBLIC_KEY, true);
