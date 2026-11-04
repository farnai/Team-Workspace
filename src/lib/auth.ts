import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { User, Role } from "@prisma/client";
import crypto from "crypto";

const SESSION_COOKIE_NAME = "tw_session_token";
const SESSION_MAX_AGE_DAYS = 30;

export async function createSession(userId: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_MAX_AGE_DAYS);

  await prisma.session.create({
    data: {
      userId,
      token,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });

  return token;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    try {
      await prisma.session.deleteMany({
        where: { token },
      });
    } catch {
      // Ignore deletion errors on expired sessions
    }
    cookieStore.delete(SESSION_COOKIE_NAME);
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

    if (!token) return null;

    const session = await prisma.session.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!session) return null;

    if (session.expiresAt < new Date()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    if (!session.user.isActive) {
      return null;
    }

    return session.user;
  } catch (error: unknown) {
    if ((error as { digest?: string })?.digest === "HANGING_PROMISE_REJECTION") {
      throw error;
    }
    console.error("Error retrieving current user:", error);
    return null;
  }
}

export async function requireAuth(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireAuth();
  if (user.role !== Role.ADMIN) {
    throw new Error("FORBIDDEN");
  }
  return user;
}
