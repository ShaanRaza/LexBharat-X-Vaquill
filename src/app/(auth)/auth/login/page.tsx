import type { Metadata } from "next";
import Link from "next/link";
import MockForm from "@/components/MockForm";
import { DataNote } from "@/components/ui";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Sign in | ${BRAND_SUFFIX}` };

export default function Login() {
  return (
    <>
      <h1 className="text-center text-fs-30 font-semibold tracking-tight">Welcome back</h1>
      <div className="mt-6">
        <MockForm kind="login" mode="signin" submitLabel="Continue" compact fields={[{ name: "email", label: "Email address", type: "email", required: true, placeholder: "you@company.com" }]} />
      </div>
      <p className="mt-3 text-center text-fs-sm text-muted">Mock sign-in: any valid email works. No account is created, nothing is sent, and the session stays in this browser only.</p>
      <p className="mt-4 text-center text-fs-ui"><Link href="/auth/forgot-password" className="text-primary hover:underline">Forgot password?</Link></p>
      <p className="mt-2 text-center text-fs-ui text-muted">Don’t have an account? <Link href="/auth/signup" className="text-primary hover:underline">Create an account</Link></p>
      <div className="mt-10"><DataNote kind="mock-api" files={["/api/mock/forms/login"]} /></div>
    </>
  );
}
