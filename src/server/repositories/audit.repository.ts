import 'server-only'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { logAuditEvent, type LogAuditOptions } from '@/lib/audit'

type Db = PrismaClient | Prisma.TransactionClient

export const auditRepository = {
  log(options: Omit<LogAuditOptions, 'tx'>, db?: Db) {
    const tx = db && 'auditEvent' in db && db !== prisma ? (db as Prisma.TransactionClient) : undefined
    return logAuditEvent({ ...options, tx })
  },
}

