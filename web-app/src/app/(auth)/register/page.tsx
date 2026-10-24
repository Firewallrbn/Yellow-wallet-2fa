import { BackLink } from "@/components/ui";

import { RegisterForm } from "./register-form";

export const metadata = { title: "Crear cuenta · FastPay" };

export default function RegisterPage() {
  return (
    <>
      <div className="flex items-center justify-between">
        <BackLink href="/" />
        <span className="text-sm text-muted">Nueva billetera</span>
      </div>
      <div className="rise my-auto py-10">
        <h1 className="text-4xl font-medium tracking-tight">Crea tu billetera</h1>
        <p className="mt-2 text-muted">
          Al terminar activarás el 2FA escaneando un QR con tu app Authenticator.
        </p>
        <RegisterForm />
      </div>
    </>
  );
}
