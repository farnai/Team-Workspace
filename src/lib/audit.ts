import { prisma } from "./prisma";
import { AuditAction, Prisma } from "@prisma/client";

export interface LogAuditOptions {
  taskId?: string | null;
  actorId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  oldValues?: Record<string, unknown> | Prisma.InputJsonValue | null;
  newValues?: Record<string, unknown> | Prisma.InputJsonValue | null;
  reason?: string | null;
  tx?: Prisma.TransactionClient;
}

export async function logAuditEvent({
  taskId,
  actorId,
  action,
  entityType,
  entityId,
  oldValues,
  newValues,
  reason,
  tx,
}: LogAuditOptions) {
  const client = tx || prisma;

  return client.auditEvent.create({
    data: {
      taskId: taskId ?? undefined,
      actorId,
      action,
      entityType,
      entityId,
      oldValues: (oldValues as Prisma.InputJsonValue) ?? undefined,
      newValues: (newValues as Prisma.InputJsonValue) ?? undefined,
      reason: reason ?? undefined,
    },
  });
}
