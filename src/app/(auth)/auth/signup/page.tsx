import type { Metadata } from "next";
import Link from "next/link";
import MockForm from "@/components/MockForm";
import { DataNote } from "@/components/ui";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Create account | ${BRAND_SUFFIX}` };

export default function Signup() {
  return (
    <>
      <h1 className="text-center text-[30px] font-semibold tracking-[-0.02em]">Create your account</h1>
      <div className="mt-6">
        <MockForm kind="signup" submitLabel="Continue" compact fields={[
          { name: "email", label: "Email address", type: "email", required: true, placeholder: "you@company.com" },
          { name: "name", label: "Full Name", required: true },
        ]} />
      </div>
      <p className="mt-4 text-center text-[14px] text-muted">Already have an account? <Link href="/auth/login" className="text-primary hover:underline">Sign in</Link></p>
      <div className="mt-10"><DataNote kind="mock-api" files={["/api/mock/forms/signup"]} /></div>
    </>
  );
}
