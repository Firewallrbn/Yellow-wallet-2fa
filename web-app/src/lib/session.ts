import "server-only";

import { cookies } from "next/headers";

// Dos cookies, dos niveles de privilegio (Step-Up):
//  fp_pre    → pre_auth_token: solo sirve para enrolar o verificar el 2FA.
//  fp_access → access_token con mfa_verified: true: abre la bóveda.
export const PRE_AUTH_COOKIE = "fp_pre";
export const ACCESS_COOKIE = "fp_access";

const base = {
  httpOnly: true,
  sameSite: "strict" as const,
  secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
  path: "/",
};

export async function setPreAuth(token: string, maxAge: number) {
  (await cookies()).set(PRE_AUTH_COOKIE, token, { ...base, maxAge });
}

export async function setAccess(token: string, maxAge: number) {
  const jar = await cookies();
  jar.delete(PRE_AUTH_COOKIE);
  jar.set(ACCESS_COOKIE, token, { ...base, maxAge });
}

export async function getPreAuth() {
  return (await cookies()).get(PRE_AUTH_COOKIE)?.value;
}

export async function getAccess() {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(PRE_AUTH_COOKIE);
  jar.delete(ACCESS_COOKIE);
}
