// Mock AI engine — stands in for the backend LLM/STT pipeline (TDD §4.2, §4.3).
// Swap these functions for real API calls when the backend is live.

const BEHAVIORAL_BANK = [
  { text: 'Tell me about a time you had to influence a decision without having formal authority. What was the outcome?', focus: 'STAR method' },
  { text: 'Describe a project that failed or fell short of expectations. What did you learn and change afterwards?', focus: 'STAR method' },
  { text: 'Walk me through a situation where you had to deliver under a tight deadline with incomplete information.', focus: 'STAR method' },
  { text: 'Tell me about a conflict you had with a teammate or stakeholder. How did you resolve it?', focus: 'STAR method' },
  { text: 'Give me an example of a time you received difficult feedback. How did you respond?', focus: 'STAR method' },
];

const TECHNICAL_BANK = {
  design: [
    { text: 'Walk me through your process for redesigning a high-traffic flow when the data and user feedback disagree.', focus: 'Process & rationale' },
    { text: 'How would you design an onboarding flow that maximizes activation without overwhelming new users?', focus: 'Problem solving' },
    { text: 'How do you decide when a design system component should be extended versus when a new one is justified?', focus: 'Systems thinking' },
    { text: 'A stakeholder insists on a pattern you believe hurts usability. How do you handle it, and what evidence do you bring?', focus: 'Communication' },
    { text: 'How would you measure whether a redesign actually improved the user experience?', focus: 'Metrics & impact' },
  ],
  engineering: [
    { text: 'How would you design a system that transcribes and analyzes thousands of audio uploads per hour?', focus: 'System design' },
    { text: 'Explain a time you diagnosed a performance problem in production. What tools and process did you use?', focus: 'Debugging depth' },
    { text: 'How do you decide between optimizing existing code and rewriting a component? Give a concrete example.', focus: 'Trade-off analysis' },
    { text: 'Design the data model for an interview practice app with sessions, questions, and per-answer feedback.', focus: 'Data modeling' },
    { text: 'How would you keep API latency under 5 seconds for an LLM-backed question generation endpoint?', focus: 'Performance' },
  ],
  product: [
    { text: 'How would you prioritize the roadmap for a product with three very different user personas?', focus: 'Prioritization' },
    { text: 'A key engagement metric dropped 15% week-over-week. Walk me through your investigation.', focus: 'Analytical rigor' },
    { text: 'How do you decide what NOT to build? Give an example where you killed a feature idea.', focus: 'Judgment' },
    { text: 'Pitch me an improvement to a product you use daily, including how you would validate it.', focus: 'Product sense' },
    { text: 'How would you set success metrics for an AI interview-preparation app?', focus: 'Metrics & impact' },
  ],
};

const STRENGTH_POOL = [
  'Clear situation framing — the listener immediately understood the context.',
  'Strong ownership language ("I led", "I decided") rather than vague team credit.',
  'Good use of a concrete metric to quantify the result.',
  'Answer stayed on-topic and directly addressed the question asked.',
  'Confident, steady delivery with minimal filler words.',
  'Nice recovery structure — acknowledged the setback, then pivoted to the fix.',
];

const IMPROVEMENT_POOL = [
  'The "Result" portion was thin — close with a measurable outcome or lesson.',
  'Actions were described collectively; isolate what YOU specifically did.',
  'Opening ran long — aim to set the scene in 2 sentences or fewer.',
  'A few filler phrases ("kind of", "you know") diluted key moments.',
  'Consider a one-line summary answer first, then expand (top-down structure).',
  'Pacing rushed in the middle section; pause after key points to let them land.',
];

const TIP_POOL = [
  'Rehearse a 30-second version of each story — you can always expand on request.',
  'End every behavioral answer with the result plus one lesson learned.',
  'When citing metrics, name the baseline too ("from 12% to 19%") for credibility.',
  'Record yourself once a day; pacing improves fastest with playback review.',
];

const COACH_TIPS = [
  { title: 'Master the STAR close', body: 'Most candidates nail Situation and Task but rush the Result. Spend 30% of your answer on outcomes and lessons.' },
  { title: 'Mirror the job description', body: 'Reuse 2-3 exact phrases from the JD in your answers — interviewers listen for their own vocabulary.' },
  { title: 'Slow is confident', body: 'Speaking 10% slower than feels natural reads as calm authority on the other side of the table.' },
];

const TRENDS = [
  { tag: 'Hiring', title: 'AI-assisted screening is now used by 62% of tech recruiters', source: 'Industry Pulse · Jul 2026' },
  { tag: 'Design', title: 'Portfolio walkthroughs are replacing whiteboard challenges', source: 'UX Hiring Report' },
  { tag: 'Behavioral', title: '"Failure stories" are the most requested question type this quarter', source: 'InterviewAI data' },
];

