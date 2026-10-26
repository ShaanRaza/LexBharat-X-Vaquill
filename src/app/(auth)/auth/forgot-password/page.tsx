import type { Metadata } from "next";
import Link from "next/link";
import MockForm from "@/components/MockForm";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Reset password | ${BRAND_SUFFIX}` };

export default function Forgot() {
  return (
    <>
      <h1 className="text-center text-fs-30 font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-2 text-center text-fs-body text-muted">UI shell only: no email is sent and no account exists.</p>
      <div className="mt-6"><MockForm kind="login" submitLabel="Send reset link" compact fields={[{ name: "email", label: "Email address", type: "email", required: true }]} /></div>
      <p className="mt-4 text-center text-fs-ui"><Link href="/auth/login" className="text-primary hover:underline">Back to sign in</Link></p>
    </>
  );
}
