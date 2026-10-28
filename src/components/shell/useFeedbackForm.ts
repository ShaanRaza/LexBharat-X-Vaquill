"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";

// The Feedback form's logic: send { message, email?, page } to /api/feedback/message and report what happened in plain words. No styling here.
export type FeedbackState = "idle" | "sending" | "sent" | "error";
export function useFeedbackForm() {
  const page = usePathname(), [message, setMessage] = useState(""), [email, setEmail] = useState(""), [state, setState] = useState<FeedbackState>("idle"), [error, setError] = useState("");
  async function send() {
    setState("sending"); setError("");
    try {
      const r = await fetch("/api/feedback/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, email, page }) }), j = await r.json().catch(() => ({}));
      if (!r.ok) { setError(j.error || "Your message could not be sent. Please try again."); setState("error"); return; }
      setState("sent"); setMessage(""); setEmail("");
    } catch { setError("Your message could not be sent. Check your connection and try again."); setState("error"); }
  }
  const reset = () => { setState("idle"); setError(""); };
  return { message, setMessage, email, setEmail, state, error, send, reset };
}
