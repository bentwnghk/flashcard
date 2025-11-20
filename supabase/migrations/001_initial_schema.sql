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

-- Function to create user profile automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();