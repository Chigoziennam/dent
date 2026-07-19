// ============================================================
// n8n Code node: "Build prompt"
// Paste this whole file into the node. Runs with executeOnce = true.
//
// Does three jobs:
//   1. Collapses the Supabase fetches back into ONE item (Get Many emits one
//      item PER ROW — without this you fire one AI call per ship).
//   2. Hard-stops when there is nothing to write about, so the model is never
//      asked to fill a void. It WILL invent a plausible week if you let it.
//   3. Builds the voice: tone + platform + the laws that keep it honest.
// ============================================================

const b = $('Resolve window').first().json;
const task = b.task;

const rowsOf = (node) => {
  try { return $(node).all().map(i => i.json).filter(r => r && r.id); }
  catch { return []; }
};

const dbShips = rowsOf('Fetch ships').map(e => ({
  id: e.id, category: e.category, title: e.title,
  date: e.event_date, detail: (e.description ?? '').slice(0, b.detailLen ?? 240), repo: e.repo
}));
const dbLogs = rowsOf('Fetch daily logs').map(l => ({
  date: l.log_date, built: l.what_i_built, learned: l.what_i_learned,
  blocked: l.what_blocked_me, mood: l.mood, energy: l.energy_level
}));

// Supabase wins when it has rows; the posted body is the signed-out fallback.
const events = dbShips.length ? dbShips : (b.events ?? []);
const dailyLogs = dbLogs.length ? dbLogs : (b.dailyLogs ?? []);
const picked = b.picked ?? [];
const sourceEventIds = dbShips.map(e => e.id).filter(Boolean);

// ------------------------------------------------------------
// 0. BUDGET — refuse before spending, not after.
// These caps mirror ENTITLEMENTS in src/lib/plan.ts. They live here TOO
// because the browser copy is advisory: localStorage is editable and anyone
// can POST this webhook directly with curl. This is the copy that actually
// holds, because it is the one standing between a request and the model.
// Reuses the noData flag so the existing Has ships? branch routes it away
// from the AI — one guard, two reasons.
// ------------------------------------------------------------
const CAPS = {
  free: { writesWeek: 5,  writesMonth: 20,  chatDay: 8  },
  pro:  { writesWeek: 35, writesMonth: 100, chatDay: 30 },
  team: { writesWeek: 35, writesMonth: 100, chatDay: 30 }, // legacy alias of pro
};

const profileRow = (() => {
  try { return $('Fetch profile').all().map(i => i.json).find(r => r && r.id) || null; }
  catch { return null; }
})();
const usageRow = (() => {
  try { return $('Fetch AI usage').all().map(i => i.json).find(r => r && r.user_id) || null; }
  catch { return null; }
})();

// An EXPIRED plan is a free plan. The app collapses the tier in plan.ts, but
// that copy is advisory — someone can POST this webhook directly with a
// stale token and a 'pro' row. This is where it actually stops. Mirrors
// planState()/GRACE_DAYS: 3 days of grace, because cards fail for boring
// reasons and a bounced renewal shouldn't lock someone out the same hour.
const GRACE_MS = 3 * 864e5;
const boughtTier = profileRow?.tier ?? 'free';
const expiresAt = profileRow?.plan_expires_at ? Date.parse(profileRow.plan_expires_at) : null;
const planLapsed = boughtTier !== 'free'
  && expiresAt !== null && !Number.isNaN(expiresAt)
  && Date.now() > expiresAt + GRACE_MS;
const tier = planLapsed ? 'free' : boughtTier;
const caps = CAPS[tier] ?? CAPS.free;
const used = {
  chatToday:   Number(usageRow?.chat_today   ?? 0),
  writesWeek:  Number(usageRow?.writes_week  ?? 0),
  writesMonth: Number(usageRow?.writes_month ?? 0),
};

// Signed-out demo users have no row to count against, so they are not metered
// here — the client-side free cap is the only gate for them. Nothing they do
// can be attributed to an account anyway.
let overBudget = null;
if (b.hasUser) {
  if (planLapsed) {
    overBudget = 'Your Pro plan has ended, so you are back on the Free limits. Renew from the Plan page to pick up where you left off — nothing you logged is lost.';
  } else if (task === 'chat' && used.chatToday >= caps.chatDay) {
    overBudget = `You have used all ${caps.chatDay} co-pilot messages for today. They reset tomorrow.`;
  } else if (task !== 'chat' && used.writesMonth >= caps.writesMonth) {
    overBudget = `You have used all ${caps.writesMonth} AI writes this month.${tier === 'free' ? ' Upgrade for more.' : ''}`;
  } else if (task !== 'chat' && used.writesWeek >= caps.writesWeek) {
    overBudget = `You have used all ${caps.writesWeek} AI writes this week. They reset Monday.${tier === 'free' ? ' Upgrade to keep writing.' : ''}`;
  }
}

