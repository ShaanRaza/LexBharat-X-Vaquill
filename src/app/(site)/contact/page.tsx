import type { Metadata } from "next";
import { PageHero, Section, DataNote } from "@/components/ui";
import MockForm from "@/components/MockForm";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Contact | ${BRAND_SUFFIX}` };

export default function Contact() {
  return (
    <>
      <PageHero eyebrow="Contact" title="Get in touch" lead="Questions about the API, pricing, or a privacy or legal matter? Drop us a line. (Mock form: nothing is sent.)" />
      <Section>
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <MockForm kind="contact" submitLabel="Send message" fields={[
            { name: "name", label: "Name", required: true },
            { name: "email", label: "Email", type: "email", required: true },
            { name: "topic", label: "Topic", type: "select", options: ["Product question", "Pricing", "Privacy or legal", "Partnership"] },
            { name: "message", label: "Message", type: "textarea", required: true },
          ]} />
          <aside className="rounded-panel border border-border bg-surface p-6 text-fs-body">
            <h2 className="text-fs-lead font-semibold">Email</h2>
            <p className="mt-1 text-primary">hello@lexbharat.example</p>
            <p className="mt-4 text-muted">We aim to reply within one business day (placeholder copy).</p>
          </aside>
        </div>
      </Section>
      <DataNote kind="mock-api" files={["/api/mock/forms/contact"]} />
    </>
  );
}