function pick(arr, n) {
  const copy = [...arr];
  const out = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
}

function detectTrack(context) {
  const t = (context || '').toLowerCase();
  if (/(design|ux|ui|figma|research)/.test(t)) return 'design';
  if (/(product manager|roadmap|pm\b|stakeholder)/.test(t)) return 'product';
  return 'engineering';
}

let idCounter = 1;

const INTRO_QUESTIONS = [
  'Tell me about yourself.',
  "Tell me about yourself and what draws you to this role.",
  'Before we dive in — walk me through your background and what you do today.',
];

// ——— Context mining: ground questions in the actual resume/JD/page text ———

const SKILL_DICT = [
  'react native', 'react', 'javascript', 'typescript', 'node', 'python', 'java', 'swift',
  'kotlin', 'c++', 'c#', 'go', 'rust', 'sql', 'postgres', 'mysql', 'mongodb', 'redis',
  'aws', 'gcp', 'azure', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'graphql', 'rest',
  'microservices', 'machine learning', 'deep learning', 'data analysis', 'data engineering',
  'etl', 'spark', 'airflow', 'tableau', 'power bi', 'excel', 'figma', 'sketch', 'prototyping',
  'design systems', 'user research', 'usability testing', 'accessibility', 'wireframing',
  'agile', 'scrum', 'kanban', 'jira', 'product strategy', 'roadmap', 'a/b testing',
  'stakeholder management', 'okrs', 'analytics', 'seo', 'content marketing', 'crm',
  'salesforce', 'negotiation', 'forecasting', 'leadership', 'mentoring', 'hiring',
  'project management', 'budgeting', 'compliance', 'security', 'devops', 'qa', 'automation',
];

const TITLE_RE =
  /(?:senior|staff|lead|principal|junior|associate)?\s*(?:software|frontend|front[- ]end|backend|back[- ]end|full[- ]stack|mobile|ios|android|data|ml|machine learning|devops|platform|cloud|security|product|project|program|ux|ui|design|marketing|sales|growth|qa|business)\s+(?:engineer|developer|designer|manager|scientist|analyst|researcher|architect|specialist|consultant|director)/i;

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function extractSignals(text) {
  const padded = ` ${(text || '').toLowerCase()} `;
  const skills = [];
  for (const skill of SKILL_DICT) {
    if (skills.length >= 8) break;
    if (padded.includes(` ${skill}`) && !skills.some((s) => s.includes(skill) || skill.includes(s))) {
      skills.push(skill);
    }
  }
  const title = (text.match(TITLE_RE) || [null])[0];
  const years = (text.match(/(\d{1,2})\+?\s*years?/i) || [null, null])[1];
  const metrics = [...(text.matchAll(/[^.!?\n]{0,80}\b\d+(?:\.\d+)?\s*%[^.!?\n]{0,60}/g) || [])]
    .map((m) => m[0].trim())
    .filter((s) => s.length > 20)
    .slice(0, 2);
  return { skills, title: title ? title.trim() : null, years, metrics };
}

// Build a question bank derived from what the context actually says.
// This is the local stand-in for the backend LLM call in the TDD.
function buildContextualBank(sessionType, text) {
  if (!text || text.length < 80) return null;
  const sig = extractSignals(text);
  if (sig.skills.length < 2 && !sig.title && sig.metrics.length === 0) return null;

  const qs = [];
  const s = sig.skills;
  if (sessionType === 'behavioral') {
    s.slice(0, 3).forEach((sk) =>
      qs.push({
        text: `Tell me about the most challenging project where you used ${sk}. What was your specific contribution?`,
        focus: cap(sk),
      })
    );
    if (sig.title)
      qs.push({
        text: `In your ${sig.title} work, describe a time you disagreed with a stakeholder about priorities. How did you resolve it?`,
        focus: 'STAR method',
      });
    sig.metrics.forEach((m) =>
      qs.push({
        text: `The context mentions “${m}” — walk me through how that result was achieved, step by step.`,
        focus: 'Impact & metrics',
      })
    );
    if (sig.years)
      qs.push({
        text: `Across your ${sig.years} years of experience, which failure taught you the most, and what changed afterwards?`,
        focus: 'STAR method',
      });
    s.slice(3, 5).forEach((sk) =>
      qs.push({
        text: `Describe a time you had to get up to speed with ${sk} quickly to hit a deadline.`,
        focus: 'Learning agility',
      })
    );
  } else {
    s.slice(0, 4).forEach((sk) =>
      qs.push({
        text: `What trade-offs do you weigh when using ${sk} in production, and when would you argue against it?`,
        focus: cap(sk),
      })
    );
    if (s.length >= 2)
      qs.push({
        text: `Sketch the architecture of a system that combines ${s[0]} and ${s[1]}. Where does it break at 10x scale?`,
        focus: 'System design',
      });
    if (sig.title)
      qs.push({
        text: `This context calls for ${sig.title} skills — which part of that role's craft do you consider your strongest, and how would you prove it?`,
        focus: 'Role fit',
      });
    sig.metrics.forEach((m) =>
      qs.push({
        text: `Regarding “${m}” — what was the technical approach behind that number?`,
        focus: 'Technical depth',
      })
    );
  }

  // Top up with track staples so short contexts still fill a session
  const staples = sessionType === 'behavioral' ? BEHAVIORAL_BANK : TECHNICAL_BANK[detectTrack(text)];
  qs.push(...staples.slice(0, Math.max(0, 6 - qs.length)));
  return qs;
}