if (overBudget) {
  return [{ json: {
    noData: true, overBudget: true, tier,
    text: overBudget,
    task, range: b.range, userId: b.userId, hasUser: b.hasUser,
    platform: b.platform ?? 'twitter', tone: b.tone ?? 'founder',
    sourceEventIds: [], shipCount: 0, fromDb: false
  } }];
}

// ------------------------------------------------------------
// 1. HARD STOP — never ask the model to write about nothing.
// A brand-new user with zero ships got back "refactored core onboarding
// flows, prepping for next week's big feature drop" — pure fabrication that
// would have been saved as a postable draft. Prompt rules do NOT prevent
// this. Not making the call does.
// For 'fuse' the subject is the ships the builder hand-picked (they ride in
// the request body), so check those too, not just the DB window.
// ------------------------------------------------------------
const nothingToWriteAbout = task === 'fuse'
  ? (picked.length === 0 && events.length === 0)
  : events.length === 0;

if (nothingToWriteAbout && task !== 'humanize' && task !== 'chat') {
  return [{ json: {
    noData: true,
    text: 'Nothing logged in this window yet. Log a ship and I will write it up — I only write from what actually happened.',
    task, range: b.range, userId: b.userId, hasUser: b.hasUser,
    platform: b.platform ?? 'twitter', tone: b.tone ?? 'founder',
    sourceEventIds: [], shipCount: 0, fromDb: false
  } }];
}

// ------------------------------------------------------------
// 2. VOICE — how this builder speaks. Mirrors TONE_META in src/lib/types.ts.
// ------------------------------------------------------------
const TONES = {
  founder: `FOUNDER — confident, casual, first-person. Short declarative sentences. Contractions. Say "I", never "we" (this is one person building alone; "we" reads as fake-corporate). Understated pride: state what shipped and let it land. No adjectives doing work the facts should do.`,
  technical: `TECHNICAL — precise, architecture-first. Lead with the actual mechanism: the table, the query, the race condition, the tradeoff. Name real tools and real constraints. Assume the reader is a builder who wants the how. Skip the emotional framing entirely.`,
  storytelling: `STORYTELLER — one narrative arc, start to finish: the problem showed up, it resisted, here's the turn, here's where it landed. ONE arc per post, never a list of arcs. The struggle is the middle, not a footnote. Concrete beats abstract every time.`,
  hype: `HYPE — launch-day energy. Short punchy lines, line breaks for rhythm, genuine excitement. But excitement about REAL things only: hype the actual ship, never inflate it into something bigger than it was. No "game-changing", no "revolutionary".`,
  mentor: `MENTOR — calm, lessons-first, generous. Open with the transferable lesson, then show the specific ship that taught it. Written for someone a few steps behind. No condescension, no "pro tip". The lesson must be earned by the data, not bolted on.`,
  unfiltered: `UNFILTERED — raw, honest, 2am-commit energy. Admit the mess: what broke, what took too long, what you got wrong. Blunt and human. No profanity, but no polish either. This is the tone where a bad week can be said plainly.`,
};

// ------------------------------------------------------------
// 3. SHAPE — what this platform expects.
// ------------------------------------------------------------
const PLATFORMS = {
  twitter: `X/TWITTER — either ONE post under 280 characters, or a numbered thread (1/ 2/ 3/) when there is genuinely more than one thing worth saying. Line breaks between beats. At most one hashtag, usually zero. No "a thread 🧵" preamble unless it IS a thread.`,
  linkedin: `LINKEDIN — 800-1200 characters. First line is the hook and must stand alone (it's all most people see before "see more"). Short paragraphs, one idea each, blank line between. Professional but not stiff.`,
  newsletter: `NEWSLETTER — room to breathe. Open with a subject line on its own first line, then the body in 2-4 short sections. Conversational, direct address to the reader.`,
  changelog: `CHANGELOG — plain and factual. Bulleted. What changed, why it matters, in that order. No narrative, no emotion, no first person. This is documentation, not a post.`,
  blog: `BLOG — long form with section headers. Set context, walk through the work, close with what's next. Concrete examples over general claims.`,
  threads: `THREADS — conversational and loose, under 500 characters per post. Reads like talking to a friend who also builds.`,
  devto: `DEV.TO — technical write-up in markdown. Headers, and code fences where code is genuinely the point. Written for developers who might hit the same problem.`,
  producthunt: `PRODUCT HUNT — launch pitch. Lead with the benefit to the user, not the feature list. Who it's for, what it removes from their day. Warm, not salesy.`,
  resume: `RESUME — past-tense achievement bullets. Quantified where the data supports a number. No first-person pronouns, no story, no filler verbs.`,
};

