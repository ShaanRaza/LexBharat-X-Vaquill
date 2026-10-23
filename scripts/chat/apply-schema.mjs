#!/usr/bin/env node
// Applies scripts/chat/chat-schema.sql to the main Neon database (DATABASE_URL from .env.local; never printed). Safe to run again.
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { env } from "../acts/bakeoff-lib.mjs";

const sql = neon(env.DATABASE_URL);
for (const stmt of fs.readFileSync("scripts/chat/chat-schema.sql", "utf8").replace(/--.*$/gm, "").split(";").map((s) => s.trim()).filter(Boolean)) await sql.query(stmt);
const r = await sql.query("SELECT (SELECT count(*) FROM chats)::int chats, (SELECT count(*) FROM chat_messages)::int messages, pg_size_pretty(pg_database_size(current_database())) size");
console.log("chat tables ready:", JSON.stringify(r[0]));
