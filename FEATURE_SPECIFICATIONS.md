# Feature Specifications - Flashcard App

This document provides detailed specifications for each major feature of the flashcard application.

## Table of Contents
1. [Cloze Deletion Cards](#cloze-deletion-cards)
2. [Text-to-Speech with Accents](#text-to-speech-with-accents)
3. [Keyboard Shortcuts](#keyboard-shortcuts)
4. [PWA & Mobile Experience](#pwa--mobile-experience)
5. [Gamification & Analytics](#gamification--analytics)
6. [Pre-made Decks](#pre-made-decks)
7. [Deck Sharing](#deck-sharing)

---

## Cloze Deletion Cards

### Overview
Cloze deletion tests contextual understanding by hiding parts of a sentence, forcing users to recall the word in context rather than just its definition.

### Implementation

#### Data Structure
```typescript
interface ClozeCard {
  id: string;
  sentence: string;           // "The cat sat on the [mat]."
  clozeDeletions: Array<{
    text: string;             // "mat"
    position: number;         // Character position in sentence
    hint?: string;            // Optional hint
  }>;
  fullSentence: string;       // Original sentence without brackets
}
```

#### Creating Cloze Cards

**Automatic Detection:**
```typescript
function createClozeCard(word: string, sentence: string): ClozeCard {
  // Find word in sentence (case-insensitive)
  const regex = new RegExp(`\\b${word}\\b`, 'gi');
  const matches = [...sentence.matchAll(regex)];
  
  if (matches.length === 0) {
    throw new Error('Word not found in sentence');
  }

  // Use first occurrence
  const match = matches[0];
  const position = match.index!;
  
  // Create cloze deletion
  const clozeSentence = sentence.substring(0, position) +
    '[...]' +
    sentence.substring(position + word.length);

  return {
    sentence: clozeSentence,
    clozeDeletions: [{
      text: word,
      position,
    }],
    fullSentence: sentence,
  };
}
```

**Manual Selection:**
Users can select any part of a sentence to create custom cloze deletions:
```typescript
function createCustomCloze(sentence: string, startPos: number, endPos: number): ClozeCard {
  const deletedText = sentence.substring(startPos, endPos);
  const clozeSentence = 
    sentence.substring(0, startPos) +
    '[...]' +
    sentence.substring(endPos);

  return {
    sentence: clozeSentence,
    clozeDeletions: [{
      text: deletedText,
      position: startPos,
    }],
    fullSentence: sentence,
  };
}
```

#### UI Component

```typescript
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface ClozeCardProps {
  card: ClozeCard;
  onSubmit: (answer: string) => void;
}

export function ClozeCardComponent({ card, onSubmit }: ClozeCardProps) {
  const [answer, setAnswer] = useState('');
  const [revealed, setRevealed] = useState(false);

  const checkAnswer = () => {
    const correct = answer.toLowerCase().trim() === 
                   card.clozeDeletions[0].text.toLowerCase().trim();
    setRevealed(true);
    return correct;
  };

  return (
    <div className="space-y-6">
      <div className="text-2xl text-center">
        {card.sentence.split('[...]').map((part, idx) => (
          <span key={idx}>
            {part}
            {idx < card.clozeDeletions.length && (
              <span className="inline-block min-w-[100px] border-b-2 border-blue-500 mx-2">
                {revealed ? (
                  <span className="text-blue-600 font-semibold">
                    {card.clozeDeletions[idx].text}
                  </span>
                ) : (
                  <Input
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    className="inline-block w-auto min-w-[100px]"
                    placeholder="..."
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') checkAnswer();
                    }}
                  />
                )}
              </span>
            )}
          </span>
        ))}
      </div>

      {!revealed && (
        <Button onClick={checkAnswer} className="w-full">
          Check Answer
        </Button>
      )}

      {revealed && (
        <div className="text-center">
          <p className="text-lg mb-4">
            {answer.toLowerCase().trim() === card.clozeDeletions[0].text.toLowerCase().trim()
              ? '✅ Correct!'
              : '❌ Incorrect'}
          </p>
          <p className="text-gray-600">
            Full sentence: {card.fullSentence}
          </p>
        </div>
      )}
    </div>
  );
}
```

---

## Text-to-Speech with Accents

### Overview
Provide high-quality pronunciation with support for multiple English accents (US, UK, Australian).

### Implementation Strategy

#### 1. Web Speech API (Free, Built-in)

```typescript
interface TTSOptions {
  text: string;
  accent: 'us' | 'uk' | 'au';
  rate?: number;  // 0.1 to 10
  pitch?: number; // 0 to 2
}

function speakText({ text, accent, rate = 1, pitch = 1 }: TTSOptions) {
  if (!('speechSynthesis' in window)) {
    console.error('Speech synthesis not supported');
    return;
  }

  const utterance = new SpeechSynthesisUtterance(text);
  
  // Map accent to voice
  const voices = speechSynthesis.getVoices();
  const voiceMap = {
    us: voices.find(v => v.lang === 'en-US'),
    uk: voices.find(v => v.lang === 'en-GB'),
    au: voices.find(v => v.lang === 'en-AU'),
  };

  utterance.voice = voiceMap[accent] || voiceMap.us || voices[0];
  utterance.rate = rate;
  utterance.pitch = pitch;

  speechSynthesis.speak(utterance);
}

// Usage
speakText({ text: 'Hello, world!', accent: 'uk' });
```

#### 2. OpenAI TTS (Premium, High Quality)

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function generateTTS(text: string, accent: 'us' | 'uk' | 'au'): Promise<string> {
  // OpenAI TTS voices
  const voiceMap = {
    us: 'alloy',  // American accent
    uk: 'echo',   // British-sounding
    au: 'fable',  // Australian-sounding
  };

  const mp3 = await openai.audio.speech.create({
    model: 'tts-1',
    voice: voiceMap[accent],
    input: text,
  });

  const buffer = Buffer.from(await mp3.arrayBuffer());
  
  // Save to Supabase Storage
  const fileName = `tts/${Date.now()}-${accent}.mp3`;
  const { data, error } = await supabase.storage
    .from('audio')
    .upload(fileName, buffer, {
      contentType: 'audio/mpeg',
    });

  if (error) throw error;

  // Get public URL
  const { data: { publicUrl } } = supabase.storage
    .from('audio')
    .getPublicUrl(fileName);

  return publicUrl;
}
```

#### 3. Hybrid Approach (Recommended)

```typescript
async function playPronunciation(word: string, accent: 'us' | 'uk' | 'au', audioUrl?: string) {
  // 1. Try cached audio URL first
  if (audioUrl) {
    const audio = new Audio(audioUrl);
    await audio.play();
    return;
  }

  // 2. Try Web Speech API (instant, free)
  if ('speechSynthesis' in window) {
    speakText({ text: word, accent });
    return;
  }

  // 3. Fallback: Generate with OpenAI (slower, costs money)
  try {
    const generatedUrl = await generateTTS(word, accent);
    const audio = new Audio(generatedUrl);
    await audio.play();
  } catch (error) {
    console.error('TTS failed:', error);
  }
}
```

#### UI Component

```typescript
'use client';

import { useState } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function PronunciationPlayer({ word, audioUrl }: { word: string; audioUrl?: string }) {
  const [accent, setAccent] = useState<'us' | 'uk' | 'au'>('us');
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = async () => {
    setIsPlaying(true);
    try {
      await playPronunciation(word, accent, audioUrl);
    } finally {
      setIsPlaying(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Select value={accent} onValueChange={(v) => setAccent(v as any)}>
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="us">🇺🇸 US</SelectItem>
          <SelectItem value="uk">🇬🇧 UK</SelectItem>
          <SelectItem value="au">🇦🇺 AU</SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="outline"
        size="icon"
        onClick={handlePlay}
        disabled={isPlaying}
      >
        {isPlaying ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Volume2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}
```

---

## Keyboard Shortcuts

### Overview
Power users need keyboard shortcuts for efficient studying without touching the mouse.

### Shortcut Mapping

```typescript
export const KEYBOARD_SHORTCUTS = {
  // Study session
  FLIP_CARD: ' ',           // Spacebar
  RATE_AGAIN: '1',
  RATE_HARD: '2',
  RATE_GOOD: '3',
  RATE_EASY: '4',
  
  // Navigation
  EDIT_CARD: 'e',
  DELETE_CARD: 'Delete',
  NEXT_CARD: 'ArrowRight',
  PREV_CARD: 'ArrowLeft',
  
  // Actions
  NEW_CARD: 'n',
  NEW_DECK: 'd',
  SEARCH: '/',
  
  // Modes
  TOGGLE_DARK_MODE: 'Shift+D',
  TOGGLE_DISTRACTION_FREE: 'f',
  PLAY_AUDIO: 'p',
  
  // Study
  START_STUDY: 's',
  PAUSE_STUDY: 'Escape',
} as const;
```

### Implementation

```typescript
'use client';

import { useEffect, useCallback } from 'react';

interface KeyboardShortcutConfig {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcutConfig[]) {
  const handleKeyPress = useCallback((event: KeyboardEvent) => {
    // Don't trigger if user is typing in an input
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    for (const shortcut of shortcuts) {
      const keyMatch = event.key === shortcut.key;
      const ctrlMatch = shortcut.ctrlKey ? event.ctrlKey : !event.ctrlKey;
      const shiftMatch = shortcut.shiftKey ? event.shiftKey : !event.shiftKey;
      const altMatch = shortcut.altKey ? event.altKey : !event.altKey;

      if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
        event.preventDefault();
        shortcut.action();
        break;
      }
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleKeyPress]);
}

// Usage in study session
export function StudySession() {
  const [isFlipped, setIsFlipped] = useState(false);
  
  useKeyboardShortcuts([
    {
      key: ' ',
      action: () => setIsFlipped(!isFlipped),
      description: 'Flip card',
    },
    {
      key: '1',
      action: () => handleRate(QUALITY_RATINGS.AGAIN),
      description: 'Rate: Again',
    },
    {
      key: '2',
      action: () => handleRate(QUALITY_RATINGS.HARD),
      description: 'Rate: Hard',
    },
    {
      key: '3',
      action: () => handleRate(QUALITY_RATINGS.GOOD),
      description: 'Rate: Good',
    },
    {
      key: '4',
      action: () => handleRate(QUALITY_RATINGS.EASY),
      description: 'Rate: Easy',
    },
    {
      key: 'e',
      action: () => setEditMode(true),
      description: 'Edit card',
    },
  ]);

  // ... rest of component
}
```

### Keyboard Shortcuts Help Modal

```typescript
'use client';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function KeyboardShortcutsHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">Study Session</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Flip card</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">Space</kbd>
              </li>
              <li className="flex justify-between">
                <span>Rate: Again</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">1</kbd>
              </li>
              <li className="flex justify-between">
                <span>Rate: Hard</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">2</kbd>
              </li>
              <li className="flex justify-between">
                <span>Rate: Good</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">3</kbd>
              </li>
              <li className="flex justify-between">
                <span>Rate: Easy</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">4</kbd>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Actions</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between">
                <span>Edit card</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">E</kbd>
              </li>
              <li className="flex justify-between">
                <span>New card</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">N</kbd>
              </li>
              <li className="flex justify-between">
                <span>Play audio</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">P</kbd>
              </li>
              <li className="flex justify-between">
                <span>Toggle dark mode</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">Shift+D</kbd>
              </li>
              <li className="flex justify-between">
                <span>Distraction-free</span>
                <kbd className="px-2 py-1 bg-gray-100 rounded">F</kbd>
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

## PWA & Mobile Experience

### PWA Configuration

#### next.config.js

```javascript
const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/api\.dictionaryapi\.dev\/.*/i,
      handler: 'CacheFirst',
      options: {
        cacheName: 'dictionary-api',
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 1 week
        },
      },
    },
    {
      urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'supabase-api',
        networkTimeoutSeconds: 10,
      },
    },
  ],
});

module.exports = withPWA({
  // Next.js config
});
```

#### public/manifest.json

```json
{
  "name": "Flashcard - Vocabulary Learning",
  "short_name": "Flashcard",
  "description": "Learn English vocabulary with spaced repetition",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#3b82f6",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icons/icon-72x72.png",
      "sizes": "72x72",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-96x96.png",
      "sizes": "96x96",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-128x128.png",
      "sizes": "128x128",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-144x144.png",
      "sizes": "144x144",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-152x152.png",
      "sizes": "152x152",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-384x384.png",
      "sizes": "384x384",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512x512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Touch Gestures

```typescript
'use client';

import { useSwipeable } from 'react-swipeable';

export function SwipeableCard({ onSwipeLeft, onSwipeRight, children }) {
  const handlers = useSwipeable({
    onSwipedLeft: () => onSwipeLeft(),
    onSwipedRight: () => onSwipeRight(),
    trackMouse: true,
    preventScrollOnSwipe: true,
  });

  return (
    <div {...handlers} className="touch-none">
      {children}
    </div>
  );
}

// Usage in study session
export function MobileStudySession() {
  const handleSwipeLeft = () => {
    // Rate as "Again" or "Hard"
    handleRate(QUALITY_RATINGS.AGAIN);
  };

  const handleSwipeRight = () => {
    // Rate as "Good" or "Easy"
    handleRate(QUALITY_RATINGS.GOOD);
  };

  return (
    <SwipeableCard
      onSwipeLeft={handleSwipeLeft}
      onSwipeRight={handleSwipeRight}
    >
      <StudyCard card={currentCard} />
    </SwipeableCard>
  );
}
```

### Offline Support

```typescript
// lib/offline-queue.ts
import { openDB, DBSchema } from 'idb';

interface OfflineQueueDB extends DBSchema {
  'pending-reviews': {
    key: string;
    value: {
      cardId: string;
      quality: number;
      timestamp: number;
    };
  };
  'pending-cards': {
    key: string;
    value: {
      word: string;
      deckId: string;
      contextSentence?: string;
      timestamp: number;
    };
  };
}

const dbPromise = openDB<OfflineQueueDB>('flashcard-offline', 1, {
  upgrade(db) {
    db.createObjectStore('pending-reviews');
    db.createObjectStore('pending-cards');
  },
});

export async function queueReview(cardId: string, quality: number) {
  const db = await dbPromise;
  await db.put('pending-reviews', {
    cardId,
    quality,
    timestamp: Date.now(),
  }, `${cardId}-${Date.now()}`);
}

export async function syncPendingReviews() {
  const db = await dbPromise;
  const reviews = await db.getAll('pending-reviews');

  for (const review of reviews) {
    try {
      await submitCardReview(review.cardId, review.quality);
      await db.delete('pending-reviews', `${review.cardId}-${review.timestamp}`);
    } catch (error) {
      console.error('Failed to sync review:', error);
    }
  }
}

// Auto-sync when online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    syncPendingReviews();
  });
}
```

---

## Gamification & Analytics

### Streak Tracking

```typescript
// lib/streak.ts
import { differenceInDays, startOfDay } from 'date-fns';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastStudyDate: Date;
  studyDates: Date[];
}

export function calculateStreak(studyDates: Date[]): StreakData {
  if (studyDates.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      lastStudyDate: new Date(),
      studyDates: [],
    };
  }

  // Sort dates in descending order
  const sorted = studyDates
    .map(d => startOfDay(d))
    .sort((a, b) => b.getTime() - a.getTime());

  const today = startOfDay(new Date());
  const lastStudy = sorted[0];

  // Calculate current streak
  let currentStreak = 0;
  let checkDate = today;

  for (const date of sorted) {
    const diff = differenceInDays(checkDate, date);
    
    if (diff === 0 || diff === 1) {
      currentStreak++;
      checkDate = date;
    } else {
      break;
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 1;

  for (let i = 0; i < sorted.length - 1; i++) {
    const diff = differenceInDays(sorted[i], sorted[i + 1]);
    
    if (diff === 1) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    currentStreak,
    longestStreak,
    lastStudyDate: lastStudy,
    studyDates: sorted,
  };
}
```

### Heatmap Component

```typescript
'use client';

import { format, eachDayOfInterval, subDays, startOfWeek } from 'date-fns';

interface HeatmapProps {
  studyDates: Date[];
}

export function StudyHeatmap({ studyDates }: HeatmapProps) {
  const today = new Date();
  const startDate = subDays(today, 364); // Last year
  const days = eachDayOfInterval({ start: startDate, end: today });

  // Count studies per day
  const studyCount = new Map<string, number>();
  studyDates.forEach(date => {
    const key = format(date, 'yyyy-MM-dd');
    studyCount.set(key, (studyCount.get(key) || 0) + 1);
  });

  // Get intensity level (0-4)
  const getIntensity = (count: number) => {
    if (count === 0) return 0;
    if (count < 5) return 1;
    if (count < 10) return 2;
    if (count < 20) return 3;
    return 4;
  };

  const intensityColors = [
    'bg-gray-100',
    'bg-green-200',
    'bg-green-400',
    'bg-green-600',
    'bg-green-800',
  ];

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid grid-flow-col gap-1" style={{ gridTemplateRows: 'repeat(7, 1fr)' }}>
        {days.map(day => {
          const key = format(day, 'yyyy-MM-dd');
          const count = studyCount.get(key) || 0;
          const intensity = getIntensity(count);

          return (
            <div
              key={key}
              className={`w-3 h-3 rounded-sm ${intensityColors[intensity]}`}
              title={`${format(day, 'MMM d, yyyy')}: ${count} cards studied`}
            />
          );
        })}
      </div>
    </div>
  );
}
```

### Vocabulary Size Estimation

```typescript
// lib/vocabulary-estimation.ts

// Based on CEFR levels and word frequency
const CEFR_THRESHOLDS = {
  A1: { minWords: 0, maxFrequency: 1000 },
  A2: { minWords: 500, maxFrequency: 2000 },
  B1: { minWords: 1000, maxFrequency: 3000 },
  B2: { minWords: 2000, maxFrequency: 5000 },
  C1: { minWords: 4000, maxFrequency: 8000 },
  C2: { minWords: 8000, maxFrequency: Infinity },
};

export function estimateVocabularyLevel(matureCardCount: number): string {
  if (matureCardCount < 500) return 'A1';
  if (matureCardCount < 1000) return 'A2';
  if (matureCardCount < 2000) return 'B1';
  if (matureCardCount < 4000) return 'B2';
  if (matureCardCount < 8000) return 'C1';
  return 'C2';
}

export function getNextLevelProgress(matureCardCount: number): {
  currentLevel: string;
  nextLevel: string;
  progress: number;
} {
  const currentLevel = estimateVocabularyLevel(matureCardCount);
  const levels = Object.keys(CEFR_THRESHOLDS);
  const currentIndex = levels.indexOf(currentLevel);
  const nextLevel = levels[currentIndex + 1] || 'C2';

  const currentThreshold = CEFR_THRESHOLDS[currentLevel].minWords;
  const nextThreshold = CEFR_THRESHOLDS[nextLevel].minWords;

  const progress = ((matureCardCount - currentThreshold) / (nextThreshold - currentThreshold)) * 100;

  return {
    currentLevel,
    nextLevel,
    progress: Math.min(100, Math.max(0, progress)),
  };
}
```

---

## Pre-made Decks

### Deck Templates

```typescript
// data/pre-made-decks.ts

export const PRE_MADE_DECKS = [
  {
    id: 'common-1000',
    name: 'Top 1000 Most Common English Words',
    description: 'Essential vocabulary for everyday English communication',
    category: 'general',
    level: 'A1-A2',
    cardCount: 1000,
    tags: ['beginner', 'essential', 'common'],
  },
  {
    id: 'business-english',
    name: 'Business English Essentials',
    description: 'Professional vocabulary for workplace communication',
    category: 'business',
    level: 'B2-C1',
    cardCount: 500,
    tags: ['business', 'professional', 'workplace'],
  },
  {
    id: 'toefl-prep',
    name: 'TOEFL Vocabulary',
    description: 'High-frequency words for TOEFL exam preparation',
    category: 'test-prep',
    level: 'B2-C1',
    cardCount: 800,
    tags: ['toefl', 'exam', 'academic'],
  },
  {
    id: 'phrasal-verbs',
    name: 'Essential Phrasal Verbs',
    description: 'Common phrasal verbs used in everyday English',
    category: 'grammar',
    level: 'B1-B2',
    cardCount: 300,
    tags: ['phrasal-verbs', 'verbs', 'idioms'],
  },
  {
    id: 'academic-english',
    name: 'Academic Word List',
    description: 'Vocabulary for academic reading and writing',
    category: 'academic',
    level: 'C1-C2',
    cardCount: 570,
    tags: ['academic', 'university', 'research'],
  },
];
```

### Import Pre-made Deck

```typescript
// app/api/decks/import/route.ts

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { preMadeDeckId } = await request.json();

  // Fetch pre-made deck data
  const { data: preMadeDeck, error: fetchError } = await supabase
    .from('pre_made_decks')
    .select('*')
    .eq('id', preMadeDeckId)
    .single();

  if (fetchError) throw fetchError;

  // Create user's copy of the deck
  const { data: newDeck, error: deckError } = await supabase
    .from('decks')
    .insert({
      user_id: session.user.id,
      name: preMadeDeck.name,
      description: preMadeDeck.description,
      tags: [preMadeDeck.category, preMadeDeck.level],
    })
    .select()
    .single();

  if (deckError) throw deckError;

  // Import all cards
  const cardsToImport = preMadeDeck.cards_data.map(card => ({
    deck_id: newDeck.id,
    ...card,
  }));

  const { error: cardsError } = await supabase
    .from('cards')
    .insert(cardsToImport);

  if (cardsError) throw cardsError;

  return NextResponse.json({
    deck: newDeck,
    message: 'Deck imported successfully',
  });
}
```

---

## Deck Sharing

### Generate Share Link

```typescript
// app/api/decks/share/route.ts

import { nanoid } from 'nanoid';

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { deckId } = await request.json();

  // Verify ownership
  const { data: deck, error: deckError } = await supabase
    .from('decks')
    .select('*')
    .eq('id', deckId)
    .eq('user_id', session.user.id)
    .single();

  if (deckError || !deck) {
    return NextResponse.json({ error: 'Deck not found' }, { status: 404 });
  }

  // Generate unique share token
  const shareToken = nanoid(10);

  // Create share record
  const { data: sharedDeck, error: shareError } = await supabase
    .from('shared_decks')
    .insert({
      deck_id: deckId,
      share_token: shareToken,
    })
    .select()
    .single();

  if (shareError) throw shareError;

  // Make deck public
  await supabase
    .from('decks')
    .update({ is_public: true })
    .eq('id', deckId);

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/shared/${shareToken}`;

  return NextResponse.json({
    shareUrl,
    shareToken,
  });
}
```

### Import Shared Deck

```typescript
// app/shared/[token]/page.tsx

export default async function SharedDeckPage({ params }: { params: { token: string } }) {
  const supabase = createServerComponentClient({ cookies });

  // Fetch shared deck
  const { data: sharedDeck } = await supabase
    .from('shared_decks')
    .select(`
      *,
      decks (
        id,
        name,
        description,
        card_count,
        tags
      )
    `)
    .eq('share_token', params.token)
    .single();

  if (!sharedDeck) {
    return <div>Deck not found</div>;
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-4">{sharedDeck.decks.name}</h1>
      <p className="text-gray-600 mb-6">{sharedDeck.decks.description}</p>
      
      <div className="flex gap-4 mb-8">
        <div className="bg-blue-100 px-4 py-2 rounded">
          {sharedDeck.decks.card_count} cards
        </div>
        <div className="bg-green-100 px-4 py-2 rounded">
          {sharedDeck.download_count} downloads
        </div>
      </div>

      <ImportDeckButton deckId={sharedDeck.deck_id} />
    </div>
  );
}
```

---

This feature specification document provides detailed implementation guidance for the advanced features of the flashcard app. Each feature is designed to enhance the learning experience while maintaining ease of use.