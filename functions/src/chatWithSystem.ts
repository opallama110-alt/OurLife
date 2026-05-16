import {
  onCall,
  HttpsError,
  type CallableRequest,
  type FunctionsErrorCode,
} from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions/v2';
import Groq from 'groq-sdk';

const MODEL = 'llama-3.3-70b-versatile';

// ═══════════════════════════════════════════════════════════════
// TOOL DEFINITIONS — authoritative server-side schema
// ═══════════════════════════════════════════════════════════════
// The client only needs to know tool *names* (to dispatch handleToolCall)
// and arg shapes (to interpret arguments). The full Groq schema lives here.
const TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'execute_penalty',
      description:
        "Apply a System penalty: deduct XP and optionally reset the user's current workout streak. " +
        'Use when the user has clearly failed a commitment (e.g. skipped a scheduled workout without a valid reason).',
      parameters: {
        type: 'object',
        properties: {
          xpDeduction: {
            type: 'number',
            description: 'Positive integer of XP to remove from the user.',
          },
          resetStreak: {
            type: 'boolean',
            description: 'If true, set currentStreak to 0. If false, leave the streak intact.',
          },
        },
        required: ['xpDeduction', 'resetStreak'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'mark_quest_complete',
      description:
        'Mark a System quest complete and reward the user with XP. ' +
        'Use when the user reports finishing a quest you previously assigned.',
      parameters: {
        type: 'object',
        properties: {
          questId: {
            type: 'string',
            description: 'Opaque tracking ID for the completed quest (free-form string).',
          },
          xpBonus: {
            type: 'number',
            description: 'Positive integer of XP to award the user.',
          },
        },
        required: ['questId', 'xpBonus'],
      },
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// SIZE LIMITS
// ═══════════════════════════════════════════════════════════════
const MAX_MESSAGES = 50;
const MAX_MESSAGE_CONTENT_LENGTH = 16_384;
const MAX_PAYLOAD_BYTES = 64 * 1024;

// ═══════════════════════════════════════════════════════════════
// LAZY GROQ CLIENT
// ═══════════════════════════════════════════════════════════════
// Functions v2 only injects secrets at invocation time, so the SDK
// must be constructed inside the handler path. The singleton is
// cached across warm invocations within the same instance.
let groqClient: Groq | null = null;
function getGroq(): Groq {
  if (groqClient) return groqClient;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new HttpsError(
      'failed-precondition',
      'Server is missing the GROQ_API_KEY secret binding.',
    );
  }
  groqClient = new Groq({ apiKey });
  return groqClient;
}

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
  name?: string;
}

interface ChatRequest {
  messages: ChatMessage[];
}

interface ChatResponse {
  message: {
    role: 'assistant';
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: { name: string; arguments: string };
    }>;
  };
}

// ═══════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════
// Runs before any Groq call so malformed input never burns quota.
function validate(data: unknown): ChatRequest {
  if (!data || typeof data !== 'object') {
    throw new HttpsError('invalid-argument', 'Request body must be an object.');
  }
  const messages = (data as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) {
    throw new HttpsError('invalid-argument', 'Field "messages" must be an array.');
  }
  if (messages.length === 0) {
    throw new HttpsError('invalid-argument', 'Field "messages" must not be empty.');
  }
  if (messages.length > MAX_MESSAGES) {
    throw new HttpsError(
      'invalid-argument',
      `Too many messages (>${MAX_MESSAGES}).`,
    );
  }
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i] as ChatMessage | undefined;
    if (!m || typeof m !== 'object' || typeof m.role !== 'string') {
      throw new HttpsError('invalid-argument', `messages[${i}] is malformed.`);
    }
    if (typeof m.content === 'string' && m.content.length > MAX_MESSAGE_CONTENT_LENGTH) {
      throw new HttpsError(
        'invalid-argument',
        `messages[${i}].content exceeds ${MAX_MESSAGE_CONTENT_LENGTH} chars.`,
      );
    }
  }
  const bytes = Buffer.byteLength(JSON.stringify(messages), 'utf8');
  if (bytes > MAX_PAYLOAD_BYTES) {
    throw new HttpsError(
      'invalid-argument',
      `Payload too large (>${MAX_PAYLOAD_BYTES} bytes).`,
    );
  }
  return { messages: messages as ChatMessage[] };
}

