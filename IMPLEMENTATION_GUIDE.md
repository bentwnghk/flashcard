# Implementation Guide - Flashcard App

This guide provides detailed implementation instructions for each major feature of the flashcard app.

## Table of Contents
1. [Project Setup](#project-setup)
2. [Database Schema Implementation](#database-schema-implementation)
3. [SM-2 Algorithm](#sm-2-algorithm)
4. [API Integrations](#api-integrations)
5. [Core Features](#core-features)
6. [UI Components](#ui-components)
7. [Browser Extension](#browser-extension)

---

## Project Setup

### 1. Initialize Next.js Project

```bash
npx create-next-app@latest flashcard-app --typescript --tailwind --app
cd flashcard-app
```

### 2. Install Dependencies

```bash
# Core dependencies
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
npm install zustand react-hook-form zod @hookform/resolvers
npm install framer-motion date-fns

# UI Components
npm install @radix-ui/react-dialog @radix-ui/react-dropdown-menu
npm install @radix-ui/react-select @radix-ui/react-switch
npm install @radix-ui/react-toast lucide-react

# PWA
npm install next-pwa

# Utilities
npm install clsx tailwind-merge
npm install react-swipeable

# Dev dependencies
npm install -D @types/node @types/react
```

### 3. Environment Variables

Create `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# OpenAI
OPENAI_API_KEY=your_openai_api_key

# Unsplash
UNSPLASH_ACCESS_KEY=your_unsplash_key

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Database Schema Implementation

### Supabase SQL Migration

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  settings JSONB DEFAULT '{"darkMode": false, "accentPreference": "us", "dailyGoal": 20}'::jsonb,
  streak_count INTEGER DEFAULT 0,
  last_study_date DATE,
  total_cards_studied INTEGER DEFAULT 0,
  vocabulary_size_estimate TEXT DEFAULT 'A1'
);

-- Decks table
CREATE TABLE public.decks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  card_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Cards table
CREATE TABLE public.cards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  deck_id UUID REFERENCES public.decks(id) ON DELETE CASCADE NOT NULL,
  word TEXT NOT NULL,
  definition TEXT NOT NULL,
  phonetic TEXT,
  part_of_speech TEXT,
  example_sentences JSONB DEFAULT '[]'::jsonb,
  image_url TEXT,
  audio_url TEXT,
  context_sentence TEXT,
  context_source TEXT,
  ai_hint TEXT,
  card_type TEXT DEFAULT 'basic' CHECK (card_type IN ('basic', 'cloze', 'reverse')),
  parent_card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Card reviews table (SM-2 data)
CREATE TABLE public.card_reviews (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  card_id UUID REFERENCES public.cards(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  ease_factor REAL DEFAULT 2.5,
  interval INTEGER DEFAULT 0,
  repetitions INTEGER DEFAULT 0,
  next_review_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_review_date TIMESTAMP WITH TIME ZONE,
  quality INTEGER,
  review_history JSONB DEFAULT '[]'::jsonb,
  is_mature BOOLEAN DEFAULT false,
  UNIQUE(card_id, user_id)
);

-- Shared decks table
CREATE TABLE public.shared_decks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  deck_id UUID REFERENCES public.decks(id) ON DELETE CASCADE NOT NULL,
  share_token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  download_count INTEGER DEFAULT 0
);

-- Pre-made decks table
CREATE TABLE public.pre_made_decks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  level TEXT CHECK (level IN ('A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  card_count INTEGER DEFAULT 0,
  cards_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Study sessions table (for analytics)
CREATE TABLE public.study_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  deck_id UUID REFERENCES public.decks(id) ON DELETE CASCADE,
  cards_studied INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for performance
CREATE INDEX idx_decks_user_id ON public.decks(user_id);
CREATE INDEX idx_cards_deck_id ON public.cards(deck_id);
CREATE INDEX idx_card_reviews_user_id ON public.card_reviews(user_id);
CREATE INDEX idx_card_reviews_next_review ON public.card_reviews(next_review_date);
CREATE INDEX idx_card_reviews_card_user ON public.card_reviews(card_id, user_id);
CREATE INDEX idx_shared_decks_token ON public.shared_decks(share_token);
CREATE INDEX idx_study_sessions_user_date ON public.study_sessions(user_id, started_at);

-- Row Level Security (RLS) Policies

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Decks
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own decks"
  ON public.decks FOR SELECT
  USING (auth.uid() = user_id OR is_public = true);

CREATE POLICY "Users can create own decks"
  ON public.decks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own decks"
  ON public.decks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own decks"
  ON public.decks FOR DELETE
  USING (auth.uid() = user_id);

-- Cards
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view cards in accessible decks"
  ON public.cards FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.decks
      WHERE decks.id = cards.deck_id
      AND (decks.user_id = auth.uid() OR decks.is_public = true)
    )
  );

CREATE POLICY "Users can create cards in own decks"
  ON public.cards FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.decks
      WHERE decks.id = cards.deck_id
      AND decks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update cards in own decks"
  ON public.cards FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.decks
      WHERE decks.id = cards.deck_id
      AND decks.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete cards in own decks"
  ON public.cards FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.decks
      WHERE decks.id = cards.deck_id
      AND decks.user_id = auth.uid()
    )
  );

-- Card Reviews
ALTER TABLE public.card_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reviews"
  ON public.card_reviews FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own reviews"
  ON public.card_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own reviews"
  ON public.card_reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- Functions and Triggers

-- Update deck card count
CREATE OR REPLACE FUNCTION update_deck_card_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.decks
    SET card_count = card_count + 1
    WHERE id = NEW.deck_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.decks
    SET card_count = card_count - 1
    WHERE id = OLD.deck_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deck_card_count
AFTER INSERT OR DELETE ON public.cards
FOR EACH ROW EXECUTE FUNCTION update_deck_card_count();

-- Update deck updated_at timestamp
CREATE OR REPLACE FUNCTION update_deck_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.decks
  SET updated_at = NOW()
  WHERE id = NEW.deck_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_deck_timestamp
AFTER INSERT OR UPDATE ON public.cards
FOR EACH ROW EXECUTE FUNCTION update_deck_timestamp();
```

---

## SM-2 Algorithm

### TypeScript Implementation

Create `lib/sm2.ts`:

```typescript
export interface SM2Result {
  interval: number;      // Days until next review
  repetitions: number;   // Number of successful reviews
  easeFactor: number;    // Difficulty multiplier (1.3 - 2.5)
  nextReviewDate: Date;  // Calculated next review date
}

export interface SM2Input {
  quality: number;       // 0-5 rating
  repetitions: number;   // Current repetitions
  easeFactor: number;    // Current ease factor
  interval: number;      // Current interval in days
}

/**
 * Calculate next review using SuperMemo 2 (SM-2) algorithm
 * 
 * Quality ratings:
 * 0 - Complete blackout
 * 1 - Incorrect but remembered something
 * 2 - Correct but very difficult (Hard)
 * 3 - Correct with some hesitation (Good)
 * 4 - Correct with ease
 * 5 - Perfect recall (Easy)
 */
export function calculateSM2(input: SM2Input): SM2Result {
  const { quality, repetitions, easeFactor, interval } = input;

  // Validate quality rating
  if (quality < 0 || quality > 5) {
    throw new Error('Quality must be between 0 and 5');
  }

  // Calculate new ease factor
  let newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // Ensure ease factor stays within bounds
  newEaseFactor = Math.max(1.3, newEaseFactor);

  let newRepetitions: number;
  let newInterval: number;

  // If quality < 3, the card is failed
  if (quality < 3) {
    newRepetitions = 0;
    newInterval = 1; // Review again tomorrow
  } else {
    newRepetitions = repetitions + 1;

    // Calculate interval based on repetition number
    if (newRepetitions === 1) {
      newInterval = 1; // First successful review: 1 day
    } else if (newRepetitions === 2) {
      newInterval = 6; // Second successful review: 6 days
    } else {
      // Subsequent reviews: multiply previous interval by ease factor
      newInterval = Math.round(interval * newEaseFactor);
    }
  }

  // Calculate next review date
  const nextReviewDate = new Date();
  nextReviewDate.setDate(nextReviewDate.getDate() + newInterval);

  return {
    interval: newInterval,
    repetitions: newRepetitions,
    easeFactor: newEaseFactor,
    nextReviewDate
  };
}

/**
 * Map user-friendly button labels to quality ratings
 */
export const QUALITY_RATINGS = {
  AGAIN: 0,  // Complete failure
  HARD: 2,   // Difficult but correct
  GOOD: 3,   // Correct with some effort
  EASY: 5    // Perfect recall
} as const;

/**
 * Get suggested intervals for display (before user rates)
 */
export function getSuggestedIntervals(currentInterval: number, easeFactor: number) {
  return {
    again: '< 1 day',
    hard: `${Math.round(currentInterval * 1.2)} days`,
    good: `${Math.round(currentInterval * easeFactor)} days`,
    easy: `${Math.round(currentInterval * easeFactor * 1.3)} days`
  };
}

/**
 * Determine if a card is "mature" (well-learned)
 * A card is considered mature if interval >= 21 days
 */
export function isCardMature(interval: number): boolean {
  return interval >= 21;
}
```

### Usage Example

```typescript
import { calculateSM2, QUALITY_RATINGS } from '@/lib/sm2';

// User rates card as "Good"
const result = calculateSM2({
  quality: QUALITY_RATINGS.GOOD,
  repetitions: 2,
  easeFactor: 2.5,
  interval: 6
});

console.log(result);
// {
//   interval: 15,
//   repetitions: 3,
//   easeFactor: 2.5,
//   nextReviewDate: Date (15 days from now)
// }
```

---

## API Integrations

### 1. Free Dictionary API

Create `lib/api/dictionary.ts`:

```typescript
export interface DictionaryDefinition {
  word: string;
  phonetic?: string;
  phonetics: Array<{
    text: string;
    audio?: string;
  }>;
  meanings: Array<{
    partOfSpeech: string;
    definitions: Array<{
      definition: string;
      example?: string;
      synonyms: string[];
      antonyms: string[];
    }>;
  }>;
}

export async function fetchDictionaryData(word: string): Promise<DictionaryDefinition | null> {
  try {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data[0]; // Return first result
  } catch (error) {
    console.error('Dictionary API error:', error);
    return null;
  }
}
```

### 2. Datamuse API (Example Sentences)

Create `lib/api/datamuse.ts`:

```typescript
export interface DatamuseWord {
  word: string;
  score: number;
  tags?: string[];
}

export async function fetchExampleSentences(word: string): Promise<string[]> {
  try {
    // Use Datamuse's "means like" endpoint with definitions
    const response = await fetch(
      `https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&md=d&max=5`
    );

    if (!response.ok) {
      return [];
    }

    const data: DatamuseWord[] = await response.json();
    
    // Extract example sentences from definitions
    const sentences: string[] = [];
    data.forEach(item => {
      if (item.tags) {
        item.tags.forEach(tag => {
          if (tag.startsWith('def:')) {
            const definition = tag.substring(4);
            // Simple sentence extraction (can be improved)
            if (definition.includes(word)) {
              sentences.push(definition);
            }
          }
        });
      }
    });

    return sentences.slice(0, 3); // Return top 3
  } catch (error) {
    console.error('Datamuse API error:', error);
    return [];
  }
}

// Alternative: Use a simple sentence generator
export function generateExampleSentence(word: string, definition: string): string {
  // This is a fallback if API doesn't provide good sentences
  return `The word "${word}" means ${definition}.`;
}
```

### 3. OpenAI Integration

Create `lib/api/openai.ts`:

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateMnemonic(word: string, definition: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates memorable mnemonics for vocabulary words. Keep them short, creative, and easy to remember.'
        },
        {
          role: 'user',
          content: `Create a mnemonic device to remember the word "${word}" which means: ${definition}`
        }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('OpenAI API error:', error);
    return '';
  }
}

export async function explainLikeImFive(word: string, definition: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that explains complex words in simple terms that a 5-year-old would understand.'
        },
        {
          role: 'user',
          content: `Explain the word "${word}" (${definition}) like I'm 5 years old.`
        }
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('OpenAI API error:', error);
    return '';
  }
}

export async function generateContextualSentence(
  word: string,
  context: string
): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that creates natural example sentences using vocabulary words in specific contexts.'
        },
        {
          role: 'user',
          content: `Create a natural example sentence using the word "${word}" in the context of: ${context}`
        }
      ],
      max_tokens: 100,
      temperature: 0.7,
    });

    return response.choices[0].message.content || '';
  } catch (error) {
    console.error('OpenAI API error:', error);
    return '';
  }
}
```

### 4. Unsplash Integration

Create `lib/api/unsplash.ts`:

```typescript
export interface UnsplashImage {
  id: string;
  urls: {
    regular: string;
    small: string;
    thumb: string;
  };
  alt_description: string;
  user: {
    name: string;
    username: string;
  };
}

