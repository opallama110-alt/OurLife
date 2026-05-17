import Groq from 'groq-sdk';
import { storageService } from './storageService';
import { OURLIFE_SYSTEM_INSTRUCTION } from '../config/constants';

// ═══════════════════════════════════════════════════════════════
// AI SERVICE — direct Groq SDK call from the browser.
//
// SECURITY: uses `dangerouslyAllowBrowser: true` and VITE_GROQ_API_KEY
// is bundled into the client. This is a deliberate, user-accepted
// trade-off for OurLife's single-user PWA use case (Groq free tier,
// personal laptop, key never published publicly). See CLAUDE.md
// Section 6.5 — Tier 0.1 server-side migration is DEFERRED.
// DO NOT refactor back to a Cloud Function without explicit user OK.
//
// Reverted from the chatWithSystem Firebase Callable Function path
// because the project is on the Spark free plan, which prevents both
// Secret Manager access and Functions deployment. The wholesale
// classifyGroqError logic + TOOLS schema + tool-call orchestration
// were ported here verbatim from functions/src/chatWithSystem.ts —
// the deployed function file is kept as deprecated reference.
// ═══════════════════════════════════════════════════════════════

const MODEL = 'llama-3.3-70b-versatile';
const MAX_TOOL_ROUNDS = 5;

// ─── TOOL SCHEMA ────────────────────────────────────────────
// Authoritative LLM tool definitions; the client also dispatches
// each tool name to a real storageService mutation below.
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

// ─── LAZY GROQ CLIENT ───────────────────────────────────────
// Constructed on first call so missing-env errors surface at call
// time (caught by classifyGroqError and shown to the user) rather
// than at module-import time (which would crash the whole app).
let groqClient: Groq | null = null;
function getGroq(): Groq {
  if (groqClient) return groqClient;
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    throw new GroqClientError('missing-key', 'VITE_GROQ_API_KEY tidak terpasang di .env.local');
  }
  groqClient = new Groq({
    apiKey,
    dangerouslyAllowBrowser: true,
  });
  return groqClient;
}

// ─── CHAT MESSAGE TYPES ─────────────────────────────────────
type ToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};
interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  name?: string;
}

// ─── ERROR CLASSIFICATION ───────────────────────────────────
// Ported from functions/src/chatWithSystem.ts::classifyGroqError +
// remapped to user-facing Bahasa Indonesia per the project copy rule
// (CLAUDE.md §6.4). The error THROWN here carries the Indonesian
// message in .message so SystemChat's catch block can render it
// directly without further translation.
class GroqClientError extends Error {
  constructor(
    public readonly code:
      | 'missing-key'
      | 'rate-limit'
      | 'invalid-key'
      | 'context-too-long'
      | 'invalid-request'
      | 'server-error'
      | 'connection'
      | 'unknown',
    message: string,
  ) {
    super(message);
    this.name = 'GroqClientError';
  }
}

function classifyGroqError(err: unknown): GroqClientError {
  // Pre-built error from getGroq() — pass through.
  if (err instanceof GroqClientError) return err;

  if (err instanceof Groq.APIError) {
    const status = err.status;
    // Try to read the error code Groq returns in the body — e.g.
    // 'context_length_exceeded' for prompts that overflow the model.
    const groqCode = (err.error as { code?: string } | undefined)?.code;

    if (groqCode === 'context_length_exceeded') {
      return new GroqClientError('context-too-long', 'Pesan terlalu panjang.');
    }
    if (status === 429) {
      return new GroqClientError('rate-limit', 'Quota AI habis sebentar. Coba lagi 1 menit lagi.');
    }
    if (status === 401 || status === 403 || groqCode === 'invalid_api_key') {
      return new GroqClientError('invalid-key', 'API key tidak valid. Cek .env.local');
    }
    if (status === 400) {
      return new GroqClientError('invalid-request', 'Pesan ditolak oleh System.');
    }
    if (typeof status === 'number' && status >= 500) {
      return new GroqClientError('server-error', 'System merespons terlalu lama. Coba lagi.');
    }
  }
  if (
    err instanceof Groq.APIConnectionError ||
    err instanceof Groq.APIConnectionTimeoutError
  ) {
    return new GroqClientError('connection', 'System tidak dapat dihubungi. Cek koneksi.');
  }
  return new GroqClientError('unknown', 'System tidak dapat dihubungi. Cek koneksi.');
}

