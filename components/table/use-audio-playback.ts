'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { generateSpeech } from '@/app/actions/text-to-speech';
import { Sentence } from '@/app/types';

// Helper function to convert Base64 to Blob
function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

interface UseAudioPlaybackProps {
  sentences: Sentence[];
  selectedSentence: number | null;
  selectedPhraseIndex: number;
}

const PRELOAD_COUNT = 3;

export function useAudioPlayback({
  sentences,
  selectedSentence,
  selectedPhraseIndex,
}: UseAudioPlaybackProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const preloadedRef = useRef<Set<number>>(new Set());

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
      currentAudioUrlRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setIsPlaying(false);
  }, []);

  const playAudio = useCallback(
    async (mode: 'phrase' | 'sentence') => {
      if (selectedSentence === null) return;

      // Determine text to speak based on mode
      let textToSpeak: string;
      if (mode === 'sentence') {
        // Play full sentence
        textToSpeak = sentences[selectedSentence].sentence;
      } else {
        // Play selected phrase
        const selectedPhrase =
          sentences[selectedSentence].phrases[selectedPhraseIndex];
        textToSpeak = selectedPhrase.french;
      }

      try {
        setIsLoading(true);

        // Stop any currently playing audio
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current = null;
        }

        // Clean up previous audio URL
        if (currentAudioUrlRef.current) {
          URL.revokeObjectURL(currentAudioUrlRef.current);
          currentAudioUrlRef.current = null;
        }

        // Abort any previous request
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        // Call server action to generate speech
        const result = await generateSpeech(textToSpeak);

        if (!result.success) {
          console.error('Failed to generate speech:', result.error);
          setIsLoading(false);
          abortControllerRef.current = null;
          return;
        }

        let audioUrl: string;

        // Handle response: either URL from S3 or base64 data (fallback)
        if (result.audioUrl) {
          // S3 URL - use directly, no need for object URL
          audioUrl = result.audioUrl;
        } else if (result.audioData) {
          // Fallback: Convert Base64 to blob and create object URL
          const audioBlob = base64ToBlob(result.audioData, 'audio/mpeg');
          audioUrl = URL.createObjectURL(audioBlob);
          currentAudioUrlRef.current = audioUrl; // Track for cleanup
        } else {
          console.error('No audio URL or data in response');
          setIsLoading(false);
          abortControllerRef.current = null;
          return;
        }

        // Create and play audio
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsLoading(false);
          setIsPlaying(true);
          abortControllerRef.current = null;
        };

        audio.onended = () => {
          setIsPlaying(false);
        };

        audio.onerror = () => {
          setIsLoading(false);
          setIsPlaying(false);
          abortControllerRef.current = null;
          console.error('Error playing audio');
        };

        await audio.play();
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          setIsLoading(false);
          setIsPlaying(false);
          return;
        }
        console.error('Error in playAudio:', error);
        setIsLoading(false);
        setIsPlaying(false);
        abortControllerRef.current = null;
      }
    },
    [selectedSentence, selectedPhraseIndex, sentences]
  );

  // Preload next sentences when selection changes
  useEffect(() => {
    if (selectedSentence === null) return;

    const preloadSentences = async () => {
      for (let i = 1; i <= PRELOAD_COUNT; i++) {
        const nextIndex = selectedSentence + i;

        // Stop if we've reached the end of sentences
        if (nextIndex >= sentences.length) break;

        // Skip if already preloaded
        if (preloadedRef.current.has(nextIndex)) continue;

        // Mark as preloaded before making the request
        preloadedRef.current.add(nextIndex);

        // Preload in the background (fire and forget)
        const sentenceText = sentences[nextIndex].sentence;
        generateSpeech(sentenceText).catch((error) => {
          console.error(`Failed to preload sentence ${nextIndex}:`, error);
          // Remove from preloaded set on failure so it can be retried
          preloadedRef.current.delete(nextIndex);
        });
      }
    };

    preloadSentences();
  }, [selectedSentence, sentences]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    isLoading,
    isPlaying,
    playAudio,
    stopAudio,
  };
}