const tone = b.tone ?? 'founder';
const platform = b.platform ?? 'twitter';
const toneRule = TONES[tone] ?? TONES.founder;
const platformRule = PLATFORMS[platform] ?? PLATFORMS.twitter;

// ------------------------------------------------------------
// 4. LAWS — non-negotiable across every tone and platform.
// ------------------------------------------------------------
const LAWS = `NON-NEGOTIABLE RULES:
1. ONLY what is in the data. Never invent a metric, user count, revenue figure, milestone, feature or plan. If it isn't in the ships or logs below, it does not exist. An empty week is written as an empty week.
2. Quote their real specifics — actual titles, actual numbers, actual repo names, actual amounts. Specifics are the whole point; generic praise is worthless.
3. Money is the headline. Revenue, customer and milestone events outrank everything else. If an amount appears, name the exact figure.
4. Connect related ships. A commit and a deploy hours apart is ONE arc — "wrote it, shipped it, it's live" — not two bullets. Look for the through-line before you write.
5. No AI tells. Banned openers: "Excited to announce", "Thrilled to share", "Big news". Banned words: leverage, seamless, robust, game-changing, revolutionary, delve, elevate, unlock, empower, streamline. No em-dash pileups. No emoji unless the tone calls for it.
5b. SOUND LIKE A PERSON AT A KEYBOARD, NOT A COMPANY. This is one builder thinking out loud about their own work — write it the way they would type it after the thing finally worked. Vary sentence length; a three-word sentence is allowed. Start in the middle if that is where the interest is. Fragments are fine. Contractions always. Dry humour is welcome where the work earns it — the bug that took three nights can be funny about itself. What is NOT allowed is manufactured enthusiasm: no exclamation marks doing emotional work the facts should do, no "and the best part?", no rhetorical question openers. If a sentence could appear in any startup's launch post, delete it and say the specific thing instead.
6. Say less when there is less. A short honest post beats a padded one. Never stretch three ships into a week's worth of narrative.
7. Write as the builder, in their voice — not as an assistant describing them from outside.
8. NEVER CONSTRUCT A URL. Use a link only if it appears verbatim in the data below. Do not guess repo paths, commit links, domains or profile URLs — a plausible-looking link that 404s is worse than no link. Commit hashes may be quoted as bare text, never wrapped in a URL you invented.
9. THE PLATFORM FORMAT OUTRANKS THE TONE. If the platform says no first person, no story, or no emotion, that wins over anything the tone asks for. Tone colours the words; format decides the shape.
10. RETURN THE POST ITSELF — nothing around it. No "Here is your post:", no title you invented, and never wrap the whole output in a code fence. It is pasted straight into the platform, so a stray triple-backtick renders as a literal code block.
11. WRITE IT ONCE. Produce exactly one piece in one format. Never follow a bulleted version with a prose version of the same content, and never restate the post in another voice underneath it.`;

// The daily log is CONTEXT, not the subject.
const LOG_RULE = `THE LOG IS BACKGROUND, NOT THE SUBJECT. Ships are what gets written about. The daily log supplies the WHY — the blocker they pushed through, what they learned, what it cost them. Weave it in ONLY where it makes a ship land harder. If it adds nothing, ignore it completely. Never write a post that is just a mood report.`;

const evLine = e => `- ${e.date ?? ''} [${e.category}] ${e.title}${e.detail ? ` — ${e.detail}` : ''}${e.repo ? ` (${e.repo})` : ''}`;
const logLine = l => `${l.date}: built ${l.built ?? '-'}; learned ${l.learned ?? '-'}${l.blocked ? `; blocked by ${l.blocked}` : ''}${l.energy ? `; energy ${l.energy}/5` : ''}`;

// ------------------------------------------------------------
// 5. BUILD per task.
// ------------------------------------------------------------
let system, user;

