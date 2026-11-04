import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: taskId } = await params;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // External link (e.g. GitLab, Figma)
      const body = await req.json();
      const { name, url } = body;

      if (!name || !url) {
        return NextResponse.json({ error: "სახელი და ლინკი სავალდებულოა" }, { status: 400 });
      }

      const attachment = await prisma.attachment.create({
        data: {
          taskId,
          userId: user.id,
          originalName: name,
          storedName: "link-" + crypto.randomUUID(),
          mimeType: "text/html",
          sizeBytes: 0,
          url,
          isExternal: true,
        },
      });

      await logAuditEvent({
        taskId,
        actorId: user.id,
        action: "ATTACHMENT_ADDED",
        entityType: "ATTACHMENT",
        entityId: attachment.id,
        newValues: { name, url, isExternal: true },
        reason: "გარე ბმულის დამატება",
      });

      return NextResponse.json({ success: true, attachment });
    }

    // Multipart file upload (images, docs, pasted screenshots)
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ფაილი არ არის არჩეული" }, { status: 400 });
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "ფაილის მაქსიმალური ზომაა 25MB" }, { status: 400 });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const safeExtension = path.extname(file.name) || ".bin";
    const storedFileName = `${crypto.randomUUID()}${safeExtension}`;
    const destinationPath = path.join(UPLOAD_DIR, storedFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(destinationPath, buffer);

    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        userId: user.id,
        originalName: file.name,
        storedName: storedFileName,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        isExternal: false,
      },
    });

    await logAuditEvent({
      taskId,
      actorId: user.id,
      action: "ATTACHMENT_ADDED",
      entityType: "ATTACHMENT",
      entityId: attachment.id,
      newValues: { originalName: file.name, sizeBytes: file.size },
      reason: "ფაილის ატვირთვა",
    });

    return NextResponse.json({ success: true, attachment });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("POST /api/tasks/[id]/attachments error:", error);
    return NextResponse.json({ error: "სერვერის შეცდომა" }, { status: 500 });
  }
}
