"use client";
import { useCallback, useEffect, useState } from "react";
import { MOCK_KEY_STORAGE } from "@/data/playgroundSpec";

// MOCK: stands in for the real "Create API key" flow. The key is random text kept in this browser's localStorage; it is never
// sent anywhere except to the local mock /api/playground/run route, and it unlocks nothing real.
const EVT = "lb-mock-key";
const read = () => { try { return localStorage.getItem(MOCK_KEY_STORAGE); } catch { return null; } };

export function useMockKey() {
  const [key, setKey] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const sync = () => setKey(read());
    sync(); setReady(true);
    window.addEventListener(EVT, sync); window.addEventListener("storage", sync);
    return () => { window.removeEventListener(EVT, sync); window.removeEventListener("storage", sync); };
  }, []);
  const create = useCallback(() => {
    const k = "vq_mock_" + Array.from(crypto.getRandomValues(new Uint8Array(12))).map((b) => b.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem(MOCK_KEY_STORAGE, k); } catch { /* storage blocked: key lives for this page view only */ }
    setKey(k); window.dispatchEvent(new Event(EVT));
  }, []);
  const clear = useCallback(() => { try { localStorage.removeItem(MOCK_KEY_STORAGE); } catch { /* ignore */ } setKey(null); window.dispatchEvent(new Event(EVT)); }, []);
  return { key, ready, create, clear };
}
