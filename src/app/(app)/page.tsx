import type { Metadata } from "next";
import Desk from "@/components/desk/Desk";
import AppShell from "@/components/shell/AppShell";

export const metadata: Metadata = { title: "Desk | LexBharat" };
export default function DeskPage() { return <AppShell><Desk /></AppShell>; }
