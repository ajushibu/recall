// POST /api/grade — grades a typed answer against the reference answer.
// Body: { question, reference, answer }  →  { verdict: "correct"|"partial"|"wrong", feedback }

import { askClaude, guard, json, parseObject, GRADE_MODEL } from "../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SYSTEM = `You grade a learner's typed answer against a reference answer.
Judge the core idea, not wording: accept paraphrase, reject answers that miss or contradict the central point.
Be candid and specific. No flattery, no padding. If the answer is partly right, say exactly what is missing or wrong.
Respond with ONLY JSON: {"verdict":"correct"|"partial"|"wrong","feedback":"1-2 sentences"}`;

export async function POST(req) {
  const denied = await guard(req);
  if (denied) return denied;

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const question = String(b?.question ?? "").slice(0, 1000);
  const reference = String(b?.reference ?? "").slice(0, 2000);
  const answer = String(b?.answer ?? "").slice(0, 4000);
  if (!question || !reference) return json({ error: "bad_request" }, 400);

  const prompt = `Question: ${question}\n\nReference answer: ${reference}\n\nLearner's answer: ${answer || "(blank)"}`;
  const r = await askClaude({ model: GRADE_MODEL(), system: SYSTEM, prompt, maxTokens: 600 });
  if (r.error) return r.error;
  const j = parseObject(r.text) || {};
  const verdict = ["correct", "partial", "wrong"].includes(j.verdict) ? j.verdict : "wrong";
  return json({ verdict, feedback: String(j.feedback || "").slice(0, 600) });
}
