"use server";

import { redirect } from "next/navigation";

import {
  backend,
  BackendError,
  type EnrollResponse,
  type LoginResponse,
  type SessionResponse,
} from "@/lib/backend";
import { clearSession, getPreAuth, setAccess, setPreAuth } from "@/lib/session";

export type FormState = { error?: string; code?: string } | undefined;

function fail(err: unknown): FormState {
  if (err instanceof BackendError) return { error: err.message, code: err.code };
  throw err;
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

// ── Primer factor ──

async function startLogin(email: string, password: string): Promise<never> {
  const res = await backend<LoginResponse>("/auth/login", { body: { email, password } });
  await setPreAuth(res.pre_auth_token, res.expires_in);
  redirect(res.next_step === "verify" ? "/verify" : "/enroll");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  try {
    await startLogin(str(form, "email"), String(form.get("password") ?? ""));
  } catch (err) {
    return fail(err);
  }
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email");
  const password = String(form.get("password") ?? "");
  try {
    await backend("/auth/register", { body: { email, password, full_name: str(form, "full_name") } });
    // Cuenta nueva → login inmediato → el backend responde next_step = "enroll".
    await startLogin(email, password);
  } catch (err) {
    return fail(err);
  }
}

// ── Aprovisionamiento 2FA (Process Manager) ──

export type EnrollState =
  | { error?: string; code?: string; enrollment?: Omit<EnrollResponse, "status"> }
  | undefined;

export async function startEnrollment(): Promise<EnrollState> {
  const pre = await getPreAuth();
  if (!pre) redirect("/login?expired=1");
  try {
    const { secret, otpauth_uri, qr_svg } = await backend<EnrollResponse>("/auth/2fa/enroll", {
      body: { pre_auth_token: pre },
    });
    return { enrollment: { secret, otpauth_uri, qr_svg } };
  } catch (err) {
    return fail(err);
  }
}

export type ConfirmState = { error?: string; code?: string; backupCodes?: string[] } | undefined;

export async function confirmEnrollment(_: ConfirmState, form: FormData): Promise<ConfirmState> {
  const pre = await getPreAuth();
  if (!pre) redirect("/login?expired=1");
  try {
    const res = await backend<SessionResponse>("/auth/2fa/confirm", {
      body: { pre_auth_token: pre, code: str(form, "code") },
    });
    await setAccess(res.access_token, res.expires_in);
    // No se redirige todavía: los códigos de respaldo se muestran UNA sola vez.
    return { backupCodes: res.backup_codes ?? [] };
  } catch (err) {
    return fail(err);
  }
}

// ── Step-Up: segundo factor ──

export async function verifySecondFactor(_: FormState, form: FormData): Promise<FormState> {
  const pre = await getPreAuth();
  if (!pre) redirect("/login?expired=1");
  try {
    const res = await backend<SessionResponse>("/auth/verify-2fa", {
      body: {
        pre_auth_token: pre,
        code: str(form, "code"),
        method: form.get("method") === "backup" ? "backup" : "totp",
      },
    });
    await setAccess(res.access_token, res.expires_in);
  } catch (err) {
    return fail(err);
  }
  redirect("/wallet");
}

export async function logout() {
  await clearSession();
  redirect("/login");
}
