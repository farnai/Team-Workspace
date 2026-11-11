import 'server-only'
import { User, Role } from '@prisma/client'

export function canManageProjects(user: User): boolean {
  return user.role === Role.ADMIN
}

