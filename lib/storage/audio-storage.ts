import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { s3Client } from './s3-client';

const BUCKET_NAME = process.env.S3_BUCKET_NAME!;
const PUBLIC_URL = process.env.S3_PUBLIC_URL!;

/**
 * Generates a cache key for audio storage
 * @param text - The text content (will be normalized: lowercased, trimmed)
 * @param voiceId - The voice ID for organizing files by voice
 * @returns S3 object key in format: {voiceId}/{hash}.mp3
 */
export function generateCacheKey(text: string, voiceId: string): string {
  // Normalize text: lowercase and trim, but preserve punctuation
  const normalizedText = text.trim().toLowerCase();

  // Generate MD5 hash
  const hash = createHash('md5').update(normalizedText).digest('hex');

  // Return key with voice folder structure
  return `${voiceId}/${hash}.mp3`;
}

/**
 * Checks if an audio file exists in S3 storage
 * @param key - The S3 object key
 * @returns Promise<boolean> - true if exists, false otherwise
 */
export async function checkAudioExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    // HeadObject throws error if object doesn't exist
    return false;
  }
}

/**
 * Uploads audio data to S3 storage
 * @param key - The S3 object key
 * @param audioBase64 - Base64-encoded audio data
 * @returns Promise<string> - Public URL of the uploaded audio
 */
export async function uploadAudio(
  key: string,
  audioBase64: string
): Promise<string> {
  // Convert base64 to buffer
  const audioBuffer = Buffer.from(audioBase64, 'base64');

  // Upload to S3
  await s3Client.send(
    new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: audioBuffer,
      ContentType: 'audio/mpeg',
    })
  );

  // Return public URL
  return getAudioUrl(key);
}

/**
 * Gets the public URL for an audio file
 * @param key - The S3 object key
 * @returns string - Public URL
 */
export function getAudioUrl(key: string): string {
  return `${PUBLIC_URL}/${key}`;
}
