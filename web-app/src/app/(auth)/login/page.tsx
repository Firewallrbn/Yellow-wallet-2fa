import { BackLink } from "@/components/ui";

import { LoginForm } from "./login-form";

export const metadata = { title: "Ingresar · FastPay" };

export default function LoginPage() {
  return (
    <>
      <div className="flex items-center justify-between">
        <BackLink href="/" />
        <span className="text-sm text-muted">Paso 1 de 2 · contraseña</span>
      </div>
      <div className="rise my-auto py-10">
        <h1 className="text-4xl font-medium tracking-tight">Bienvenido de vuelta</h1>
        <p className="mt-2 text-muted">Ingresa con tu correo y contraseña. Después te pediremos tu código 2FA.</p>
        <LoginForm />
      </div>
    </>
  );
}
