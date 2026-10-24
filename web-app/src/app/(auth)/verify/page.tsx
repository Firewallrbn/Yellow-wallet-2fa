import { BackLink } from "@/components/ui";

import { VerifyForm } from "./verify-form";

export const metadata = { title: "Verificación 2FA · FastPay" };

export default function VerifyPage() {
  return (
    <>
      <div className="flex items-center justify-between">
        <BackLink href="/login" />
        <span className="text-sm text-muted">Paso 2 de 2 · segundo factor</span>
      </div>
      <div className="rise my-auto py-10">
        <VerifyForm />
      </div>
    </>
  );
}
