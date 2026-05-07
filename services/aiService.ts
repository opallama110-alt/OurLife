import Groq from 'groq-sdk';
import { storageService } from './storageService';
import { OURLIFE_SYSTEM_INSTRUCTION } from '../config/constants';

const MODEL = 'llama-3.3-70b-versatile';
const MAX_TOOL_ROUNDS = 5;

// ═══════════════════ TOOL DEFINITIONS ═══════════════════
// The System uses these to mutate the user's gym state in real time.
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

// ═══════════════════ TOOL EXECUTION BRIDGE ═══════════════════
// Translates the model's tool call into a real storageService mutation.
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

// ═══════════════════ PUBLIC API ═══════════════════
export const aiService = {
  /**
   * Send a message to the System. Tool calls are executed inline against
   * storageService, then the model is given the results so it can reply with
   * a natural-language acknowledgement. Returns the model's final text.
   */
  chat: async (userMessage: string): Promise<string> => {
    const apiKey = (import.meta as any).env?.VITE_GROQ_API_KEY;
    if (!apiKey) {
      throw new Error('VITE_GROQ_API_KEY is not configured. Set it in .env.local.');
    }

    const client = new Groq({ apiKey, dangerouslyAllowBrowser: true });

    const systemContent =
      `${OURLIFE_SYSTEM_INSTRUCTION}\n\n=== LIVE CONTEXT ===\n${storageService.getContextString()}`;

    const messages: any[] = [
      { role: 'system', content: systemContent },
      { role: 'user', content: userMessage },
    ];

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const completion = await client.chat.completions.create({
        model: MODEL,
        messages,
        tools: TOOLS,
        tool_choice: 'auto',
        temperature: 0.5,
      });

      const msg = completion.choices[0]?.message;
      if (!msg) return '';

      messages.push(msg);

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
