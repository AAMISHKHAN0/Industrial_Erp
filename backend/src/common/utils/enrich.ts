import { PrismaService } from '../../database/prisma.service';

/**
 * Enriches a list of entities with a `createdByUser` object containing the
 * creator's id, email, primary role string, and the list of assigned role names.
 * Entities must have a `createdBy` field (user id or null).
 */
export async function enrichWithCreator(
  prisma: PrismaService,
  entities: any[],
): Promise<any[]> {
  const ids = [
    ...new Set(entities.map((e) => e.createdBy).filter(Boolean)),
  ] as string[];
  if (ids.length === 0) return entities;

  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      email: true,
      role: true,
      userRoles: { select: { role: { select: { name: true } } } },
    },
  });

  const userMap = new Map(users.map((u) => [u.id, u]));

  return entities.map((e) => {
    const u = e.createdBy ? userMap.get(e.createdBy) : null;
    const roleNames =
      u?.userRoles?.map((ur: any) => ur.role.name).filter(Boolean) ?? [];
    return {
      ...e,
      createdByUser: u
        ? { id: u.id, email: u.email, role: u.role, roleNames }
        : null,
    };
  });
}
