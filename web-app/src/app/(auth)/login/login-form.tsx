"use client";

import Link from "next/link";
import { useActionState } from "react";

import { login } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorNote, Field } from "@/components/ui";

export function LoginForm() {
  const [state, action] = useActionState(login, undefined);

  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <Field label="Correo" name="email" type="email" autoComplete="email" required placeholder="demo@fastpay.dev" />
      <Field label="Contraseña" name="password" type="password" autoComplete="current-password" required />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <SubmitButton pendingLabel="Verificando…">Continuar</SubmitButton>
      <p className="text-center text-sm text-muted">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-ink underline underline-offset-4">
          Crear una
        </Link>
      </p>
    </form>
  );
}
