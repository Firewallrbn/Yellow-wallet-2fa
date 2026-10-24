"use client";

import { ArrowRight, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { pillClass } from "./ui";

export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={pillClass}>
      {pending ? (
        <>
          <LoaderCircle className="size-4 animate-spin" /> {pendingLabel}
        </>
      ) : (
        <>
          {children} <ArrowRight className="size-4" />
        </>
      )}
    </button>
  );
}
