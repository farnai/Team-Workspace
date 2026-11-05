import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("არასწორი ელ.ფოსტის ფორმატი"),
  password: z.string().min(1, "პაროლი სავალდებულოა"),
});

// Lightweight server-side rate limiting for private workspace (~10 users)
// Max 5 failed attempts per 60 seconds per IP + Email combination.
interface LoginAttemptRecord {
  count: number;
  firstAttemptAt: number;
  blockedUntil?: number;
}

const loginAttempts = new Map<string, LoginAttemptRecord>();

function getClientIdentifier(req: NextRequest, email: string): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0].trim() : "127.0.0.1";
  return `${ip}:${email.toLowerCase().trim()}`;
}

function checkRateLimit(key: string): { isBlocked: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record) {
    return { isBlocked: false, retryAfterSeconds: 0 };
  }

  // If blocked, check if block has expired
  if (record.blockedUntil && now < record.blockedUntil) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.blockedUntil - now) / 1000));
    return { isBlocked: true, retryAfterSeconds };
  }

  // Reset window if older than 60s and not blocked
  if (now - record.firstAttemptAt > 60_000 && (!record.blockedUntil || now >= record.blockedUntil)) {
    loginAttempts.delete(key);
    return { isBlocked: false, retryAfterSeconds: 0 };
  }

  return { isBlocked: false, retryAfterSeconds: 0 };
}

function recordFailedAttempt(key: string): void {
  const now = Date.now();
  const existing = loginAttempts.get(key);

  if (!existing || now - existing.firstAttemptAt > 60_000) {
    loginAttempts.set(key, { count: 1, firstAttemptAt: now });
  } else {
    existing.count += 1;
    if (existing.count >= 5) {
      existing.blockedUntil = now + 60_000;
    }
  }

  // Self-cleanup: prune stale entries older than 5 minutes
  if (loginAttempts.size > 500) {
    for (const [k, rec] of loginAttempts.entries()) {
      if (now - rec.firstAttemptAt > 300_000 && (!rec.blockedUntil || now > rec.blockedUntil)) {
        loginAttempts.delete(k);
      }
    }
  }
}

function recordSuccessfulAttempt(key: string): void {
  loginAttempts.delete(key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.issues[0]?.message || "არასწორი მონაცემები" },
        { status: 400 }
      );
    }

    const { email, password } = result.data;
    const rateLimitKey = getClientIdentifier(req, email);

    // Rate limit check
    const { isBlocked, retryAfterSeconds } = checkRateLimit(rateLimitKey);
    if (isBlocked) {
      return NextResponse.json(
        {
          error: "ძალიან ბევრი წარუმატებელი მცდელობა. გთხოვთ სცადოთ 1 წუთში.",
          retryAfter: retryAfterSeconds,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSeconds) },
        }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        { error: "ელ.ფოსტა ან პაროლი არასწორია" },
        { status: 401 }
      );
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      recordFailedAttempt(rateLimitKey);
      return NextResponse.json(
        { error: "ელ.ფოსტა ან პაროლი არასწორია" },
        { status: 401 }
      );
    }

    // Login successful: reset rate limiter
    recordSuccessfulAttempt(rateLimitKey);
    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    console.error("Login API error:", error);
    return NextResponse.json(
      { error: "სერვერის შეცდომა ავტორიზაციისას" },
      { status: 500 }
    );
  }
}
