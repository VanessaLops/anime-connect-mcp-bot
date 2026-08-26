export type Role = "owner" | "admin" | "member";

const ROLE_RANK: Record<Role, number> = { member: 0, admin: 1, owner: 2 };

/** `true` se `role` tem permissão igual ou maior que `minRole`. */
export function hasPermission(role: Role, minRole: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minRole];
}

export interface GroupContext {
  groupId: string;
  ownerId: string;
  adminIds: string[];
}

/** Resolve o papel de `userId` dentro do grupo (dono > admin > membro comum). */
export function resolveRole(userId: string, group: GroupContext): Role {
  if (userId === group.ownerId) return "owner";
  if (group.adminIds.includes(userId)) return "admin";
  return "member";
}
