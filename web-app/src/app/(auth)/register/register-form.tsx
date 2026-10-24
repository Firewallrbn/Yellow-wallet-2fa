"use client";

import Link from "next/link";
import { useActionState } from "react";

import { register } from "@/app/actions";
import { SubmitButton } from "@/components/submit-button";
import { ErrorNote, Field } from "@/components/ui";

export function RegisterForm() {
  const [state, action] = useActionState(register, undefined);

  return (
    <form action={action} className="mt-8 flex flex-col gap-5">
      <Field label="Nombre completo" name="full_name" autoComplete="name" required minLength={2} />
      <Field label="Correo" name="email" type="email" autoComplete="email" required />
      <Field
        label="Contraseña"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="Mínimo 8 caracteres. Se guarda con argon2, nunca en texto plano."
      />
      {state?.error && <ErrorNote>{state.error}</ErrorNote>}
      <SubmitButton pendingLabel="Creando…">Crear cuenta</SubmitButton>
      <p className="text-center text-sm text-muted">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-ink underline underline-offset-4">
          Ingresar
        </Link>
      </p>
    </form>
  );
}
