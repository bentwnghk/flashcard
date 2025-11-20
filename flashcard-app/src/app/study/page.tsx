'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { calculateSM2, QUALITY_RATINGS } from '@/lib/sm2';

// Mock card data for demo
const mockCards = [
  {
    id: '1',
    word: 'Serendipity',
    definition: 'The occurrence and development of events by chance in a happy or beneficial way',
    phonetic: '/ˌser.ənˈdɪp.ə.ti/',
    partOfSpeech: 'noun',
    example_sentences: [
      'A fortunate stroke of serendipity brought the two friends together.',
      'The discovery was pure serendipity, not the result of a planned search.'
    ]
  },
  {
    id: '2',
    word: 'Ephemeral',
    definition: 'Lasting for a very short time',
    phonetic: '/ɪˈfem.ər.əl/',
    partOfSpeech: 'adjective',
    example_sentences: [
      'The beauty of cherry blossoms is ephemeral.',
      'Fame can be ephemeral, but true art lasts forever.'
    ]
  }
];

export default function StudySession() {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [studyStats, setStudyStats] = useState({
    cardsStudied: 0,
    correctAnswers: 0,
    startTime: new Date()
  });

  const currentCard = mockCards[currentCardIndex];

  const handleRate = (quality: number) => {
    // Calculate SM-2 values (in real app, this would save to database)
    const sm2Result = calculateSM2({
      quality,
      repetitions: 0, // In real app, fetch from database
      easeFactor: 2.5,
      interval: 0
    });

    console.log('SM-2 Result:', sm2Result);

    // Update stats
    setStudyStats(prev => ({
      ...prev,
      cardsStudied: prev.cardsStudied + 1,
      correctAnswers: quality >= 3 ? prev.correctAnswers + 1 : prev.correctAnswers
    }));

    // Move to next card
    moveToNextCard();
  };

  const moveToNextCard = () => {
    if (currentCardIndex < mockCards.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };

  const moveToPreviousCard = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  const handleFlip = () => {
    setIsFlipped(!isFlipped);
  };

  const playAudio = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return; // Don't trigger when typing in inputs
      }

      switch (e.key) {
        case ' ':
        e.preventDefault();
          handleFlip();
          break;
        case '1':
          e.preventDefault();
          handleRate(QUALITY_RATINGS.AGAIN);
          break;
        case '2':
          e.preventDefault();
          handleRate(QUALITY_RATINGS.HARD);
          break;
        case '3':
          e.preventDefault();
          handleRate(QUALITY_RATINGS.GOOD);
          break;
        case '4':
          e.preventDefault();
          handleRate(QUALITY_RATINGS.EASY);
          break;
        case 'ArrowLeft':
          e.preventDefault();
          moveToPreviousCard();
          break;
        case 'ArrowRight':
          e.preventDefault();
          moveToNextCard();
          break;
        case 'p':
          e.preventDefault();
          if (currentCard) {
            playAudio(currentCard.word);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [currentCardIndex, isFlipped, currentCard]);

  if (!currentCard) {
    return <div className="flex items-center justify-center min-h-screen">
      <p className="text-xl">No cards to study!</p>
    </div>;
  }

  const accuracy = studyStats.cardsStudied > 0 
    ? Math.round((studyStats.correctAnswers / studyStats.cardsStudied) * 100)
    : 0;

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center">
        <h1 className="text-3xl font-bold">Study Session</h1>
        <div className="text-sm text-muted-foreground">
          Card {currentCardIndex + 1} of {mockCards.length}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="bg-card p-4 rounded-lg border text-center">
          <div className="text-2xl font-bold text-primary">{studyStats.cardsStudied}</div>
          <div className="text-sm text-muted-foreground">Cards Studied</div>
        </div>
        <div className="bg-card p-4 rounded-lg border text-center">
          <div className="text-2xl font-bold text-green-600">{accuracy}%</div>
          <div className="text-sm text-muted-foreground">Accuracy</div>
        </div>
        <div className="bg-card p-4 rounded-lg border text-center">
          <div className="text-2xl font-bold text-blue-600">
            {Math.round((new Date().getTime() - studyStats.startTime.getTime()) / 60000)}m
          </div>
          <div className="text-sm text-muted-foreground">Time</div>
        </div>
      </div>

      {/* Flashcard */}
      <div className="flex justify-center mb-8">
        <div 
          className="relative w-full max-w-2xl h-96 cursor-pointer transform transition-transform duration-500 hover:scale-105"
          onClick={handleFlip}
          style={{ transform: `rotateY(${isFlipped ? 180 : 0}deg)` }}
        >
          {/* Front of card */}
          <div 
            className="absolute inset-0 w-full h-full bg-card border rounded-lg shadow-xl flex flex-col items-center justify-center p-8 backface-hidden"
            style={{ backfaceVisibility: 'hidden' }}
          >
            <div className="text-center">
              <h2 className="text-4xl font-bold mb-4">{currentCard.word}</h2>
              {currentCard.phonetic && (
                <p className="text-lg text-muted-foreground mb-4">{currentCard.phonetic}</p>
              )}
              <div className="flex gap-2 justify-center">
                <Button variant="outline" size="sm" onClick={(e) => {
                  e.stopPropagation();
                  playAudio(currentCard.word);
                }}>
                  🔊 Audio
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-4">Click to reveal</p>
            </div>
          </div>

          {/* Back of card */}
          <div 
            className="absolute inset-0 w-full h-full bg-card border rounded-lg shadow-xl flex flex-col p-8 backface-hidden"
            style={{ 
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)'
            }}
          >
            <div className="h-full overflow-auto">
              <h3 className="text-xl font-semibold mb-4 text-primary">Definition</h3>
              <p className="text-lg mb-6">{currentCard.definition}</p>
              
              {currentCard.partOfSpeech && (
                <p className="text-sm text-muted-foreground mb-4">
                  <strong>Part of Speech:</strong> {currentCard.partOfSpeech}
                </p>
              )}

              {currentCard.example_sentences?.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Examples:</h4>
                  <ul className="space-y-2">
                    {currentCard.example_sentences.map((sentence, index) => (
                      <li key={index} className="text-sm italic">
                        {sentence}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rating Buttons */}
      {isFlipped && (
        <div className="flex justify-center gap-4 animate-fade-in">
          <Button 
            onClick={() => handleRate(QUALITY_RATINGS.AGAIN)}
            variant="destructive"
            size="lg"
          >
            Again (1)
          </Button>
          <Button 
            onClick={() => handleRate(QUALITY_RATINGS.HARD)}
            variant="outline"
            size="lg"
          >
            Hard (2)
          </Button>
          <Button 
            onClick={() => handleRate(QUALITY_RATINGS.GOOD)}
            variant="default"
            size="lg"
          >
            Good (3)
          </Button>
          <Button 
            onClick={() => handleRate(QUALITY_RATINGS.EASY)}
            variant="default"
            className="bg-green-600 hover:bg-green-700"
            size="lg"
          >
            Easy (4)
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <Button 
          onClick={moveToPreviousCard}
          disabled={currentCardIndex === 0}
          variant="outline"
        >
          ← Previous
        </Button>
        
        <div className="text-sm text-muted-foreground">
          Keyboard shortcuts: Space (flip), 1-4 (rate), ← → (navigate)
        </div>

        <Button 
          onClick={moveToNextCard}
          disabled={currentCardIndex === mockCards.length - 1}
          variant="outline"
        >
          Next →
        </Button>
      </div>
    </div>
  );
}