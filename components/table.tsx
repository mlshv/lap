'use client';
import { Sentence } from '@/app/types';
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

// Memoized row component to prevent unnecessary re-renders
const SentenceRow = memo(
  ({
    sentence,
    isSelected,
    onSelect,
  }: {
    sentence: Sentence;
    isSelected: boolean;
    onSelect: () => void;
  }) => {
    return (
      <tr className="border border-gray-600" onClick={onSelect}>
        <td className={isSelected ? 'bg-gray-200' : ''}>
          <table className="border-collapse">
            <tbody>
              <tr>
                {sentence.phrases.map(({ french }, j) => (
                  <td key={j} className="px-2">
                    {french}
                  </td>
                ))}
              </tr>
              <tr>
                {sentence.phrases.map(({ english }, j) => (
                  <td key={j} className="px-2">
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
  const parentRef = useRef<HTMLDivElement>(null);

  // Memoized select handler
  const handleSelectSentence = useCallback((index: number) => {
    setSelectedSentence(index);
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
          }
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sentences.length, rowVirtualizer]);

  return (
    <div
      ref={parentRef}
      className="h-screen w-full overflow-auto"
      style={{ contain: 'strict' }}
    >
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
                            onSelect={() => handleSelectSentence(virtualRow.index)}
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