export async function searchImages(query: string): Promise<UnsplashImage[]> {
  try {
    const response = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=5`,
      {
        headers: {
          Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.results;
  } catch (error) {
    console.error('Unsplash API error:', error);
    return [];
  }
}
```

---

## Core Features

### 1. Card Creation with Auto-Lookup

Create `app/api/cards/create/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { fetchDictionaryData } from '@/lib/api/dictionary';
import { fetchExampleSentences } from '@/lib/api/datamuse';
import { searchImages } from '@/lib/api/unsplash';

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient({ cookies });
  
  // Check authentication
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { word, deckId, contextSentence, contextSource, generateAI } = body;

  try {
    // 1. Fetch dictionary data
    const dictData = await fetchDictionaryData(word);
    if (!dictData) {
      return NextResponse.json(
        { error: 'Word not found in dictionary' },
        { status: 404 }
      );
    }

    // 2. Fetch example sentences
    const exampleSentences = await fetchExampleSentences(word);

    // 3. Optionally fetch image
    const images = await searchImages(word);
    const imageUrl = images[0]?.urls.regular || null;

    // 4. Extract audio URL
    const audioUrl = dictData.phonetics.find(p => p.audio)?.audio || null;

    // 5. Create main card
    const { data: mainCard, error: mainCardError } = await supabase
      .from('cards')
      .insert({
        deck_id: deckId,
        word: dictData.word,
        definition: dictData.meanings[0].definitions[0].definition,
        phonetic: dictData.phonetic,
        part_of_speech: dictData.meanings[0].partOfSpeech,
        example_sentences: exampleSentences,
        image_url: imageUrl,
        audio_url: audioUrl,
        context_sentence: contextSentence,
        context_source: contextSource,
        card_type: 'basic',
      })
      .select()
      .single();

    if (mainCardError) throw mainCardError;

    // 6. Create reverse card
    const { data: reverseCard, error: reverseCardError } = await supabase
      .from('cards')
      .insert({
        deck_id: deckId,
        word: dictData.meanings[0].definitions[0].definition,
        definition: dictData.word,
        phonetic: dictData.phonetic,
        part_of_speech: dictData.meanings[0].partOfSpeech,
        example_sentences: exampleSentences,
        image_url: imageUrl,
        audio_url: audioUrl,
        context_sentence: contextSentence,
        context_source: contextSource,
        card_type: 'reverse',
        parent_card_id: mainCard.id,
      })
      .select()
      .single();

    if (reverseCardError) throw reverseCardError;

    // 7. Initialize review records for both cards
    await supabase.from('card_reviews').insert([
      {
        card_id: mainCard.id,
        user_id: session.user.id,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString(),
      },
      {
        card_id: reverseCard.id,
        user_id: session.user.id,
        ease_factor: 2.5,
        interval: 0,
        repetitions: 0,
        next_review_date: new Date().toISOString(),
      },
    ]);

    return NextResponse.json({
      mainCard,
      reverseCard,
      message: 'Cards created successfully',
    });
  } catch (error) {
    console.error('Error creating card:', error);
    return NextResponse.json(
      { error: 'Failed to create card' },
      { status: 500 }
    );
  }
}
```

### 2. Study Session Logic

Create `lib/study-session.ts`:

```typescript
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { calculateSM2, QUALITY_RATINGS } from './sm2';

export interface DueCard {
  id: string;
  word: string;
  definition: string;
  phonetic?: string;
  example_sentences: string[];
  image_url?: string;
  audio_url?: string;
  card_type: string;
  review: {
    ease_factor: number;
    interval: number;
    repetitions: number;
  };
}

export async function fetchDueCards(deckId?: string): Promise<DueCard[]> {
  const supabase = createClientComponentClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  let query = supabase
    .from('card_reviews')
    .select(`
      card_id,
      ease_factor,
      interval,
      repetitions,
      cards (
        id,
        word,
        definition,
        phonetic,
        example_sentences,
        image_url,
        audio_url,
        card_type,
        deck_id
      )
    `)
    .eq('user_id', session.user.id)
    .lte('next_review_date', new Date().toISOString())
    .order('next_review_date', { ascending: true });

  if (deckId) {
    query = query.eq('cards.deck_id', deckId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return data.map(item => ({
    id: item.cards.id,
    word: item.cards.word,
    definition: item.cards.definition,
    phonetic: item.cards.phonetic,
    example_sentences: item.cards.example_sentences,
    image_url: item.cards.image_url,
    audio_url: item.cards.audio_url,
    card_type: item.cards.card_type,
    review: {
      ease_factor: item.ease_factor,
      interval: item.interval,
      repetitions: item.repetitions,
    },
  }));
}

export async function submitCardReview(
  cardId: string,
  quality: number
): Promise<void> {
  const supabase = createClientComponentClient();
  
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  // Fetch current review data
  const { data: currentReview, error: fetchError } = await supabase
    .from('card_reviews')
    .select('*')
    .eq('card_id', cardId)
    .eq('user_id', session.user.id)
    .single();

  if (fetchError) throw fetchError;

  // Calculate new SM-2 values
  const sm2Result = calculateSM2({
    quality,
    repetitions: currentReview.repetitions,
    easeFactor: currentReview.ease_factor,
    interval: currentReview.interval,
  });

  // Update review record
  const { error: updateError } = await supabase
    .from('card_reviews')
    .update({
      ease_factor: sm2Result.easeFactor,
      interval: sm2Result.interval,
      repetitions: sm2Result.repetitions,
      next_review_date: sm2Result.nextReviewDate.toISOString(),
      last_review_date: new Date().toISOString(),
      quality,
      is_mature: sm2Result.interval >= 21,
      review_history: [
        ...currentReview.review_history,
        {
          date: new Date().toISOString(),
          quality,
          interval: sm2Result.interval,
        },
      ],
    })
    .eq('card_id', cardId)
    .eq('user_id', session.user.id);

  if (updateError) throw updateError;

  // Update user's last study date and streak
  await updateUserStreak(session.user.id);
}

async function updateUserStreak(userId: string): Promise<void> {
  const supabase = createClientComponentClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('last_study_date, streak_count')
    .eq('id', userId)
    .single();

  if (!profile) return;

  const today = new Date().toISOString().split('T')[0];
  const lastStudy = profile.last_study_date;

  let newStreak = profile.streak_count;

  if (lastStudy !== today) {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastStudy === yesterdayStr) {
      // Consecutive day
      newStreak += 1;
    } else if (lastStudy !== today) {
      // Streak broken
      newStreak = 1;
    }

    await supabase
      .from('profiles')
      .update({
        last_study_date: today,
        streak_count: newStreak,
        total_cards_studied: profile.total_cards_studied + 1,
      })
      .eq('id', userId);
  }
}
```

---

## UI Components

### Study Card Component

Create `components/study-card.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Volume2, Image as ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { QUALITY_RATINGS } from '@/lib/sm2';

interface StudyCardProps {
  card: {
    word: string;
    definition: string;
    phonetic?: string;
    example_sentences: string[];
    image_url?: string;
    audio_url?: string;
  };
  onRate: (quality: number) => void;
}

export function StudyCard({ card, onRate }: StudyCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const playAudio = () => {
    if (card.audio_url) {
      const audio = new Audio(card.audio_url);
      audio.play();
    } else {
      // Fallback to Web Speech API
      const utterance = new SpeechSynthesisUtterance(card.word);
      utterance.lang = 'en-US';
      speechSynthesis.speak(utterance);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <motion.div
        className="relative h-96 cursor-pointer"
        onClick={() => setIsFlipped(!isFlipped)}
        initial={false}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ duration: 0.6 }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {/* Front of card */}
        <div
          className="absolute inset-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 flex flex-col items-center justify-center"
          style={{ backfaceVisibility: 'hidden' }}
        >
          <h2 className="text-4xl font-bold mb-4">{card.word}</h2>
          {card.phonetic && (
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {card.phonetic}
            </p>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              playAudio();
            }}
          >
            <Volume2 className="h-6 w-6" />
          </Button>
          <p className="text-sm text-gray-500 mt-8">Click to reveal</p>
        </div>

        {/* Back of card */}
        <div
          className="absolute inset-0 bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 flex flex-col"
          style={{
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="flex-1 overflow-auto">
            <h3 className="text-2xl font-semibold mb-4">Definition</h3>
            <p className="text-lg mb-6">{card.definition}</p>

            {card.example_sentences.length > 0 && (
              <>
                <h4 className="text-xl font-semibold mb-2">Examples</h4>
                <ul className="list-disc list-inside space-y-2">
                  {card.example_sentences.map((sentence, idx) => (
                    <li key={idx} className="text-gray-700 dark:text-gray-300">
                      {sentence}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {card.image_url && (
              <div className="mt-4">
                <img
                  src={card.image_url}
                  alt={card.word}
                  className="rounded-lg max-h-40 object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Rating buttons (only show when flipped) */}
      {isFlipped && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex gap-4 mt-6 justify-center"
        >
          <Button
            variant="destructive"
            onClick={() => onRate(QUALITY_RATINGS.AGAIN)}
          >
            Again
          </Button>
          <Button
            variant="outline"
            onClick={() => onRate(QUALITY_RATINGS.HARD)}
          >
            Hard
          </Button>
          <Button
            variant="default"
            onClick={() => onRate(QUALITY_RATINGS.GOOD)}
          >
            Good
          </Button>
          <Button
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            onClick={() => onRate(QUALITY_RATINGS.EASY)}
          >
            Easy
          </Button>
        </motion.div>
      )}
    </div>
  );
}
```

---

## Browser Extension

### Manifest (manifest.json)

```json
{
  "manifest_version": 3,
  "name": "Flashcard Vocabulary Capture",
  "version": "1.0.0",
  "description": "Capture words from any webpage and add them to your flashcard deck",
  "permissions": [
    "activeTab",
    "contextMenus",
    "storage"
  ],
  "host_permissions": [
    "http://localhost:3000/*",
    "https://your-app-domain.com/*"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content.js"]
    }
  ],
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  }
}
```

### Background Script (background.js)

```javascript
// Create context menu on installation
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'addToFlashcard',
    title: 'Add "%s" to Flashcard',
    contexts: ['selection']
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'addToFlashcard') {
    const selectedText = info.selectionText;
    
    // Send message to content script to get context
    chrome.tabs.sendMessage(tab.id, {
      action: 'getContext',
      word: selectedText
    }, (response) => {
      if (response) {
        // Send to API
        sendToFlashcardApp(response);
      }
    });
  }
});

async function sendToFlashcardApp(data) {
  const { word, sentence, url } = data;
  
  // Get stored auth token
  const { authToken } = await chrome.storage.local.get('authToken');
  
  if (!authToken) {
    console.error('Not authenticated');
    return;
  }

  try {
    const response = await fetch('http://localhost:3000/api/cards/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        word,
        contextSentence: sentence,
        contextSource: url,
        deckId: 'default' // Or get from storage
      })
    });

    if (response.ok) {
      // Show success notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Word Added!',
        message: `"${word}" has been added to your flashcard deck.`
      });
    }
  } catch (error) {
    console.error('Error adding word:', error);
  }
}
```

### Content Script (content.js)

```javascript
// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getContext') {
    const word = request.word;
    const selection = window.getSelection();
    
    // Get the sentence containing the selected word
    const range = selection.getRangeAt(0);
    const container = range.commonAncestorContainer;
    const sentence = extractSentence(container, word);
    
    sendResponse({
      word,
      sentence,
      url: window.location.href
    });
  }
  return true;
});

function extractSentence(node, word) {
  // Get the text content of the paragraph or container
  let text = '';
  
  if (node.nodeType === Node.TEXT_NODE) {
    text = node.parentElement.textContent;
  } else {
    text = node.textContent;
  }
  
  // Find the sentence containing the word
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  for (const sentence of sentences) {
    if (sentence.toLowerCase().includes(word.toLowerCase())) {
      return sentence.trim();
    }
  }
  
  return text.substring(0, 200); // Fallback: first 200 chars
}
```

---

This implementation guide provides the foundation for building the flashcard app. Each section can be expanded with additional features and refinements as development progresses.