// ═══════════════════════════════════════════════════════════════
// ERROR CLASSIFICATION
// ═══════════════════════════════════════════════════════════════
// Never surface raw Groq error messages — they could in theory carry
// credential fragments or internal hostnames. Map by class/status only.
interface ClassifiedError {
  code: FunctionsErrorCode;
  userMessage: string;
  logLevel: 'warn' | 'error';
}

function classifyGroqError(err: unknown): ClassifiedError {
  if (err instanceof Groq.APIError) {
    const status = err.status;
    if (status === 429) {
      return {
        code: 'resource-exhausted',
        userMessage: 'The System is busy. Try again in a moment.',
        logLevel: 'warn',
      };
    }
    if (status === 401 || status === 403) {
      return {
        code: 'failed-precondition',
        userMessage: 'Server credentials are misconfigured.',
        logLevel: 'error',
      };
    }
    if (status === 400) {
      return {
        code: 'invalid-argument',
        userMessage: 'The System rejected the request shape.',
        logLevel: 'error',
      };
    }
    if (typeof status === 'number' && status >= 500) {
      return {
        code: 'unavailable',
        userMessage: 'The System is temporarily unreachable.',
        logLevel: 'error',
      };
    }
  }
  if (
    err instanceof Groq.APIConnectionError ||
    err instanceof Groq.APIConnectionTimeoutError
  ) {
    return {
      code: 'unavailable',
      userMessage: 'Cannot reach the System.',
      logLevel: 'error',
    };
  }
  return {
    code: 'internal',
    userMessage: 'Unexpected System error.',
    logLevel: 'error',
  };
}

// ═══════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════
export const chatWithSystem = onCall<unknown, Promise<ChatResponse>>(
  {
    timeoutSeconds: 120,
    memory: '256MiB',
    secrets: ['GROQ_API_KEY'],
  },
  async (request: CallableRequest<unknown>): Promise<ChatResponse> => {
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'You must be signed in to talk to the System.',
      );
    }
    const uid = request.auth.uid;

    const { messages } = validate(request.data);

    // Find last user message length for safe logging — content is never logged.
    let lastUserMessageLength = 0;
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === 'user' && typeof m.content === 'string') {
        lastUserMessageLength = m.content.length;
        break;
      }
    }

    logger.info('chatWithSystem invoked', {
      uid,
      messageCount: messages.length,
      lastUserMessageLength,
    });

    const groq = getGroq();

    let completion;
    try {
      completion = await groq.chat.completions.create({
        model: MODEL,
        // Our ChatMessage shape matches Groq's ChatCompletionMessageParam union;
        // the cast through unknown avoids re-declaring the full SDK type tree
        // while keeping the boundary explicit. The validate() pass above and
        // Groq's own server-side validation jointly guard the actual shape.
        messages: messages as unknown as Parameters<
          typeof groq.chat.completions.create
        >[0]['messages'],
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.5,
      });
    } catch (err) {
      const { code, userMessage, logLevel } = classifyGroqError(err);
      const errType = err instanceof Error ? err.constructor.name : typeof err;
      const status = err instanceof Groq.APIError ? err.status : undefined;
      const retryAfter =
        err instanceof Groq.APIError ? err.headers?.['retry-after'] : undefined;
      const summary = { uid, type: errType, status, retryAfter };
      if (logLevel === 'warn') {
        logger.warn('Groq call failed', summary);
      } else {
        logger.error('Groq call failed', summary);
      }
      throw new HttpsError(code, userMessage);
    }

    const choice = completion.choices[0];
    if (!choice || !choice.message) {
      logger.error('Groq returned empty choice', { uid });
      throw new HttpsError('internal', 'The System returned no message.');
    }

    const msg = choice.message;
    return {
      message: {
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: msg.tool_calls?.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        })),
      },
    };
  },
);
