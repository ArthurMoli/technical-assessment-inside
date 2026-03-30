import { createCookieSessionStorage, redirect } from "@remix-run/node";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: "user" | "admin";
}

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__arthurbank_session",
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET || "arthurbank-dev-secret-change-in-prod"],
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24, // 24 hours
  },
});

export async function getSession(request: Request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

export async function getUser(request: Request): Promise<SessionUser | null> {
  const session = await getSession(request);
  const user = session.get("user");
  if (!user) return null;
  return user as SessionUser;
}

export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getUser(request);
  if (!user) throw redirect("/login");
  return user;
}

export async function requireAdmin(request: Request): Promise<SessionUser> {
  const user = await requireUser(request);
  if (user.role !== "admin") throw redirect("/dashboard");
  return user;
}

export async function createUserSession(user: SessionUser, redirectTo: string) {
  const session = await sessionStorage.getSession();
  session.set("user", user);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

export async function destroyUserSession(request: Request) {
  const session = await getSession(request);
  return redirect("/login", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}
