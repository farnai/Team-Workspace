import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { validateFileIntegrity, isPathContained, MAX_ATTACHMENT_SIZE } from "@/lib/fileSecurity";
import path from "path";
import fs from "fs/promises";
import crypto from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id: taskId } = await params;

    const attachments = await prisma.attachment.findMany({
      where: { taskId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, avatarUrl: true } },
      },
    });

    return NextResponse.json({ success: true, attachments });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    console.error("GET /api/tasks/[id]/attachments error:", error);
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

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      // External link (e.g. GitLab, Figma)
      const body = await req.json();
      const { name, url } = body;

      if (!url) {
        return NextResponse.json({ error: "ბმულის URL სავალდებულოა" }, { status: 400 });
      }

      const trimmedUrl = String(url).trim();
      const lowerUrl = trimmedUrl.toLowerCase();
      if (!lowerUrl.startsWith("http://") && !lowerUrl.startsWith("https://")) {
        return NextResponse.json({ error: "ბმული უნდა იწყებოდეს http:// ან https:// პრეფიქსით" }, { status: 400 });
      }

      const originalName = name && String(name).trim() ? String(name).trim() : trimmedUrl;

      const attachment = await prisma.attachment.create({
        data: {
          taskId,
          userId: user.id,
          originalName,
          storedName: "link-" + crypto.randomUUID(),
          mimeType: "text/html",
          sizeBytes: 0,
          url: trimmedUrl,
          isExternal: true,
        },
      });

      await logAuditEvent({
        taskId,
        actorId: user.id,
        action: "ATTACHMENT_ADDED",
        entityType: "ATTACHMENT",
        entityId: attachment.id,
        newValues: { name: attachment.originalName, url: trimmedUrl, isExternal: true },
        reason: "გარე ბმულის დამატება: " + attachment.originalName,
      });

      return NextResponse.json({ success: true, attachment });
    }

    // Multipart file upload (images, docs, pasted screenshots)
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ფაილი არ არის არჩეული" }, { status: 400 });
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      return NextResponse.json({ error: "ფაილის მაქსიმალური ზომაა 25MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Deep file integrity & signature validation
    const integrityCheck = validateFileIntegrity(buffer, file.name, file.type || "");
    if (!integrityCheck.isValid) {
      return NextResponse.json(
        { error: integrityCheck.error || "ფაილის ფორმატი დაუშვებელია" },
        { status: 400 }
      );
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    const ext = path.extname(file.name).toLowerCase();
    const safeExtension = ext.replace(/[^a-z0-9.]/g, "") || ".bin";
    const storedFileName = `${crypto.randomUUID()}${safeExtension}`;
    const destinationPath = path.resolve(UPLOAD_DIR, storedFileName);

    if (!isPathContained(destinationPath, UPLOAD_DIR)) {
      return NextResponse.json({ error: "არასწორი ფაილის გზა" }, { status: 400 });
    }

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
