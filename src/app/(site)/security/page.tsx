import type { Metadata } from "next";
import LegalView from "@/components/LegalView";
import { BRAND_SUFFIX } from "@/lib/release";

export const metadata: Metadata = { title: `Security | ${BRAND_SUFFIX}` };

export default function Security() { return <LegalView slug="security" />; }
