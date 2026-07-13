// Real AI question generation via the Claude API (@anthropic-ai/sdk).
// This replaces the local mock engine when the user has added an API key;
// mockAI.js remains the fallback so the app always works offline.
import Anthropic from '@anthropic-ai/sdk';

export const CLAUDE_MODEL = 'claude-opus-4-8';

function makeClient(apiKey) {
  return new Anthropic({
    apiKey,
    // Required for the web preview (sets the CORS opt-in header
    // anthropic-dangerous-direct-browser-access); harmless on native.
    // The key is user-supplied and stored on their own device.
    dangerouslyAllowBrowser: true,
    maxRetries: 1,
  });
}

// Structured output schema — guarantees the response is parseable JSON
const QUESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    questions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question: { type: 'string' },
          focus: {
            type: 'string',
            description: 'Two-to-three-word label for what this question probes, e.g. "STAR method", "System design", "React"',
          },
        },
        required: ['question', 'focus'],
        additionalProperties: false,
      },
    },
  },
  required: ['questions'],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are an expert interview coach who writes sharp, realistic interview questions.
Rules:
- Ground every question in the candidate context you are given (resume, job description, LinkedIn profile, or web page text). Reference specific skills, projects, metrics, or requirements from it.
- Behavioral questions should invite STAR-method stories (situation/task/action/result). Technical questions should probe depth, trade-offs, and real decisions — not trivia.
- One question per item. No compound multi-part questions. No preamble.
- Questions must be answerable out loud in 1-3 minutes.`;

function sourceLabel(contextSource) {
  return (
    {
      jd: 'a job description',
      resume: "the candidate's resume",
      linkedin: "the candidate's LinkedIn profile",
      website: 'a company/role web page',
      generic: 'no specific document',
    }[contextSource] || 'context'
  );
}

// Convert SDK errors into messages the UI can show directly
function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) {
    return new Error('Anthropic rejected the API key. Check it in Profile → AI engine.');
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new Error("This API key can't access the model. Check its permissions in the Anthropic console.");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new Error('Claude is rate-limited right now — try again in a minute.');
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new Error("Couldn't reach the Claude API. Check your connection.");
  }
  if (err instanceof Anthropic.APIError) {
    return new Error(`Claude API error (${err.status}): ${err.message?.slice(0, 120)}`);
  }
  return err instanceof Error ? err : new Error('Claude request failed.');
}

// Generates interview questions from real context (TDD §4.2, now for real)
export async function generateQuestionsAI({
  apiKey,
  sessionType,
  contextSource,
  contextText,
  count,
  careerGoals,
}) {
  const client = makeClient(apiKey);
  const goals = careerGoals?.roles?.length
    ? `The candidate is targeting: ${careerGoals.roles.join(', ')}${
        careerGoals.industries?.length ? ` in ${careerGoals.industries.join(', ')}` : ''
      }.`
    : '';
  const context = (contextText || '').trim();

  const userPrompt = `Write exactly ${count} ${sessionType} interview questions based on ${sourceLabel(contextSource)}.
${goals}
${context ? `--- CONTEXT START ---\n${context}\n--- CONTEXT END ---` : 'No document provided — use the target roles above (or general professional practice) to pick strong questions.'}`;

  let response;
  try {
    response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      output_config: { format: { type: 'json_schema', schema: QUESTIONS_SCHEMA } },
    });
  } catch (err) {
    throw friendlyError(err);
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('Claude declined to generate questions for this content.');
  }
  const text = response.content.find((b) => b.type === 'text')?.text || '';
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Claude returned an unreadable response — try again.');
  }
  const questions = (parsed.questions || [])
    .filter((q) => q.question && q.question.length > 8)
    .slice(0, count);
  if (questions.length === 0) throw new Error('Claude returned no questions — try again.');
  return questions.map((q, i) => ({
    id: `ai_${Date.now()}_${i}`,
    questionText: q.question.trim(),
    expectedFocus: q.focus?.trim() || (sessionType === 'behavioral' ? 'STAR method' : 'Technical depth'),
  }));
}

// Cheap key check: model metadata endpoint costs no tokens, throws on bad auth
export async function verifyApiKey(apiKey) {
  const client = makeClient(apiKey);
  try {
    await client.models.retrieve(CLAUDE_MODEL);
    return true;
  } catch (err) {
    throw friendlyError(err);
  }
}
