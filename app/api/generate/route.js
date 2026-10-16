// POST /api/generate — turns one note into a small set of review questions.
// Body: { title, body, density, guidance, trivial[], useful[], existing[] }  →  { cards: [...] }
// The browser validates and schedules the cards; this route only writes them.

import { askClaude, guard, json, parseObject, GEN_MODEL } from "../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You turn a learner's notes into a small set of review questions for spaced repetition.

Your job is judgement, not coverage. Pick only the points the learner must retain for the concept to keep working in their head. Skip trivia, incidental examples, dates and names unless they are central. If the note has nothing worth retaining, return an empty list — that is a valid answer.

Rules:
- Prefer questions that test understanding (why, how, what differs, what happens if) over recall of phrasing.
- Mix two types. "mcq": exactly 4 options, one correct, distractors built from plausible misconceptions; "answer" must be copied exactly from one option. "recall": the learner types an answer; "answer" is a concise model answer (1-3 sentences).
- Use mcq for discriminating between similar ideas; use recall for explaining a mechanism or reasoning.
- Every question must be self-contained: never say "according to the note" or refer to the note.
- Base everything on the note. Do not add outside facts. Skip claims that are unclear or look wrong rather than quizzing on them.
- importance: 5 = the rest of the note depends on it, 3 = solid supporting point, 1 = nice to know.
- explanation: one or two sentences giving the reasoning or context shown after answering.

Respond with ONLY a JSON object:
{"cards":[{"type":"mcq"|"recall","question":"...","options":["..","..","..",".."],"answer":"...","explanation":"...","importance":1-5}]}
Omit "options" for recall questions.`;

const DENSITY = {
  low: "Ask very little: 1-3 questions in total, only the most central ideas.",
  balanced: "Roughly one question per 150-200 words of the note, between 2 and 6 in total. Only what is needed to keep the concept working in the learner's head.",
  high: "Be more thorough: up to 12 questions, including supporting details and connections between ideas, but still skip trivia.",
};

const list = (v, n) => (Array.isArray(v) ? v.map((s) => String(s).slice(0, 400)).filter(Boolean).slice(0, n) : []);

export async function POST(req) {
  const denied = await guard(req);
  if (denied) return denied;

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const title = String(b?.title ?? "").slice(0, 300);
  const body = String(b?.body ?? "").slice(0, 14000);
  if (!body.trim()) return json({ error: "bad_request" }, 400);
  const trivial = list(b.trivial, 10), useful = list(b.useful, 6), existing = list(b.existing, 40);
  const guidance = String(b?.guidance ?? "").slice(0, 1500).trim();

  let prompt = `Density: ${DENSITY[b?.density] || DENSITY.balanced}\n`;
  if (guidance) prompt += `\nWhat the learner told us they want from their reviews:\n${guidance}\n`;
  if (trivial.length) prompt += `\nThe learner marked these past questions as too trivial. Do not ask things like them:\n- ${trivial.join("\n- ")}\n`;
  if (useful.length) prompt += `\nThe learner flagged these past questions as key. Questions of this kind are valued:\n- ${useful.join("\n- ")}\n`;
  if (existing.length) prompt += `\nQuestions already generated for this note (do not repeat or rephrase them; only add questions for content they do not cover):\n- ${existing.join("\n- ")}\n`;
  prompt += `\n--- NOTE TITLE ---\n${title}\n--- NOTE BODY ---\n${body}`;

  const r = await askClaude({ model: GEN_MODEL(), system: SYSTEM, prompt, maxTokens: 4000 });
  if (r.error) return r.error;
  const parsed = parseObject(r.text);
  if (!parsed) return json({ error: "bad_reply" }, 502);
  return json({ cards: Array.isArray(parsed.cards) ? parsed.cards.slice(0, 15) : [] });
}
