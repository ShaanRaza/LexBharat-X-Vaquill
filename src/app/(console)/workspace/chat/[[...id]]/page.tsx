// /workspace/chat (new chat) and /workspace/chat/<id> (an existing chat) are ONE page, so the chat stays mounted while the address changes from the first to the second.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AppShell from "@/components/shell/AppShell";
import ChatApp from "@/components/workspace/chat/ChatApp";
import { isChatId } from "@/lib/chat/store";

export const metadata: Metadata = { title: "Chat | LexBharat" };
export default async function ChatPage({ params }: { params: Promise<{ id?: string[] }> }) {
  const { id } = await params;
  if (id && (id.length !== 1 || !isChatId(id[0]))) notFound();
  return <AppShell><ChatApp chatId={id?.[0]} /></AppShell>;
}
