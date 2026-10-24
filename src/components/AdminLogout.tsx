"use client";
export default function AdminLogout() {
  return <button type="button" onClick={async () => { await fetch("/api/admin/logout", { method: "POST" }); window.location.reload(); }} className="min-h-9 rounded-panel px-3 text-ui-sm ring-1 ring-border hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary">Sign out</button>;
}
