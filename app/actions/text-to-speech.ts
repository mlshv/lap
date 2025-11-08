'use server';

import { SpeechifyClient, SpeechifyError } from '@speechify/api';
import {
  generateCacheKey,
  checkAudioExists,
  uploadAudio,
  getAudioUrl,
} from '@/lib/storage/audio-storage';

// Initialize Speechify client
const client = new SpeechifyClient({
  token: process.env.SPEECHIFY_API_KEY!,
});

// In-memory cache for fallback when S3 is unavailable
const memoryCache = new Map<string, string>();

/**
 * Generates speech audio for the given text using Speechify API
 * Returns either a public URL (from S3) or base64 audio data (fallback)
 * @param text - The text to convert to speech
 * @returns Object with success status and either audioUrl or audioData
 */
export async function generateSpeech(text: string): Promise<{
  success: boolean;
  audioUrl?: string;
  audioData?: string;
  error?: string;
}> {
  const voiceId = process.env.SPEECHIFY_VOICE!;

  try {
    // Generate cache key
    const cacheKey = generateCacheKey(text, voiceId);

    // Try S3 first: Check if audio already exists
    try {
      const exists = await checkAudioExists(cacheKey);
      if (exists) {
        return {
          success: true,
          audioUrl: getAudioUrl(cacheKey),
        };
      }
    } catch (s3Error) {
      console.warn('S3 check failed, will try fallback:', s3Error);
    }

    // Check in-memory cache (fallback)
    if (memoryCache.has(text)) {
      return {
        success: true,
        audioData: memoryCache.get(text),
      };
    }

    // Generate speech using Speechify
    const response = await client.tts.audio.speech({
      input: text,
      voiceId: voiceId,
      model: 'simba-multilingual',
    });

    // Try to upload to S3
    try {
      const audioUrl = await uploadAudio(cacheKey, response.audioData);
      return {
        success: true,
        audioUrl,
      };
    } catch (s3Error) {
      console.warn('S3 upload failed, using fallback:', s3Error);

      // Fallback: Store in memory and return base64
      memoryCache.set(text, response.audioData);
      return {
        success: true,
        audioData: response.audioData,
      };
    }
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
