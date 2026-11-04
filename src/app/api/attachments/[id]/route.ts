import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth";
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

    const filePath = path.join(UPLOAD_DIR, attachment.storedName);

    try {
      const fileBuffer = await fs.readFile(filePath);
      return new NextResponse(fileBuffer, {
        headers: {
          "Content-Type": attachment.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
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
