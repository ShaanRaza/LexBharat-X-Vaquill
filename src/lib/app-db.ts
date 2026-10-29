// The database connection for the app's OWN tables (saved chats, drafts, reviews, usage). Kept apart from src/lib/legal-data on purpose: if the legal data moves to another source, this connection stays.
export { query, dbConfigured } from "@/lib/acts/db";
