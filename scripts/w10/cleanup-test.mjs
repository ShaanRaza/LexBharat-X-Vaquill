// Removes the W10 test copies from the MAIN databases (reg_* tables, regulatory_emb_256) once the real projects hold the data.
import { q, vq } from "./env.mjs";
await q("DROP TABLE IF EXISTS reg_sections, reg_acts CASCADE");
await vq("DROP TABLE IF EXISTS regulatory_emb_256");
console.log((await q("select pg_size_pretty(pg_database_size(current_database())) s"))[0], (await vq("select pg_size_pretty(pg_database_size(current_database())) s"))[0]);
