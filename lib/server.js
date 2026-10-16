// Shared server helpers for the API routes: who is calling, and a call to Claude.
// The API key stays on the server. Only the signed-in owner (ALLOWED_EMAIL) may call.

const ANTHROPIC_URL = (process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com").replace(/\/+$/, "") + "/v1/messages";
export const GEN_MODEL = () => process.env.CLAUDE_MODEL || "claude-sonnet-5-5";
export const GRADE_MODEL = () => process.env.CLAUDE_GRADE_MODEL || "claude-haiku-5-5";

export const json = (body, status = 200) => Response.json(body, { status });

// Ask Supabase Auth who owns this access token.
async function whoIs(req) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return { error: "no_supabase" };
  const auth = req.headers.get("authorization") || "";
  if (!/^Bearer\s+\S+/.test(auth)) return { error: "signed_out" };
  let res;
  try {
    res = await fetch(url.replace(/\/+$/, "") + "/auth/v1/user", { headers: { Authorization: auth, apikey: key }, cache: "no-store" });
  } catch {
    return { error: "no_supabase" };
  }
  if (!res.ok) return { error: "signed_out" };
  return { user: await res.json() };
}

// Returns a Response to send back when the caller isn't allowed, or null when they are.
export async function guard(req) {
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "no_api_key" }, 500);
  const who = await whoIs(req);
  if (who.error) return json({ error: who.error }, who.error === "signed_out" ? 401 : 500);
  const allowed = (process.env.ALLOWED_EMAIL || "").trim().toLowerCase();
  if (!allowed || String(who.user?.email || "").toLowerCase() !== allowed) return json({ error: "not_allowed" }, 403);
  return null;
}

// CLAUDE_EFFORT (default "low") limits how much the model "thinks" before answering; thinking is billed
// as output and counts against max_tokens. Set CLAUDE_EFFORT=off to send no effort setting at all.
async function callClaude({ model, system, prompt, maxTokens, withEffort }) {
  const effort = (process.env.CLAUDE_EFFORT || "low").trim().toLowerCase();
  const body = { model, max_tokens: maxTokens, system, messages: [{ role: "user", content: prompt }] };
  if (withEffort && effort && effort !== "off") body.output_config = { effort };
  return fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Sends one prompt to Claude. Resolves to { text } on success or { error: Response } to return as-is.
export async function askClaude({ model, system, prompt, maxTokens }) {
  let res;
  try {
    res = await callClaude({ model, system, prompt, maxTokens, withEffort: true });
    // If this model does not accept the effort setting, try again without it.
    if (res.status === 400) {
      const peek = await res.clone().json().catch(() => null);
      if (/effort|output_config/i.test(String(peek?.error?.message || ""))) {
        console.error("anthropic effort rejected, retrying without it:", peek?.error?.message);
        res = await callClaude({ model, system, prompt, maxTokens, withEffort: false });
      }
    }
  } catch {
    return { error: json({ error: "upstream_error" }, 502) };
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const type = data?.error?.type || "";
    const message = String(data?.error?.message || "");
    let code = "upstream_error";
    if (res.status === 429 || type === "rate_limit_error") code = "rate_limited";
    else if (res.status === 529 || type === "overloaded_error") code = "overloaded";
    else if (res.status === 401 || type === "authentication_error") code = "bad_api_key";
    else if (/credit|billing|balance/i.test(message)) code = "billing";
    else if (res.status === 404 || type === "not_found_error") code = "bad_model";
    console.error("anthropic", res.status, type, message);
    return { error: json({ error: code }, 502) };
  }

  const text = (data?.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
  if (!text.trim()) {
    console.error("anthropic empty", data?.stop_reason);
    return { error: json({ error: "empty_reply" }, 502) };
  }
  return { text };
}

// Pulls the first {...} object out of a model reply.
export function parseObject(text) {
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b < a) return null;
  try { return JSON.parse(text.slice(a, b + 1)); } catch { return null; }
}
