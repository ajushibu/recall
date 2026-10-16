// Served as /config.js (see next.config.js). Hands the browser the two public Supabase values.
// Both are safe to expose: every row is locked to its owner by row-level security.

export const dynamic = "force-dynamic";

export function GET() {
  const config = {
    supabaseUrl: process.env.SUPABASE_URL || "",
    supabaseKey: process.env.SUPABASE_PUBLISHABLE_KEY || "",
  };
  return new Response("window.RECALL_CONFIG = " + JSON.stringify(config) + ";\n", {
    headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-cache" },
  });
}
