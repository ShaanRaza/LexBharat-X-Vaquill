import type { Metadata } from "next";
import Link from "next/link";
import { PageHero, Section, DataNote } from "@/components/ui";
import MockBadge from "@/components/MockBadge";
import DevOnly from "@/components/DevOnly";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Community | ${BRAND_SUFFIX}` };

// The real /slack has no page of its own: it answers with an HTTP 307 redirect to an external chat-workspace invite.
// A local build cannot (and should not) redirect to someone else's workspace, so this page shows what the link does.
export default function Slack() {
  return (
    <>
      <PageHero eyebrow="Community" title="Join the community" lead="On the real site, this address immediately forwards you to an external chat-workspace invitation. This local build shows that step as a page instead." />
      <Section>
        <div className="max-w-w640 rounded-card border border-border bg-surface p-6">
          <DevOnly><p className="text-fs-sm text-muted"><MockBadge>redirect shell</MockBadge></p></DevOnly>
          <h2 className="mt-2 text-fs-22 font-semibold">What happens on the real site</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-6 text-fs-body text-muted">
            <li>You open <code className="rounded bg-raised px-1 font-mono text-fs-sm">/slack</code> on the website.</li>
            <li>The server replies with a <strong>temporary redirect (HTTP 307)</strong> to a third-party invite link.</li>
            <li>Your browser lands on the chat service's own sign-up/join screen.</li>
          </ol>
          <p className="mt-4 text-fs-body text-muted">There is no invite in this build, so the button below does nothing.</p>
          <button disabled className="btn btn-primary mt-5 cursor-not-allowed opacity-50">Join the workspace (inert)</button>
          <p className="mt-6 text-fs-ui"><Link href="/contact" className="text-primary hover:underline">Contact us instead →</Link></p>
        </div>
      </Section>
      <DataNote kind="placeholder" files={["src/app/(site)/slack/page.tsx"]} />
    </>
  );
}
