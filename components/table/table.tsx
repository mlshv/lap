'use client';
import { useState, useRef, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Sentence } from '@/app/types';
import { SentenceRow } from './sentence-row';
import { useAudioPlayback } from './use-audio-playback';
import { KeyboardShortcutsOverlay, useKeyboardNavigation } from './keyboard-shortcuts';
import { cn } from '@/lib/utils';

interface TableProps {
  sentences: Sentence[];
}

export function Table({ sentences }: TableProps) {
  const [selectedSentence, setSelectedSentence] = useState<number | null>(null);
  const [selectedPhraseIndex, setSelectedPhraseIndex] = useState<number>(0);
  const [showTranslation, setShowTranslation] = useState<boolean>(true);
  const parentRef = useRef<HTMLDivElement>(null);

  // Memoized select handlers
  const handleSelectSentence = useCallback((index: number) => {
    setSelectedSentence(index);
    setSelectedPhraseIndex(0); // Reset phrase selection when row changes
  }, []);

  const handleSelectPhrase = useCallback((sentenceIndex: number, phraseIndex: number) => {
    setSelectedSentence(sentenceIndex);
    setSelectedPhraseIndex(phraseIndex);
  }, []);

  // Virtual scrolling setup
  const rowVirtualizer = useVirtualizer({
    count: sentences.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Estimated row height in pixels
    overscan: 5, // Number of items to render outside visible area
  });

  // Audio playback hook
  const { isLoading, isPlaying, playAudio, stopAudio } = useAudioPlayback({
    sentences,
    selectedSentence,
    selectedPhraseIndex,
  });

  // Keyboard navigation hook
  useKeyboardNavigation({
    sentences,
    selectedSentence,
    setSelectedSentence,
    setSelectedPhraseIndex,
    rowVirtualizer,
    isLoading,
    isPlaying,
    playAudio,
    stopAudio,
    showTranslation,
    setShowTranslation,
  });

  return (
    <>
      <KeyboardShortcutsOverlay isLoading={isLoading} isPlaying={isPlaying} showTranslation={showTranslation} />

      <div ref={parentRef} className="h-screen w-full overflow-auto py-4" style={{ contain: 'strict' }}>
        <table className="border-collapse rounded-lg cursor-default w-full mx-auto max-w-3xl shadow-lg">
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
                        className={cn(
                          'border-x border-t border-f1/10',
                          selectedSentence === virtualRow.index && 'border-orange-100'
                        )}
                      >
                        <table className="border-collapse w-full">
                          <tbody>
                            <SentenceRow
                              index={virtualRow.index}
                              sentence={sentence}
                              isSelected={selectedSentence === virtualRow.index}
                              selectedPhraseIndex={selectedSentence === virtualRow.index ? selectedPhraseIndex : null}
                              showTranslation={showTranslation}
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
    </>
  );
}
