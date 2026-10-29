"use client";
// Small "Log out" link: clears the access cookie, then returns to the password page. Shown wherever the site shows a footer or sidebar.
export default function LogoutLink({ className = "", role }: { className?: string; role?: string }) {
  return (
    <button type="button" role={role} className={className || "text-ui-sm text-primary underline hover:no-underline"}
      onClick={async () => { await fetch("/api/access/logout", { method: "POST" }).catch(() => null); window.location.assign("/access"); }}>Log out</button>
  );
}
