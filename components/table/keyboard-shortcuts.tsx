'use client';
import { useEffect } from 'react';
import { ArenaSpinner } from '@/components/arena-spinner';
import { MicrophoneIcon } from '@phosphor-icons/react';
import { Virtualizer } from '@tanstack/react-virtual';
import { Sentence } from '@/app/types';

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded text-xs font-mono">
      {children}
    </kbd>
  );
}

interface KeyboardShortcutsOverlayProps {
  isLoading: boolean;
  isPlaying: boolean;
  showTranslation: boolean;
}

export function KeyboardShortcutsOverlay({
  isLoading,
  isPlaying,
  showTranslation,
}: KeyboardShortcutsOverlayProps) {
  return (
    <div className="fixed top-4 left-4 z-50 border border-f1/10 shadow-lg p-3 space-y-2">
      {(isLoading || isPlaying) && (
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          {isLoading ? (
            <ArenaSpinner />
          ) : (
            <MicrophoneIcon size={18} weight="fill" />
          )}
          <span className="text-xs text-gray-600 dark:text-gray-400">
            {isLoading ? 'Loading...' : 'Playing'}
          </span>
        </div>
      )}
      <div className="space-y-1">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
          Navigation
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
          <div className="flex items-center gap-2">
            <Key>h</Key>
            <Key>←</Key>
            <span>Left phrase</span>
          </div>
          <div className="flex items-center gap-2">
            <Key>j</Key>
            <Key>↓</Key>
            <span>Next sentence</span>
          </div>
          <div className="flex items-center gap-2">
            <Key>k</Key>
            <Key>↑</Key>
            <span>Previous sentence</span>
          </div>
          <div className="flex items-center gap-2">
            <Key>l</Key>
            <Key>→</Key>
            <span>Right phrase</span>
          </div>
        </div>
      </div>
      <div className="space-y-1 pt-1 border-t border-gray-200 dark:border-gray-700">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
          Actions
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
          <div className="flex items-center gap-2">
            <Key>a</Key>
            <span>Play sentence</span>
          </div>
          <div className="flex items-center gap-2">
            <Key>f</Key>
            <span>Play phrase</span>
          </div>
          <div className="flex items-center gap-2">
            <Key>v</Key>
            <span>Toggle Translation {showTranslation ? '(visible)' : '(hidden)'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

interface UseKeyboardNavigationProps {
  sentences: Sentence[];
  selectedSentence: number | null;
  setSelectedSentence: React.Dispatch<React.SetStateAction<number | null>>;
  setSelectedPhraseIndex: React.Dispatch<React.SetStateAction<number>>;
  rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
  isLoading: boolean;
  isPlaying: boolean;
  playAudio: (mode: 'phrase' | 'sentence') => Promise<void>;
  stopAudio: () => void;
  showTranslation: boolean;
  setShowTranslation: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useKeyboardNavigation({
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
}: UseKeyboardNavigationProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();

      // Map vim keys to arrow keys
      const keyMap: Record<string, string> = {
        h: 'ArrowLeft',
        j: 'ArrowDown',
        k: 'ArrowUp',
        l: 'ArrowRight',
      };

      const mappedKey = keyMap[key] || e.key;

      if (mappedKey === 'ArrowDown') {
        e.preventDefault();
        setSelectedSentence((prev) => {
          const next =
            prev === null ? 0 : Math.min(prev + 1, sentences.length - 1);

          // Scroll to selected row
          if (next !== prev) {
            rowVirtualizer.scrollToIndex(next, { align: 'center' });
            setSelectedPhraseIndex(0);
          }
          return next;
        });
      } else if (mappedKey === 'ArrowUp') {
        e.preventDefault();
        setSelectedSentence((prev) => {
          const next =
            prev === null ? sentences.length - 1 : Math.max(prev - 1, 0);

          // Scroll to selected row
          if (next !== prev) {
            rowVirtualizer.scrollToIndex(next, { align: 'center' });
            setSelectedPhraseIndex(0);
          }
          return next;
        });
      } else if (mappedKey === 'ArrowRight') {
        e.preventDefault();
        if (selectedSentence !== null) {
          const phraseCount = sentences[selectedSentence].phrases.length;
          setSelectedPhraseIndex((prev) => (prev + 1) % phraseCount);
        }
      } else if (mappedKey === 'ArrowLeft') {
        e.preventDefault();
        if (selectedSentence !== null) {
          const phraseCount = sentences[selectedSentence].phrases.length;
          setSelectedPhraseIndex(
            (prev) => (prev - 1 + phraseCount) % phraseCount
          );
        }
      } else if (key === 'a') {
        // 'A' key to play full sentence
        e.preventDefault();
        if (selectedSentence !== null && !isLoading) {
          playAudio('sentence');
        }
      } else if (key === 'f') {
        // 'F' key to play selected phrase
        e.preventDefault();
        if (selectedSentence !== null && !isLoading) {
          playAudio('phrase');
        }
      } else if (e.key === 'Escape') {
        // ESC key to abort playing or loading
        e.preventDefault();
        if (isPlaying || isLoading) {
          stopAudio();
        }
      } else if (key === 'v') {
        // 'V' key to toggle translation visibility
        e.preventDefault();
        setShowTranslation((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
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
  ]);
}
