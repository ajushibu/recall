// POST /api/connect — questions that connect several notes from one folder.
// Body: { folder, notes: [{title, body}], guidance, trivial[], existing[] }  →  { cards: [...] }

import { askClaude, guard, json, parseObject, GEN_MODEL } from "../../../lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You write a few review questions that connect ideas ACROSS a learner's notes. Single-fact recall is already covered elsewhere. These questions test how the ideas relate: what differs between two look-alikes, which one applies when, how one explains or limits the other, what changes if a condition changes.

Rules:
- 2 or 3 questions in total, fewer if the notes do not genuinely connect. An empty list is a valid answer.
- Every question must need at least two of the notes to answer well, and must name the topics it compares so it is self-contained. Never say "according to the notes".
- Use "mcq" (exactly 4 options, one correct, distractors from plausible confusions between the topics, "answer" copied exactly from one option) for discriminating between look-alikes; "recall" (learner types 1-3 sentences) for explaining a relationship.
- Base everything on the notes. Do not add outside facts. Skip anything unclear or that looks wrong.
- importance: 1-5. explanation: one or two sentences of reasoning.

Respond with ONLY a JSON object:
{"cards":[{"type":"mcq"|"recall","question":"...","options":["..","..","..",".."],"answer":"...","explanation":"...","importance":1-5}]}
Omit "options" for recall questions.`;

const list = (v, n) => (Array.isArray(v) ? v.map((s) => String(s).slice(0, 400)).filter(Boolean).slice(0, n) : []);

export async function POST(req) {
  const denied = await guard(req);
  if (denied) return denied;

  let b;
  try { b = await req.json(); } catch { return json({ error: "bad_request" }, 400); }
  const notes = (Array.isArray(b?.notes) ? b.notes : [])
    .slice(0, 4)
    .map((n) => ({ title: String(n?.title ?? "").slice(0, 300), body: String(n?.body ?? "").slice(0, 6000) }))
    .filter((n) => n.body.trim());
  if (notes.length < 2) return json({ error: "bad_request" }, 400);
  const folder = String(b?.folder ?? "").slice(0, 200);
  const guidance = String(b?.guidance ?? "").slice(0, 1500).trim();
  const trivial = list(b.trivial, 10), existing = list(b.existing, 40);

  let prompt = `Folder: ${folder || "(none)"}\n`;
  if (guidance) prompt += `\nWhat the learner told us they want from their reviews:\n${guidance}\n`;
  if (trivial.length) prompt += `\nThe learner marked these past questions as too trivial. Do not ask things like them:\n- ${trivial.join("\n- ")}\n`;
  if (existing.length) prompt += `\nQuestions that already exist (do not repeat or rephrase them):\n- ${existing.join("\n- ")}\n`;
  notes.forEach((n, i) => { prompt += `\n--- NOTE ${i + 1}: ${n.title} ---\n${n.body}\n`; });

  const r = await askClaude({ model: GEN_MODEL(), system: SYSTEM, prompt, maxTokens: 3000 });
  if (r.error) return r.error;
  const parsed = parseObject(r.text);
  if (!parsed) return json({ error: "bad_reply" }, 502);
  return json({ cards: Array.isArray(parsed.cards) ? parsed.cards.slice(0, 3) : [] });
}
