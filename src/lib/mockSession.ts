"use client";
import { useEffect, useState } from "react";

// MOCK SESSION: stands in for a sign-in. It is a small record kept in this browser's localStorage only. It is not a login: nothing is
// verified, nothing is sent anywhere, and no part of the app is gated by it. It only lets the console show which email "signed in".
export type MockSession = { email: string; at: string; mock: true };
const KEY = "lb_mock_session";
const EVT = "lb-mock-session";

export function readMockSession(): MockSession | null {
  try { const r = localStorage.getItem(KEY); return r ? (JSON.parse(r) as MockSession) : null; } catch { return null; }
}
export function setMockSession(email: string) {
  try { localStorage.setItem(KEY, JSON.stringify({ email, at: new Date().toISOString(), mock: true } satisfies MockSession)); } catch { /* storage blocked: sign-in still navigates, the console just shows the default name */ }
  window.dispatchEvent(new Event(EVT));
}
export function clearMockSession() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVT));
}
export function useMockSession(): MockSession | null {
  const [s, setS] = useState<MockSession | null>(null);
  useEffect(() => {
    const sync = () => setS(readMockSession());
    sync(); window.addEventListener(EVT, sync); window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  return s;
}