function getBank(sessionType, contextText, customBank) {
  if (customBank && customBank.length) {
    return customBank.map((q) => ({
      text: q.text,
      focus: q.focus || (sessionType === 'behavioral' ? 'STAR method' : 'Your question set'),
    }));
  }
  const contextual = buildContextualBank(sessionType, contextText);
  if (contextual) return contextual;
  return sessionType === 'behavioral'
    ? BEHAVIORAL_BANK
    : TECHNICAL_BANK[detectTrack(contextText)];
}

function toQuestion(q) {
  return { id: `q_${idCounter++}`, questionText: q.text, expectedFocus: q.focus };
}

// Optional icebreaker prepended to every session (enhancement: intro question)
export function makeIntroQuestion() {
  return toQuestion({
    text: INTRO_QUESTIONS[Math.floor(Math.random() * INTRO_QUESTIONS.length)],
    focus: 'Introduction',
  });
}

// Sample `count` questions, cycling through the bank when count exceeds its size
function sampleQuestions(bank, count) {
  const out = [];
  while (out.length < count) {
    out.push(...pick(bank, Math.min(bank.length, count - out.length)));
  }
  return out.map(toQuestion);
}

// Simulates: JD/resume → LLM → structured question JSON (< 5s latency budget).
// A custom question set skips the "AI" and samples the user's own bank.
export function generateQuestions({ sessionType, contextSource, contextText, count = 4, customBank }) {
  return new Promise((resolve) => {
    const delay = customBank ? 500 : 1800 + Math.random() * 1500;
    setTimeout(() => {
      resolve(sampleQuestions(getBank(sessionType, contextText, customBank), count));
    }, delay);
  });
}

// Single follow-up question for unlimited sessions
export function nextQuestion({ sessionType, contextText, customBank }) {
  return toQuestion(pick(getBank(sessionType, contextText, customBank), 1)[0]);
}

// Simulates: audio → Whisper STT → LLM critique (TDD §4.3)
export function analyzeAnswer({ question, durationSec }) {
  const clamp = (v) => Math.max(35, Math.min(96, Math.round(v)));
  const base = 55 + Math.random() * 30;
  const short = durationSec < 20;
  return {
    transcript:
      '“In my previous role, the team was facing a hard launch deadline while our main dependency slipped. I took ownership of re-scoping the release, aligned the stakeholders on a phased plan, and we shipped the core experience on time — adoption hit our 30-day target two weeks early…”',
    strengths: pick(STRENGTH_POOL, 2),
    improvements: pick(IMPROVEMENT_POOL, short ? 3 : 2),
    tips: pick(TIP_POOL, 1),
    pacingScore: clamp(base + (short ? -15 : 5)),
    pacingLabel: short ? 'Rushed — answer ended early' : 'Steady, conversational pace',
    starScores: {
      situation: clamp(base + 10),
      task: clamp(base + 4),
      action: clamp(base + 8),
      result: clamp(base - 12),
    },
  };
}

export function summarizeSession(answers) {
  const avg = (key) =>
    Math.round(answers.reduce((s, a) => s + a.analysis[key], 0) / answers.length);
  const pacing = avg('pacingScore');
  return {
    communication: Math.min(96, pacing + 6),
    technicalDepth: Math.max(40, pacing - 4),
    clarity: Math.min(94, pacing + 2),
  };
}

export function getCoachTips() {
  return COACH_TIPS;
}

export function getTrends() {
  return TRENDS;
}
