import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { formatGeorgianDateShort } from "@/lib/dateUtils";
import { Role } from "@prisma/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: taskId } = await params;

    // Retrieve the most recent deadline change request for this task
    const recentRequests = await prisma.auditEvent.findMany({
      where: {
        taskId,
        entityType: "DEADLINE_CHANGE_REQUEST",
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        actor: { select: { id: true, name: true, avatarUrl: true, role: true } },
      },
    });

    const pendingRequest = recentRequests.find((reqItem) => {
      const val = reqItem.newValues as { status?: string } | null;
      return val?.status === "PENDING";
    });

    return NextResponse.json({
      success: true,
      pendingRequest: pendingRequest
        ? {
            id: pendingRequest.id,
            createdAt: pendingRequest.createdAt,
            actor: pendingRequest.actor,
            requestedDeadline: (pendingRequest.newValues as Record<string, unknown>)?.requestedDeadline,
            reason: (pendingRequest.newValues as Record<string, unknown>)?.reason,
            stageId: (pendingRequest.newValues as Record<string, unknown>)?.stageId,
          }
        : null,
      history: recentRequests,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: taskId } = await params;
    const body = await req.json();

    const { requestedDeadline, reason, stageId } = body;

    if (!requestedDeadline) {
      return NextResponse.json(
        { error: "სასურველი დედლაინის მითითება სავალდებულოა" },
        { status: 400 }
      );
    }

    if (!reason || !String(reason).trim()) {
      return NextResponse.json(
        { error: "დედლაინის შეცვლის მოთხოვნის მიზეზის მითითება სავალდებულოა" },
        { status: 400 }
      );
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        stages: { orderBy: { position: "asc" } },
      },
    });

    if (!task) {
      return NextResponse.json({ error: "დავალება ვერ მოიძებნა" }, { status: 404 });
    }

    const targetStage = stageId
      ? task.stages.find((s) => s.id === stageId)
      : null;

    // Find Admins to notify
    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });

    const parsedDate = new Date(requestedDeadline);
    const dateStr = formatGeorgianDateShort(parsedDate);

    // Create AuditEvent storing this request
    const audit = await logAuditEvent({
      taskId,
      actorId: user.id,
      action: "DEADLINE_CHANGED",
      entityType: "DEADLINE_CHANGE_REQUEST",
      entityId: taskId,
      newValues: {
        requestedDeadline: parsedDate.toISOString(),
        reason: String(reason).trim(),
        stageId: stageId || null,
        stageTitle: targetStage?.title || null,
        requestedById: user.id,
        requestedByName: user.name,
        status: "PENDING",
      },
      reason: String(reason).trim(),
    });

    // Notify all admins
    for (const admin of admins) {
      await prisma.notification.create({
        data: {
          userId: admin.id,
          taskId,
          title: "დედლაინის ცვლილების მოთხოვნა",
          message: `${user.name}-მა მოითხოვა დედლაინის გადაწევა დავალებაზე #${task.taskNumber} (${task.title})${
            targetStage ? ` [${targetStage.title}]` : ""
          }. სასურველი ვადა: ${dateStr}. მიზეზი: ${String(reason).trim()}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "მოთხოვნა წარმატებით გაიგზავნა ადმინისტრატორთან",
      requestId: audit.id,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    if (user.role !== Role.ADMIN) {
      return NextResponse.json(
        { error: "მოთხოვნის დამტკიცების უფლება აქვს მხოლოდ ადმინისტრატორს" },
        { status: 403 }
      );
    }

    const { id: taskId } = await params;
    const body = await req.json();
    const { action, responseNote } = body; // action: "APPROVE" | "REJECT"

    if (action !== "APPROVE" && action !== "REJECT") {
      return NextResponse.json({ error: "არასწორი ოპერაცია" }, { status: 400 });
    }

    // Find the latest pending request
    const pendingEvents = await prisma.auditEvent.findMany({
      where: {
        taskId,
        entityType: "DEADLINE_CHANGE_REQUEST",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const pendingRequest = pendingEvents.find((e) => {
      const val = e.newValues as { status?: string } | null;
      return val?.status === "PENDING";
    });

    if (!pendingRequest) {
      return NextResponse.json(
        { error: "აქტიური მოთხოვნა არ მოიძებნა" },
        { status: 404 }
      );
    }

    const reqData = pendingRequest.newValues as {
      requestedDeadline: string;
      reason: string;
      stageId?: string | null;
      requestedById: string;
      requestedByName: string;
    };

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return NextResponse.json({ error: "დავალება ვერ მოიძებნა" }, { status: 404 });
    }

    const newDeadline = new Date(reqData.requestedDeadline);

    await prisma.$transaction(async (tx) => {
      if (action === "APPROVE") {
        if (reqData.stageId) {
          await tx.workflowStage.update({
            where: { id: reqData.stageId },
            data: {
              deadline: newDeadline,
              deadlineLocked: true,
            },
          });
        } else {
          await tx.task.update({
            where: { id: taskId },
            data: {
              deadline: newDeadline,
              deadlineLocked: true,
            },
          });
        }

        // Notify the requesting user
        await tx.notification.create({
          data: {
            userId: reqData.requestedById,
            taskId,
            title: "დედლაინის მოთხოვნა დამტკიცდა",
            message: `თქვენი მოთხოვნა დედლაინის შეცვლაზე დავალებაზე #${task.taskNumber} დამტკიცებულია ადმინისტრატორის მიერ. ახალი ვადა: ${formatGeorgianDateShort(newDeadline)}.`,
          },
        });

        // Log Approval Audit Event
        await logAuditEvent({
          taskId,
          actorId: user.id,
          action: "DEADLINE_CHANGED",
          entityType: "DEADLINE_CHANGE_REQUEST",
          entityId: taskId,
          oldValues: { status: "PENDING", requestedDeadline: reqData.requestedDeadline },
          newValues: {
            status: "APPROVED",
            appliedDeadline: newDeadline.toISOString(),
            approvedById: user.id,
            responseNote: responseNote || null,
          },
          reason: responseNote || "ადმინისტრატორმა დაამტკიცა დედლაინის ცვლილება",
          tx,
        });
      } else {
        // REJECT
        await tx.notification.create({
          data: {
            userId: reqData.requestedById,
            taskId,
            title: "დედლაინის მოთხოვნა უარყოფილია",
            message: `თქვენი მოთხოვნა დედლაინის შეცვლაზე დავალებაზე #${task.taskNumber} უარყოფილია ადმინისტრატორის მიერ.${
              responseNote ? ` მიზეზი: ${responseNote}` : ""
            }`,
          },
        });

        await logAuditEvent({
          taskId,
          actorId: user.id,
          action: "DEADLINE_CHANGED",
          entityType: "DEADLINE_CHANGE_REQUEST",
          entityId: taskId,
          oldValues: { status: "PENDING" },
          newValues: {
            status: "REJECTED",
            rejectedById: user.id,
            responseNote: responseNote || null,
          },
          reason: responseNote || "ადმინისტრატორმა უარყო დედლაინის ცვლილების მოთხოვნა",
          tx,
        });
      }
    });

    return NextResponse.json({
      success: true,
      action,
      message:
        action === "APPROVE"
          ? "მოთხოვნა წარმატებით დამტკიცდა"
          : "მოთხოვნა უარყოფილია",
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

