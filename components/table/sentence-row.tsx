'use client';
import { memo } from 'react';
import { cn } from '@/lib/utils';
import { Sentence } from '@/app/types';

interface SentenceRowProps {
  index: number;
  sentence: Sentence;
  isSelected: boolean;
  selectedPhraseIndex: number | null;
  showTranslation: boolean;
  onSelect: () => void;
  onSelectPhrase: (phraseIndex: number) => void;
}

export const SentenceRow = memo(
  ({
    index,
    sentence,
    isSelected,
    selectedPhraseIndex,
    showTranslation,
    onSelect,
    onSelectPhrase,
  }: SentenceRowProps) => {
    return (
      <tr className={cn('relative border-gray-600', isSelected && 'bg-orange-100')} onClick={onSelect}>
        <td className="pl-2 text-center text-xs text-gray-600 dark:text-gray-400 w-12">{index + 1}</td>
        <td className="p-1">
          <table className="border-collapse">
            <tbody>
              <tr>
                {sentence.phrases.map(({ french }, j) => (
                  <td
                    key={j}
                    className="px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPhrase(j);
                    }}
                  >
                    <span className={cn(isSelected && selectedPhraseIndex === j && 'border-b-3 border-orange-500')}>
                      {french}
                    </span>
                  </td>
                ))}
              </tr>
              <tr className={cn(!showTranslation && 'opacity-0')}>
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
