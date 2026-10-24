"use client";
import { useRef, useState } from "react";
import { ACCEPT } from "@/lib/vault/files.mjs";
import type { UploadNote } from "./useVault";

// The "Add documents" control shared by the Vault and Review pages. Presentation only; the upload itself is useVault().upload.
export default function UploadButton({ onFiles, label = "Add documents", multiple = true, className = "" }: { onFiles: (f: File[]) => Promise<UploadNote[]>; label?: string; multiple?: boolean; className?: string }) {
  const input = useRef<HTMLInputElement>(null), [busy, setBusy] = useState(false);
  return (
    <>
      <input ref={input} id="vault-file" type="file" multiple={multiple} accept={ACCEPT} className="sr-only" aria-label="Choose files to add (PDF, Word, text, or a JPG or PNG picture, up to 10 MB each)" tabIndex={-1}
        onChange={async (e) => { const f = Array.from(e.target.files ?? []); e.target.value = ""; if (!f.length) return; setBusy(true); await onFiles(f); setBusy(false); }} />
      <button type="button" disabled={busy} onClick={() => input.current?.click()} className={`h-11 rounded-panel bg-primary px-5 text-ui-base font-medium text-on-primary hover:bg-primary-hover disabled:opacity-50 ${className}`}>{busy ? "Uploading…" : label}</button>
    </>
  );
}
