// MOCK ENDPOINT: nothing is stored or sent anywhere. It only validates the shape of an email
// and echoes a canned success response so the footer form has something to talk to.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const ok = typeof body.email === "string" && /^\S+@\S+\.\S+$/.test(body.email);
  if (!ok) return Response.json({ ok: false, _mock: true, error: "Enter a valid email." }, { status: 400 });
  return Response.json({ ok: true, _mock: true, message: "Mock subscribe: nothing was saved." });
}
