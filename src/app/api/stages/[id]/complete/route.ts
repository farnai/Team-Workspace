import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { advanceWorkflowStage } from "@/lib/workflow";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id: stageId } = await params;

    const result = await advanceWorkflowStage({
      stageId,
      actorId: user.id,
    });

    return NextResponse.json({ success: true, nextStage: result.nextStage });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "გთხოვთ გაიაროთ ავტორიზაცია" }, { status: 401 });
    }
    if (err.message.includes("არ გაქვთ") || err.message.includes("უფლება")) {
      return NextResponse.json({ error: err.message }, { status: 403 });
    }
    return NextResponse.json({ error: err.message || "სერვერის შეცდომა" }, { status: 400 });
  }
}
