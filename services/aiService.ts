import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase-config';
import { storageService } from './storageService';
import { OURLIFE_SYSTEM_INSTRUCTION } from '../config/constants';

const MAX_TOOL_ROUNDS = 5;

// ═══════════════════════════════════════════════════════════════
// TYPES — must match functions/src/chatWithSystem.ts response shape
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
// CALLABLE BINDING
// ═══════════════════════════════════════════════════════════════
// The chatWithSystem function is deployed to asia-southeast1; the
// region is already attached to the Functions instance exported from
// firebase-config.js.
const chatWithSystem = httpsCallable<ChatRequest, ChatResponse>(
  functions,
  'chatWithSystem',
);

// ═══════════════════════════════════════════════════════════════
// TOOL EXECUTION BRIDGE
// ═══════════════════════════════════════════════════════════════
// Server holds the authoritative LLM tool schema; this maps the tool
// *name* the model returns to a real storageService mutation. Keeping
// the bridge on the client preserves Opsi A semantics — the server
// is a stateless Groq proxy and does not touch user state directly.
const handleToolCall = (name: string, args: any): Record<string, unknown> => {
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
   * Send a message to the System via the chatWithSystem Cloud Function.
   * The orchestration loop runs here: each round we POST the current
   * messages array to the function, get back a single assistant message,
   * and either return its content (no tool calls) or execute the tool
   * calls locally and continue. Stops after MAX_TOOL_ROUNDS.
   */
  chat: async (userMessage: string): Promise<string> => {
    const systemContent =
      `${OURLIFE_SYSTEM_INSTRUCTION}\n\n=== LIVE CONTEXT ===\n${storageService.getContextString()}`;

    const messages: ChatMessage[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userMessage },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const { data } = await chatWithSystem({ messages });
      const msg = data.message;

      messages.push({
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: msg.tool_calls,
      });

      const calls = msg.tool_calls || [];
      if (calls.length === 0) {
        const finalText = msg.content || '';
        if (finalText) storageService.saveLastSystemMessage(finalText);
        return finalText;
      }

      for (const tc of calls) {
        let parsed: any = {};
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

    const fallback = '[AI exceeded maximum tool-call rounds]';
    storageService.saveLastSystemMessage(fallback);
    return fallback;
  },
};
