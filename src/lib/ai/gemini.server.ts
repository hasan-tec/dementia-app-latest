/**
 * Server-only Gemini AI Service
 * Strictly executed on the server/route-handler layer.
 * Secrets never leak to browser context.
 */

import type { SummarySource } from '../contracts';

export interface SummarizeResult {
  summary: string;
  source: SummarySource;
}

const DEFAULT_TIMEOUT_MS = 10_000; // 10-second bounded timeout
const DEFAULT_MODEL = 'gemini-1.5-flash';

/**
 * Creates an intelligent local fallback summary without calling external APIs.
 */
export function createFallbackSummary(text: string): string {
  const topicWords = [
    'hackathon', 'birthday', 'wedding', 'trip', 'vacation', 
    'work', 'project', 'school', 'doctor', 'hospital', 
    'dinner', 'lunch', 'breakfast', 'tea', 'party', 'game', 
    'movie', 'family', 'garden', 'walk', 'shopping'
  ];
  const lowerText = text.toLowerCase();

  for (const topic of topicWords) {
    if (lowerText.includes(topic)) {
      return `Talked about ${topic}`;
    }
  }

  const words = text.trim().split(/\s+/).slice(0, 8);
  if (words.length < 3) {
    return 'Had a conversation recently';
  }
  return `${words.join(' ')}...`;
}

/**
 * Summarizes conversation notes into a concise, 8-15 word memory anchor for dementia patients.
 * Enforces bounded input, timeout, rate limit handling, and privacy-preserving logs.
 */
export async function summarizeConversationServer(
  rawText: string,
  options?: { timeoutMs?: number }
): Promise<SummarizeResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // If no server key is configured, gracefully fall back immediately
  if (!apiKey) {
    return {
      summary: createFallbackSummary(rawText),
      source: 'fallback',
    };
  }

  // Bound the input text to prevent excessive token usage
  const boundedText = rawText.slice(0, 10_000);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const startTime = Date.now();

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Summarize this conversation in ONE sentence for a dementia patient's memory aid.

REQUIRED FORMAT: "Talked about [specific topic] and [key detail]"

EXAMPLE INPUT: "Hey are you going to the hackathon? I need a backend dev for my team."
EXAMPLE OUTPUT: "Talked about joining the hackathon this weekend and finding a backend developer"

EXAMPLE INPUT: "Mom's roses are beautiful this year! The red ones are my favorite."
EXAMPLE OUTPUT: "Talked about Mom's garden and her beautiful red roses"

NOW SUMMARIZE THIS CONVERSATION:
${boundedText}

OUTPUT (must be 8-15 words, must mention the main topic):`,
              },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 100,
        },
      }),
    });

    clearTimeout(timer);

    const durationMs = Date.now() - startTime;

    if (response.status === 429) {
      console.warn(`[Gemini] Rate-limited (429) after ${durationMs}ms. Using fallback.`);
      return {
        summary: createFallbackSummary(boundedText),
        source: 'fallback',
      };
    }

    if (!response.ok) {
      console.warn(`[Gemini] Provider returned status ${response.status} after ${durationMs}ms.`);
      return {
        summary: createFallbackSummary(boundedText),
        source: 'fallback',
      };
    }

    const data = await response.json();
    const candidateText =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      data.candidates?.[0]?.text?.trim() ||
      data.text?.trim();

    if (!candidateText) {
      console.warn('[Gemini] Missing candidate text in response. Using fallback.');
      return {
        summary: createFallbackSummary(boundedText),
        source: 'fallback',
      };
    }

    // Clean quotes or linebreaks, bound to 300 characters
    const cleanSummary = candidateText.replace(/^["']|["']$/g, '').replace(/\r?\n/g, ' ').trim().slice(0, 300);

    return {
      summary: cleanSummary,
      source: 'ai',
    };
  } catch (error: unknown) {
    clearTimeout(timer);
    const durationMs = Date.now() - startTime;
    const isAbort = error instanceof Error && error.name === 'AbortError';

    if (isAbort) {
      console.warn(`[Gemini] Request timed out after ${timeoutMs}ms.`);
    } else {
      console.warn(`[Gemini] Request failed after ${durationMs}ms.`);
    }

    return {
      summary: createFallbackSummary(boundedText),
      source: 'fallback',
    };
  }
}
