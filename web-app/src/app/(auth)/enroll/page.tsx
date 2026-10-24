import { BackLink } from "@/components/ui";

import { EnrollFlow } from "./enroll-flow";

export const metadata = { title: "Activar 2FA · FastPay" };

export default function EnrollPage() {
  return (
    <>
      <div className="flex items-center justify-between">
        <BackLink href="/login" />
        <span className="text-sm text-muted">Activar autenticación en dos pasos</span>
      </div>
      <div className="rise my-auto py-10">
        <EnrollFlow />
      </div>
    </>
  );
}
