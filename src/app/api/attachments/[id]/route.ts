import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { isPathContained } from "@/lib/fileSecurity";
import path from "path";
import fs from "fs/promises";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json({ error: "ფაილი ვერ მოიძებნა" }, { status: 404 });
    }

    if (attachment.isExternal && attachment.url) {
      return NextResponse.redirect(attachment.url);
    }

    const safeStoredName = path.basename(attachment.storedName);
    const filePath = path.resolve(UPLOAD_DIR, safeStoredName);

    if (!isPathContained(filePath, UPLOAD_DIR)) {
      return NextResponse.json({ error: "არასწორი ფაილის გზა" }, { status: 400 });
    }

    try {
      const fileBuffer = await fs.readFile(filePath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": attachment.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; sandbox",
        },
      });
    } catch {
      return NextResponse.json({ error: "ფაილი დისკზე ვერ მოიძებნა" }, { status: 404 });
    }
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json({ error: "ფაილი ვერ მოიძებნა" }, { status: 404 });
    }

    if (attachment.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "არ გაქვთ ამ ფაილის წაშლის უფლება" }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.attachment.delete({
        where: { id },
      });

      await logAuditEvent({
        taskId: attachment.taskId,
        actorId: user.id,
        action: "ATTACHMENT_REMOVED",
        entityType: "ATTACHMENT",
        entityId: id,
        oldValues: {
          originalName: attachment.originalName,
          sizeBytes: attachment.sizeBytes,
          isExternal: attachment.isExternal,
        },
        reason: attachment.isExternal ? "გარე ბმულის წაშლა" : "ფაილის წაშლა",
        tx,
      });
    });

    // If local file, delete from disk safely AFTER transaction succeeds
    if (!attachment.isExternal && attachment.storedName) {
      const safeStoredName = path.basename(attachment.storedName);
      const filePath = path.normalize(path.join(UPLOAD_DIR, safeStoredName));
      if (filePath.startsWith(path.normalize(UPLOAD_DIR))) {
        try {
          await fs.unlink(filePath);
        } catch {
          // ignore if already deleted
        }
      }
    }

    return NextResponse.json({ success: true, message: "ფაილი წარმატებით წაიშალა" });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("DELETE /api/attachments/[id] error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const body = await req.json();
    const { name, url } = body;

    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return NextResponse.json({ error: "ბმული ვერ მოიძებნა" }, { status: 404 });
    }

    if (attachment.userId !== user.id && user.role !== "ADMIN") {
      return NextResponse.json({ error: "არ გაქვთ ამ ბმულის რედაქტირების უფლება" }, { status: 403 });
    }

    if (!attachment.isExternal) {
      return NextResponse.json({ error: "მხოლოდ გარე ბმულების რედაქტირებაა შესაძლებელი" }, { status: 400 });
    }

    let trimmedUrl = attachment.url;
    if (url) {
      trimmedUrl = String(url).trim();
      const lowerUrl = trimmedUrl.toLowerCase();
      if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
        return NextResponse.json({ error: "ბმული უნდა იწყებოდეს http:// ან https:// პრეფიქსით" }, { status: 400 });
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      const res = await tx.attachment.update({
        where: { id },
        data: {
          originalName: name ? String(name).trim() : attachment.originalName,
          url: trimmedUrl,
        },
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      });

      await logAuditEvent({
        taskId: attachment.taskId,
        actorId: user.id,
        action: "TASK_UPDATED",
        entityType: "ATTACHMENT",
        entityId: id,
        oldValues: { name: attachment.originalName, url: attachment.url },
        newValues: { name: res.originalName, url: res.url },
        reason: "გარე ბმულის რედაქტირება",
        tx,
      });

      return res;
    });

    return NextResponse.json({ success: true, attachment: updated });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("PATCH /api/attachments/[id] error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
