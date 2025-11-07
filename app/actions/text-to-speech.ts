'use server';

import { SpeechifyClient, SpeechifyError } from '@speechify/api';

// Initialize Speechify client
const client = new SpeechifyClient({
  token: process.env.SPEECHIFY_API_KEY!,
});

// Cache to avoid regenerating the same phrases
const audioCache = new Map<string, string>();

/**
 * Generates speech audio for the given text using Speechify API
 * @param text - The text to convert to speech
 * @returns Base64-encoded audio data
 */
export async function generateSpeech(text: string): Promise<{
  success: boolean;
  audioData?: string;
  error?: string;
}> {
  try {
    // Check cache first
    if (audioCache.has(text)) {
      return {
        success: true,
        audioData: audioCache.get(text),
      };
    }

    // Generate speech using Speechify
    const response = await client.tts.audio.speech({
      input: text,
      voiceId: process.env.SPEECHIFY_VOICE!,
    });

    // Cache the result
    audioCache.set(text, response.audioData);

    return {
      success: true,
      audioData: response.audioData,
    };
  } catch (err) {
    if (err instanceof SpeechifyError) {
      console.error('Speechify API Error:', err.statusCode, err.message);
      return {
        success: false,
        error: `Speech generation failed: ${err.message}`,
      };
    }

    console.error('Unexpected error:', err);
    return {
      success: false,
      error: 'An unexpected error occurred',
    };
  }
}
