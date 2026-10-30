# LexBharat

LexBharat is a working legal-research workspace for Indian law, **in a testing phase**. It is **not legal advice** and is protected by an access password; do not enter confidential client information.

What it does today:

- **Browse and search Acts**: Central and State/UT Acts (about 10,000), the Constitution of India, Orders/Rules/Schedules for a few Acts, regulator instruments (RBI, SEBI, MCA, DGFT, TRAI, IRDAI and others) and Law Commission reports. Keyword search, section lookup ("138 NI Act"), search by meaning, and Hindi keyword search over the Hindi text we show. Every section carries a quality label (complete / possibly incomplete / unreliable) and a link to the official source.
- **Judgments**: Supreme Court (37,014 case records, full English text on case pages, search inside the text by meaning or words, statute links), High Court case lists for 25 courts (case records only).
- **Chat** with citations to Act sections and Supreme Court judgment excerpts, with an automatic answer check.
- **Drafting** (five templates), **Review** of an uploaded contract (clause risks, missing clauses, Indian-law points) and a **Vault** for your own documents (PDF, Word, text, scans), all stored per browser, no accounts.

How honest it tries to be: where the source data is missing, scrambled or incomplete, the page says so, with counts and reasons (`docs/DATA-GAPS.md`, `docs/MISSING-SECTIONS.md`, `docs/SC-RECONCILIATION.md`).

## Stack

Next.js 15 (App Router, TypeScript), Tailwind CSS 3 with one design-token file (`src/styles/tokens.css`), Neon Postgres (with pgvector), Supabase (file storage, usage counters, feedback), Vercel (hosting and analytics), Voyage AI (`voyage-4` embeddings, 256 dimensions) and Google Gemini (answers, drafting, review, scan reading) through a small provider layer (`src/lib/ai`; LiteLLM or Anthropic can be configured instead).

## Run it locally

```bash
npm install
cp .env.example .env.local     # fill in the values you have; see below
npm run dev                    # http://localhost:3100
```

Without any keys the app starts, but search, chat and the stores report "not available yet" instead of failing. Local-only data (the full High Court case lists, local files) is read from folders named in `.env.local` (see `.env.example`).

Checks: `npm run test:extract` (unit tests), `npm run qa:sweep` (offline check of all Supreme Court records), `npm run build`.

## Environment variables

All names are in [`.env.example`](.env.example), with a comment for each. Secrets are never committed (`.env*.local` is git-ignored). On Vercel set them for **Production** and, to test a branch, also for **Preview**.

| Group | Variables |
|---|---|
| Access gate | `ACCESS_PASSWORD`, `ACCESS_COOKIE_SECRET`, `ADMIN_PASSWORD` |
| Main database (Acts, chats, drafts) | `DATABASE_URL` |
| Vectors (search by meaning) | `VECTOR_DATABASE_URL` (Acts), `VECTOR_DATABASE_URL_REGULATORY`, `VECTOR_DATABASE_URL_SC` |
| Regulator and judgment text | `REG_DATABASE_URL`, `SC_DATABASE_URL`, `SC_KEYWORD_DATABASE_URL` |
| Supabase (Vault, feedback, counters) | `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VAULT_BUCKET` |
| AI | `GEMINI_API_KEY`, `VOYAGE_API_KEY` |

## Data and licences

- Legal data: [open-india-law](https://huggingface.co/datasets/vaquill/open-india-law) by Vaquill AI, compiled from India Code and regulator websites, **CC BY 4.0** (credited on every page that uses it). Source judgment PDFs: eCourts and the Supreme Court of India, published on the AWS Open Data Registry by Dattam Labs (CC BY 4.0).
- `content/supplement/` holds section text copied by hand from India Code's Act PDFs to fill gaps in the dataset. Written permission to republish the India Code text has been received (details in [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md)). Each row keeps its "Source: India Code, copied <date>" label.
- Fonts: Geist, Geist Mono, Source Serif 4, IBM Plex Sans Devanagari (SIL Open Font License). See [`NOTICE.md`](NOTICE.md).

## Where to read more

| File | What it explains |
|---|---|
| [`docs/DATA-GAPS.md`](docs/DATA-GAPS.md) | What is missing or wrong in the data, with counts and a ranked fix list |
| [`docs/W10.md`](docs/W10.md), [`docs/W9.md`](docs/W9.md), [`docs/W8.md`](docs/W8.md) | What was built in each work package, how it was checked |
| [`docs/MISSING-SECTIONS.md`](docs/MISSING-SECTIONS.md), [`docs/SC-RECONCILIATION.md`](docs/SC-RECONCILIATION.md), [`docs/SC-TEXT-OVERLAP.md`](docs/SC-TEXT-OVERLAP.md) | Section gaps, Supreme Court counts, repeated-text check |
| [`docs/PDF-DOWNLOAD-LIST.md`](docs/PDF-DOWNLOAD-LIST.md) | India Code PDFs still to be downloaded by hand |
| [`docs/RESKIN-PLAN.md`](docs/RESKIN-PLAN.md) | The visual reskin plan and its phases (branch `reskin`) |
| [`docs/CHAT.md`](docs/CHAT.md), [`docs/DRAFTING.md`](docs/DRAFTING.md), [`docs/VAULT.md`](docs/VAULT.md) | How Chat, Drafting and the Vault work |
| [`docs/ACTS-SEARCH-W1B.md`](docs/ACTS-SEARCH-W1B.md), [`docs/SEMANTIC-ACTS.md`](docs/SEMANTIC-ACTS.md), [`docs/JUDGMENTS-HC.md`](docs/JUDGMENTS-HC.md) | Search, search by meaning, judgments |
| [`docs/README-OLD-MOCK-BUILD.md`](docs/README-OLD-MOCK-BUILD.md) | The original README of the first, mock-only build (history) |

The public marketing pages in `src/app/(site)` and the developer-console pages (`/developer`, `/docs`, the Playground) come from the first, mock-only build: they are demonstration pages with placeholder content, not a product claim (see the old README above).
