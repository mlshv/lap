'use client';
import { Sentence } from '@/app/types';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';
import { generateSpeech } from '@/app/actions/text-to-speech';

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

// Memoized row component to prevent unnecessary re-renders
const SentenceRow = memo(
  ({
    sentence,
    isSelected,
    selectedPhraseIndex,
    isLoading,
    isPlaying,
    onSelect,
    onSelectPhrase,
  }: {
    sentence: Sentence;
    isSelected: boolean;
    selectedPhraseIndex: number | null;
    isLoading: boolean;
    isPlaying: boolean;
    onSelect: () => void;
    onSelectPhrase: (phraseIndex: number) => void;
  }) => {
    return (
      <tr className="border border-gray-600" onClick={onSelect}>
        <td className={cn('p-1', isSelected && 'bg-orange-100')}>
          <table className="border-collapse">
            <tbody>
              <tr>
                {sentence.phrases.map(({ french }, j) => (
                  <td
                    key={j}
                    className={cn(
                      'px-2 relative',
                      isSelected && selectedPhraseIndex === j && 'bg-orange-300'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPhrase(j);
                    }}
                  >
                    {french}
                    {isSelected && selectedPhraseIndex === j && (isLoading || isPlaying) && (
                      <span className="ml-1 text-xs">
                        {isLoading ? '⏳' : '🔊'}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                {sentence.phrases.map(({ english }, j) => (
                  <td
                    key={j}
                    className="px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPhrase(j);
                    }}
                  >
                    {english}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    );
  }
);

SentenceRow.displayName = 'SentenceRow';

export function Table({ sentences }: { sentences: Sentence[] }) {
  const [selectedSentence, setSelectedSentence] = useState<number | null>(null);
  const [selectedPhraseIndex, setSelectedPhraseIndex] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const parentRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);

  // Memoized select handler
  const handleSelectSentence = useCallback((index: number) => {
    setSelectedSentence(index);
    setSelectedPhraseIndex(0); // Reset phrase selection when row changes
  }, []);

  const handleSelectPhrase = useCallback((sentenceIndex: number, phraseIndex: number) => {
    setSelectedSentence(sentenceIndex);
    setSelectedPhraseIndex(phraseIndex);
  }, []);

  // Play audio for the selected phrase or full sentence
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

        // Call server action to generate speech
        const result = await generateSpeech(textToSpeak);

        if (!result.success || !result.audioData) {
          console.error('Failed to generate speech:', result.error);
          return;
        }

        // Convert Base64 to blob
        const audioBlob = base64ToBlob(result.audioData, 'audio/mpeg');
        const audioUrl = URL.createObjectURL(audioBlob);
        currentAudioUrlRef.current = audioUrl;

        // Create and play audio
        const audio = new Audio(audioUrl);
        audioRef.current = audio;

        audio.onplay = () => {
          setIsLoading(false);
          setIsPlaying(true);
        };

        audio.onended = () => {
          setIsPlaying(false);
        };

        audio.onerror = () => {
          setIsLoading(false);
          setIsPlaying(false);
          console.error('Error playing audio');
        };

        await audio.play();
      } catch (error) {
        console.error('Error in playAudio:', error);
        setIsLoading(false);
        setIsPlaying(false);
      }
    },
    [selectedSentence, selectedPhraseIndex, sentences]
  );

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
    };
  }, []);

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: sentences.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height in pixels
    overscan: 5, // Number of items to render outside visible area
  });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedSentence((prev) => {
          const next = prev === null ? 0 : Math.min(prev + 1, sentences.length - 1);

          // Scroll to selected row
          if (next !== prev) {
            rowVirtualizer.scrollToIndex(next, { align: 'center' });
            setSelectedPhraseIndex(0);
          }
          return next;
        });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedSentence((prev) => {
          const next = prev === null ? sentences.length - 1 : Math.max(prev - 1, 0);

          // Scroll to selected row
          if (next !== prev) {
            rowVirtualizer.scrollToIndex(next, { align: 'center' });
            setSelectedPhraseIndex(0);
          }
          return next;
        });
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (selectedSentence !== null) {
          const phraseCount = sentences[selectedSentence].phrases.length;
          setSelectedPhraseIndex((prev) => (prev + 1) % phraseCount);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (selectedSentence !== null) {
          const phraseCount = sentences[selectedSentence].phrases.length;
          setSelectedPhraseIndex((prev) => (prev - 1 + phraseCount) % phraseCount);
        }
      } else if (e.key === 'a' || e.key === 'A') {
        // 'A' key to play full sentence
        e.preventDefault();
        if (selectedSentence !== null && !isLoading) {
          playAudio('sentence');
        }
      } else if (e.key === 'f' || e.key === 'F') {
        // 'F' key to play selected phrase
        e.preventDefault();
        if (selectedSentence !== null && !isLoading) {
          playAudio('phrase');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sentences, selectedSentence, rowVirtualizer, isLoading, playAudio]);

  return (
    <div ref={parentRef} className="h-screen w-full overflow-auto" style={{ contain: 'strict' }}>
      <table className="border-collapse border cursor-default w-full mx-auto max-w-3xl">
        <thead></thead>
        <tbody>
          <tr>
            <td style={{ height: `${rowVirtualizer.getTotalSize()}px` }} className="relative">
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const sentence = sentences[virtualRow.index];
                  return (
                    <div
                      key={virtualRow.key}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <table className="border-collapse w-full">
                        <tbody>
                          <SentenceRow
                            sentence={sentence}
                            isSelected={selectedSentence === virtualRow.index}
                            selectedPhraseIndex={selectedSentence === virtualRow.index ? selectedPhraseIndex : null}
                            isLoading={selectedSentence === virtualRow.index && isLoading}
                            isPlaying={selectedSentence === virtualRow.index && isPlaying}
                            onSelect={() => handleSelectSentence(virtualRow.index)}
                            onSelectPhrase={(phraseIndex) => handleSelectPhrase(virtualRow.index, phraseIndex)}
                          />
                        </tbody>
                      </table>
                    </div>
                  );
                })}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
