// POST /api/grade — grades a typed answer against the reference answer.
// Body: { question, reference, answer, focus? }  →  { verdict: "correct"|"partial"|"wrong", feedback, missing: [cue] }

import { askClaude, guard, json, parseObject, GRADE_MODEL } from "../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM = `You grade a learner's typed answer against a reference answer.
Judge the core idea, not wording: accept paraphrase, reject answers that miss or contradict the central point.
Be candid and specific. No flattery, no padding.
Use "correct" when the central idea is right, even if wording or minor detail differs. Use "partial" when the central idea is right but a required part is missing OR one supporting detail is wrong. Use "wrong" only when the central idea is missing or contradicted. Do not mark an answer wrong just because it contains one incorrect side detail. If the answer is partly right, say exactly what is missing or wrong.
Many answers have several parts (a threshold plus a time window plus conditions). List every part the learner left out or got wrong in "missing", each as a short cue of at most 8 words that names the part WITHOUT giving its content (good: "the time window", "what ischemia evidence is needed"; bad: "within 48 hours of PCI"). Use [] when nothing is missing. If the learner previously left out certain parts, the verdict is "correct" only when those parts are now included.
Respond with ONLY JSON: {"verdict":"correct"|"partial"|"wrong","feedback":"1-2 sentences","missing":["cue",...]}`;

export async function POST(req) {
  const denied = await guard(req);
  if (denied) return denied;

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const question = String(b?.question ?? "").slice(0, 1000);
  const reference = String(b?.reference ?? "").slice(0, 2000);
  const answer = String(b?.answer ?? "").slice(0, 4000);
  if (!question || !reference) return json({ error: "bad_request" }, 400);

  const focus = (Array.isArray(b?.focus) ? b.focus : []).slice(0, 6).map((x) => String(x).slice(0, 120)).filter(Boolean);
  const prompt = `Question: ${question}\n\nReference answer: ${reference}\n\n${focus.length ? `Parts this learner left out last time: ${focus.join("; ")}\n\n` : ""}Learner's answer: ${answer || "(blank)"}`;
  const r = await askClaude({ model: GRADE_MODEL(), system: SYSTEM, prompt, maxTokens: 1500 });
  if (r.error) return r.error;
  // An unreadable reply must never be shown to the learner as "wrong": let the app fall back to self-rating.
  const j = parseObject(r.text);
  if (!j) return json({ error: "bad_reply" }, 502);
  const verdict = ["correct", "partial", "wrong"].includes(j.verdict) ? j.verdict : "wrong";
  const missing = (Array.isArray(j.missing) ? j.missing : []).slice(0, 4).map((x) => String(x).trim().slice(0, 80)).filter(Boolean);
  return json({ verdict, feedback: String(j.feedback || "").slice(0, 600), missing: verdict === "correct" ? [] : missing });
}
