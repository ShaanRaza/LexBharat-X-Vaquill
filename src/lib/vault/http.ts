// Helpers shared by the Vault and Review API routes. Server-only.
export { bidOf, json, envOf } from "@/lib/drafting/http";
import { vaultConfigured } from "./supabase";
export const NOT_SET_UP = { error: "The Vault is not set up on this server yet (no storage configured)." };
export const vaultReady = () => vaultConfigured();
