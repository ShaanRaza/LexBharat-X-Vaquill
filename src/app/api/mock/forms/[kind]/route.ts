// MOCK ENDPOINT: every contact-style form (contact, legal-aid, affiliates, delete-data, auth) posts here.
// It validates that the required fields are present and returns a success message. NOTHING is stored or emailed.
const required: Record<string, string[]> = {
  contact: ["name", "email", "message"],
  "legal-aid": ["name", "email", "organization"],
  affiliate: ["name", "email", "where"],
  "delete-data": ["email"],
  login: ["email"],
  signup: ["email", "name"],
};

export async function POST(req: Request, ctx: { params: Promise<{ kind: string }> }) {
  const { kind } = await ctx.params;
  const need = required[kind];
  if (!need) return Response.json({ _mock: true, ok: false, error: "Unknown form" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  const missing = need.filter((k) => !b[k]?.trim());
  if (missing.length) return Response.json({ _mock: true, ok: false, error: `Please fill in: ${missing.join(", ")}` }, { status: 400 });
  if (b.email && !/^\S+@\S+\.\S+$/.test(b.email)) return Response.json({ _mock: true, ok: false, error: "Enter a valid email." }, { status: 400 });
  const msg = kind === "login" || kind === "signup"
    ? "Mock: this build has no accounts. Nothing was created and no email was sent."
    : "Mock: thanks, this was not sent anywhere. Nothing was stored.";
  return Response.json({ _mock: true, ok: true, message: msg });
}
