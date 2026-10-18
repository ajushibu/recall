// POST /api/rewrite — a question the learner keeps missing gets rewritten into clearer ones.
// Body: { question, answer, explanation, type, misses, title, body }  →  { diagnosis, cards: [...] }

import { askClaude, guard, json, parseObject, GEN_MODEL } from "../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `A learner keeps missing one review question. Repeating a badly built question does not help, so work out why and replace it.

First decide the likely cause, in one plain sentence, for example: the answer has several parts and they only ever get some; the question is ambiguous; the answer is a bare fact with nothing to hang it on; two ideas are easily confused; or the note itself is unclear or contradicts itself.

Then write 1 to 3 replacement questions that fix that cause:
- If the answer has several parts, give each part its own question so none can hide behind another.
- If the answer is a bare fact, ask for it through a reason or a contrast, and put a short memory hook in "explanation" (a mnemonic, a cause-and-effect link or a contrast with its look-alike).
- Keep each question self-contained: never say "according to the note".
- Stay inside what the note says. Do not add outside facts. If the note is unclear or looks wrong, say so in "diagnosis" and return fewer questions.
- Two types. "mcq": exactly 4 options, one correct, "answer" copied exactly from one option. "recall": the learner types an answer; "answer" is a concise model answer (1-3 sentences).
- importance: 1-5.

Respond with ONLY a JSON object:
{"diagnosis":"one sentence","cards":[{"type":"mcq"|"recall","question":"...","options":["..","..","..",".."],"answer":"...","explanation":"...","importance":1-5}]}
Omit "options" for recall questions.`;

export async function POST(req) {
  const denied = await guard(req);
  if (denied) return denied;

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const question = String(b?.question ?? "").slice(0, 1000);
  const answer = String(b?.answer ?? "").slice(0, 2000);
  if (!question || !answer) return json({ error: "bad_request" }, 400);
  const explanation = String(b?.explanation ?? "").slice(0, 1000);
  const misses = Math.max(0, Math.min(50, parseInt(b?.misses, 10) || 0));
  const title = String(b?.title ?? "").slice(0, 300);
  const body = String(b?.body ?? "").slice(0, 12000);

  const prompt = `The learner has missed this ${b?.type === "mcq" ? "multiple-choice" : "free-recall"} question ${misses} times.\n\nQuestion: ${question}\nAnswer: ${answer}\n${explanation ? `Explanation: ${explanation}\n` : ""}\n--- NOTE TITLE ---\n${title}\n--- NOTE BODY ---\n${body}`;
  const r = await askClaude({ model: GEN_MODEL(), system: SYSTEM, prompt, maxTokens: 3000 });
  if (r.error) return r.error;
  const parsed = parseObject(r.text);
  if (!parsed) return json({ error: "bad_reply" }, 502);
  return json({
    diagnosis: String(parsed.diagnosis || "").slice(0, 300),
    cards: Array.isArray(parsed.cards) ? parsed.cards.slice(0, 3) : [],
  });
}
