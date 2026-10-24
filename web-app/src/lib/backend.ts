import "server-only";

// BFF: solo el servidor de Next.js habla con FastAPI. El navegador nunca ve los JWT.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export class BackendError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

function messageFrom(body: unknown, status: number): { code: string; message: string } {
  if (body && typeof body === "object") {
    const b = body as Record<string, unknown>;
    if (typeof b.message === "string") return { code: String(b.error ?? "error"), message: b.message };
    if (typeof b.detail === "string") return { code: "error", message: b.detail };
    if (Array.isArray(b.detail)) return { code: "validation_error", message: "Revisa los datos del formulario" };
  }
  return { code: "error", message: `El servidor respondió ${status}` };
}

export async function backend<T>(
  path: string,
  init: { method?: "GET" | "POST"; body?: unknown; token?: string } = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BACKEND_URL}${path}`, {
      method: init.method ?? "POST",
      headers: {
        "content-type": "application/json",
        ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new BackendError(503, "backend_unreachable", "No se pudo contactar al servidor de autenticación");
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const { code, message } = messageFrom(body, res.status);
    throw new BackendError(res.status, code, message);
  }
  return body as T;
}

// ── Contratos de la API FastAPI ──

export interface LoginResponse {
  pre_auth_token: string;
  expires_in: number;
  next_step: "enroll" | "verify";
}

export interface EnrollResponse {
  status: "PENDING_VERIFICATION";
  secret: string;
  otpauth_uri: string;
  qr_svg: string;
}

export interface SessionResponse {
  access_token: string;
  expires_in: number;
  mfa_verified: true;
  method: "totp" | "backup";
  matched_window: "C-1" | "C" | "C+1" | null;
  backup_codes?: string[];
}

export interface Transaction {
  id: number;
  kind: "send" | "receive" | "deposit" | "withdraw";
  counterparty: string;
  amount: number;
  occurred_at: string;
}

export interface Vault {
  full_name: string;
  email: string;
  balance: number;
  currency: string;
  card_brand: string;
  card_number: string;
  card_cvv: string;
  card_expiry: string;
  card_holder: string;
  backup_codes_remaining: number;
  transactions: Transaction[];
  session: { mfa_verified: boolean; amr: string[]; exp: number };
}