// ─── TOOL EXECUTION BRIDGE ──────────────────────────────────
// Maps each tool name the model emits to a real storageService
// mutation. Unchanged from the Tier-0.1 wrapper — only difference is
// that the dispatch loop now lives in the same module as the Groq
// call instead of behind a Cloud Function boundary.
const handleToolCall = (name: string, args: Record<string, unknown>): Record<string, unknown> => {
  if (name === 'execute_penalty') {
    const xpDeduction = Number(args?.xpDeduction) || 0;
    const resetStreak = !!args?.resetStreak;
    const r = storageService.applySystemPenalty(xpDeduction, resetStreak);
    return {
      ok: true,
      action: 'execute_penalty',
      totalXP: r.totalXP,
      level: r.level,
      rank: r.rank,
      currentStreak: r.currentStreak ?? 0,
    };
  }

  if (name === 'mark_quest_complete') {
    const questId = String(args?.questId ?? '');
    const xpBonus = Number(args?.xpBonus) || 0;
    console.log('[System Quest] completed:', questId, '→', xpBonus, 'XP');
    const r = storageService.rewardSystemQuest(xpBonus);
    return {
      ok: true,
      action: 'mark_quest_complete',
      questId,
      totalXP: r.totalXP,
      level: r.level,
      rank: r.rank,
    };
  }

  return { ok: false, error: `Unknown tool: ${name}` };
};

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════
export const aiService = {
  /**
   * Send a user message to The System. Builds the system prompt by
   * concatenating OURLIFE_SYSTEM_INSTRUCTION + live storageService
   * context, then runs a tool-call orchestration loop up to
   * MAX_TOOL_ROUNDS — each round either returns the assistant's
   * text content (no tool calls) or dispatches the tool calls
   * locally and continues with the tool results appended.
   *
   * Throws GroqClientError (Bahasa Indonesia .message) on Groq
   * failure; SystemChat / DailyProtocolEvaluator surface the
   * message directly to the user.
   */
  chat: async (userMessage: string): Promise<string> => {
    const groq = getGroq();

    const systemContent =
      `${OURLIFE_SYSTEM_INSTRUCTION}\n\n=== LIVE CONTEXT ===\n${storageService.getContextString()}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userMessage },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      let completion;
      try {
        completion = await groq.chat.completions.create({
          model: MODEL,
          // Our ChatMessage shape matches Groq's ChatCompletionMessageParam
          // union; the cast through unknown avoids re-declaring the full
          // SDK type tree at the boundary.
          messages: messages as unknown as Parameters<
            typeof groq.chat.completions.create
          >[0]['messages'],
          tools: TOOLS,
          tool_choice: 'auto',
          temperature: 0.5,
        });
      } catch (err) {
        const classified = classifyGroqError(err);
        // Log the full underlying error for debugging — only the
        // classified Indonesian message is surfaced upstream.
        console.error('[aiService] Groq call failed:', {
          code: classified.code,
          message: classified.message,
          original: err,
        });
        throw classified;
      }

      const msg = completion.choices[0]?.message;
      if (!msg) {
        throw new GroqClientError('unknown', 'System mengembalikan response kosong.');
      }

      messages.push({
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: msg.tool_calls as ToolCall[] | undefined,
      });

      const calls = (msg.tool_calls as ToolCall[] | undefined) || [];
      if (calls.length === 0) {
        const finalText = msg.content || '';
        if (finalText) storageService.saveLastSystemMessage(finalText);
        return finalText;
      }

      for (const tc of calls) {
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(tc.function.arguments || '{}');
        } catch {
          parsed = {};
        }
        const result = handleToolCall(tc.function.name, parsed);
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify(result),
        });
      }
    }

    const fallback = '[AI melebihi maximum tool-call rounds]';
    storageService.saveLastSystemMessage(fallback);
    return fallback;
  },
};
