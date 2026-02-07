const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

/**
 * Summarizes a conversation into a friendly, brief format for dementia patients
 */
export async function summarizeConversation(text: string): Promise<string> {
    if (!GEMINI_API_KEY) {
        console.warn('Gemini API key not configured. Using fallback summary.');
        return createFallbackSummary(text);
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
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
${text}

OUTPUT (must be 8-15 words, must mention the main topic):`
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.5,
                        maxOutputTokens: 100,
                    }
                })
            }
        );

        // Handle rate limit specifically
        if (response.status === 429) {
            console.warn('Gemini API rate limited. Using fallback summary.');
            return createFallbackSummary(text);
        }

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status}`);
        }

        const data = await response.json();
        console.log('Gemini response:', JSON.stringify(data, null, 2));

        // Try multiple ways to extract the text (different API versions have different structures)
        let summary =
            data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
            data.candidates?.[0]?.text?.trim() ||
            data.text?.trim() ||
            data.response?.trim();

        if (!summary) {
            console.warn('Could not extract summary from response, using fallback');
            return createFallbackSummary(text);
        }

        // Clean up any quotes or extra formatting
        return summary.replace(/^["']|["']$/g, '').trim();
    } catch (error) {
        console.error('Error summarizing conversation:', error);
        return createFallbackSummary(text);
    }
}

/**
 * Creates a simple fallback summary when AI is unavailable
 */
function createFallbackSummary(text: string): string {
    // Try to extract key topic words
    const topicWords = ['hackathon', 'birthday', 'wedding', 'trip', 'vacation', 'work', 'project', 'school', 'doctor', 'hospital', 'dinner', 'lunch', 'party', 'game', 'movie'];
    const lowerText = text.toLowerCase();

    for (const topic of topicWords) {
        if (lowerText.includes(topic)) {
            return `Talked about ${topic}`;
        }
    }

    // Fallback: use first few words
    const words = text.trim().split(/\s+/).slice(0, 8);
    if (words.length < 3) {
        return 'Had a conversation recently';
    }
    return `${words.join(' ')}...`;
}

/**
 * Checks if the Gemini API is configured and working
 */
export async function checkGeminiConnection(): Promise<boolean> {
    if (!GEMINI_API_KEY) {
        return false;
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Say "OK" if you can read this.' }] }],
                    generationConfig: { maxOutputTokens: 10 }
                })
            }
        );
        return response.ok;
    } catch {
        return false;
    }
}