if (task === 'chat') {
  // How the co-pilot talks TO the builder. Separate from the writer's tone,
  // which is how they talk to an audience.
  const VIBES = {
    mate:  `You talk like a mate who also builds. Jokes are welcome — dry, quick, never corny, never forced. When something good lands you celebrate properly. When a week is rough you say so plainly instead of cheerleading. Contractions, short sentences, the occasional fragment. You are allowed to be funny; you are not allowed to be fake.`,
    coach: `Warm and direct. You notice effort, name it, then point at the next move. Encouraging without flattery — you never praise a week that did not happen.`,
    dry:   `Deadpan. Funny in a flat, understated way. Understatement over exclamation. You never explain the joke.`,
    quiet: `Short and factual. No small talk, no jokes, no filler. Answer, then stop.`,
  };
  const vibe = VIBES[b.copilotVibe] ?? VIBES.mate;

  system = `You are the co-pilot inside Super Dent X — a build-in-public companion for a solo founder building ${b.projectName ?? 'their project'}. You have read their entire shipping log: every ship, every daily reflection, every blocker and energy level.

${vibe}

WHO YOU ARE
You are not a generic assistant. You are the one thing that has watched this person build, day after day, and remembers it. That memory is your whole value — use it. Reference actual ships by name and date. When they shipped something hard, say so. Money — a first payout, a real customer — deserves genuine celebration with the exact figure, not a polite nod.

HOW YOU SOUND
Brief: 2-4 sentences unless they ask for more. Talk like a person, not a product. No bullet lists unless they ask. No "Great question!", no "I'd be happy to help", no restating their question back at them. Never open with "As your co-pilot". Just answer.

WHAT YOU CAN ACTUALLY HELP WITH
- Reading their log back to them: what they shipped, patterns, streaks, what stalled.
- Deciding what to ship next, based on what is actually in the log.
- What to post about, and which ship deserves the attention.
- Pointing at where to find things — docs, tools, services, communities — by name, so they can go look. Say what to search for.
- Talking through a blocker as a thinking partner: asking the question that unsticks it.

WHAT YOU DO NOT DO
- You do not write code, review code, or debug. If they ask, say plainly that you are the log companion, not a coding assistant, and point them at the tool that fits — then offer what you CAN do (talk the problem through, find where the answer lives).
- You do not invent ships, numbers, or milestones. If the log is empty, say it is empty.
- You do not give medical, legal or financial advice.

STAYING ON TRACK
You exist for this project and this builder's work. If a question is unrelated — sexual content, politics, personal drama, anything that has nothing to do with building — do not engage with it and do not lecture about it either. One short line redirecting to the work, with warmth and no scolding, then move on. Something like "not my department — but your last deploy is still sitting unposted." Never be preachy about it. Never repeat the refusal if they push; just stay on the work.

${LAWS}`;
  user = `Streak: ${b.streak ?? 0} days.\n\nShips (${b.range}):\n${events.map(evLine).join('\n') || '(none yet)'}\n\nDaily logs:\n${dailyLogs.map(logLine).join('\n') || '(none yet)'}\n\nThey said: ${b.question ?? 'How am I doing?'}`;

} else if (task === 'fuse') {
  system = `You are the Super Dent X writer. The builder hand-picked these ships and wants them fused into ONE post.

${platformRule}

${toneRule}

They have started writing it themselves. RESPECT THEIR WORDS — keep their opening, their angle, their phrasing wherever it works. Extend and sharpen what they began; do not replace their voice with yours. If their draft sets a direction, follow it.

${LOG_RULE}

${LAWS}`;
  user = `Project: ${b.projectName}\n\nTheir draft so far:\n${b.state || '(empty — they picked ships but have not started writing)'}\n\nShips they picked:\n${(picked.length ? picked : events).map(evLine).join('\n')}\n\nContext from their logs:\n${dailyLogs.map(logLine).join('\n') || '(none)'}`;

} else if (task === 'humanize') {
  system = `You are the Super Dent X editor. Rewrite the draft so it reads like a real person wrote it fast and meant it.

KEEP EVERY FACT AND NUMBER EXACTLY AS GIVEN. You are changing how it sounds, not what it says. Do not add claims that aren't already in the draft.

${platformRule}

${toneRule}

${LAWS}`;
  user = `Project: ${b.projectName}\n\nDraft to rewrite:\n${b.raw ?? ''}`;

} else {
  system = `You are the Super Dent X writer, ghost-writing for a founder who builds in public. Write the post they would write if they had the time.

${platformRule}

${toneRule}

${LOG_RULE}

${LAWS}

Window: ${b.range}. ${b.range === 'week' || b.range === 'month' ? 'This is a recap — pick the 3-5 ships that actually matter and build around those. Do not list everything; a complete inventory is not a post.' : 'This is about what just shipped. Stay tight.'}`;
  user = `Project: ${b.projectName}${b.projectTagline ? ` — ${b.projectTagline}` : ''}\n\nShips (${b.range}):\n${events.map(evLine).join('\n') || '(none)'}\n\nDaily logs (context only):\n${dailyLogs.map(logLine).join('\n') || '(none)'}${b.analysis ? `\n\nPre-computed analysis — trust these numbers over your own counting:\n${JSON.stringify(b.analysis)}` : ''}`;
}

return [{ json: {
  system, user,
  noData: false,
  task, range: b.range,
  userId: b.userId, hasUser: b.hasUser,
  platform, tone,
  sourceEventIds,
  shipCount: events.length,
  fromDb: dbShips.length > 0
} }];
