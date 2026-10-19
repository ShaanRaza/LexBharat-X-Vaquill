// Builds the request that a form state represents, and the cURL / Python / JavaScript snippets for it.
//
// CONFIRMED from the live Code tab (docs/PLAYGROUND-TEARDOWN.md): host https://api.vaquill.ai, `Authorization: Bearer $VAQUILL_API_KEY`,
// only filled values are included, 2-space JSON bodies, the exact line layout of all three snippets for POST /us/statutes/search and
// GET /api-credits/pricing, and the live product's bug: the JavaScript snippet has NO comma after `method: "POST"`.
// INFERRED: how GET query strings are laid out in each language, path-parameter substitution, and treating every non-GET verb like POST.
import type { SpecEndpoint, SpecField } from "@/data/playgroundSpec";

export const API_HOST = "https://api.vaquill.ai";
export type FormValue = string | boolean | undefined;
export type FormValues = Record<string, FormValue>;

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);

export function isFilled(f: SpecField, v: FormValue): boolean {
  if (f.kind === "boolean") return v === true || v === false;
  return typeof v === "string" && v.trim() !== "";
}

/** Form value -> JSON value, or undefined when the field is empty. */
export function coerce(f: SpecField, v: FormValue): string | number | boolean | string[] | undefined {
  if (!isFilled(f, v)) return undefined;
  if (f.kind === "boolean") return v as boolean;
  const s = (v as string).trim();
  if (f.kind === "number") return Number.isFinite(Number(s)) ? Number(s) : undefined;
  if (f.kind === "array") return lines(s);
  if (f.multi) { const l = lines(s); return l.length > 1 ? l : l[0]; }
  return s;
}

export function buildRequest(e: SpecEndpoint, values: FormValues) {
  const query: Record<string, unknown> = {};
  const body: Record<string, unknown> = {};
  let path = e.path;
  for (const f of e.fields) {
    const c = coerce(f, values[f.name]);
    if (c === undefined) continue;
    if (f.in === "path") path = path.replace(`{${f.name}}`, encodeURIComponent(String(c)));
    else if (f.in === "query") query[f.name] = c;
    else body[f.name] = c;
  }
  const qs = Object.entries(query).flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => `${encodeURIComponent(k)}=${encodeURIComponent(String(x))}`)).join("&");
  return { url: `${API_HOST}${path}${qs ? `?${qs}` : ""}`, bareUrl: `${API_HOST}${path}`, query, body, hasBody: Object.keys(body).length > 0 || (e.method !== "GET" && e.method !== "DELETE" && e.fields.some((f) => f.in === "body")) };
}

const py = (v: unknown, ind: string): string => {
  if (Array.isArray(v)) return `[${v.map((x) => py(x, ind)).join(", ")}]`;
  if (typeof v === "boolean") return v ? "True" : "False";
  return JSON.stringify(v);
};

export type Lang = "cURL" | "Python" | "JavaScript";

export function buildSnippet(e: SpecEndpoint, values: FormValues, lang: Lang): string {
  const r = buildRequest(e, values);
  const json = JSON.stringify(r.body, null, 2);
  const isGet = e.method === "GET";
  if (lang === "cURL") {
    let s = `curl -X ${e.method} '${r.url}' \\\n  -H "Authorization: Bearer $VAQUILL_API_KEY"`;
    if (!isGet && r.hasBody) s += ` \\\n  -H "Content-Type: application/json" \\\n  -d '${json}'`;
    return s;
  }
  if (lang === "Python") {
    const verb = e.method.toLowerCase();
    let s = `import os, requests\nurl = "${r.bareUrl}"\nheaders = {"Authorization": f"Bearer {os.environ['VAQUILL_API_KEY']}"}\n`;
    const dict = (o: Record<string, unknown>) => `{\n${Object.entries(o).map(([k, v]) => `    ${JSON.stringify(k)}: ${py(v, "    ")},\n`).join("")}}`;
    if (isGet || !r.hasBody) {
      const hasQ = Object.keys(r.query).length > 0;
      if (hasQ) s += `params = ${dict(r.query)}\n`;
      s += `r = requests.${verb}(url, headers=headers${hasQ ? ", params=params" : ""})\n`;
    } else {
      s += `payload = ${dict(r.body)}\n`;
      s += `r = requests.${verb}(url, headers=headers, json=payload)\n`;
    }
    return s + `r.raise_for_status()\nprint(r.json())`;
  }
  // JavaScript. The missing comma after `method: "POST"` reproduces a bug in the live product; GET keeps its comma.
  let s = `const res = await fetch("${r.url}", {\n  method: "${e.method}"${isGet ? "," : ""}\n  headers: {\n    Authorization: \`Bearer \${process.env.VAQUILL_API_KEY}\`,\n`;
  if (!isGet && r.hasBody) s += `    "Content-Type": "application/json",\n  },\n  body: JSON.stringify(${json}),\n});\n`;
  else s += `  },\n});\n`;
  return s + "if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);\nconsole.log(await res.json());";
}
