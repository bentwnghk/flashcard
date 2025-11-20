'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { fetchDictionaryData } from '@/lib/api/dictionary';
import { fetchExampleSentences } from '@/lib/api/datamuse';
import { searchImages } from '@/lib/api/unsplash';

export default function CreateCard() {
  const [word, setWord] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dictionaryData, setDictionaryData] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);

  const handleWordLookup = async () => {
    if (!word.trim()) return;

    setIsLoading(true);
    try {
      // Fetch dictionary data
      const dictData = await fetchDictionaryData(word);
      setDictionaryData(dictData);

      // Fetch example sentences
      const sentences = await fetchExampleSentences(word);
      
      // Fetch images
      const imageResults = await searchImages(word);
      setImages(imageResults);
    } catch (error) {
      console.error('Error fetching word data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Create New Card</h1>
        <p className="text-muted-foreground">
          Enter a word and we'll automatically fetch definitions, examples, and images.
        </p>
      </div>

      <div className="bg-card p-6 rounded-lg border">
        <div className="space-y-6">
          {/* Word Input */}
          <div>
            <label htmlFor="word" className="block text-sm font-medium mb-2">
              Word
            </label>
            <div className="flex gap-2">
              <Input
                id="word"
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                placeholder="Enter a word..."
                className="flex-1"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleWordLookup();
                  }
                }}
              />
              <Button 
                onClick={handleWordLookup}
                disabled={isLoading || !word.trim()}
              >
                {isLoading ? 'Loading...' : 'Lookup'}
              </Button>
            </div>
          </div>

          {/* Dictionary Results */}
          {dictionaryData && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <h3 className="text-lg font-semibold mb-2">Dictionary Results</h3>
              
              {dictionaryData.phonetic && (
                <div className="mb-2">
                  <span className="text-sm text-muted-foreground">Phonetic:</span>
                  <span className="ml-2">{dictionaryData.phonetic}</span>
                </div>
              )}

              {dictionaryData.meanings?.map((meaning: any, index: number) => (
                <div key={index} className="mb-4">
                  <h4 className="font-medium text-primary">{meaning.partOfSpeech}</h4>
                  <ul className="space-y-2 mt-2">
                    {meaning.definitions?.slice(0, 2).map((def: any, defIndex: number) => (
                      <li key={defIndex} className="text-sm">
                        <p className="font-medium">Definition {defIndex + 1}:</p>
                        <p>{def.definition}</p>
                        {def.example && (
                          <p className="text-muted-foreground italic mt-1">Example: {def.example}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          {/* Image Results */}
          {images.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold mb-2">Images</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {images.slice(0, 6).map((image: any, index: number) => (
                  <div key={index} className="relative group">
                    <img
                      src={image.urls.small}
                      alt={image.alt_description}
                      className="w-full h-32 object-cover rounded-lg border"
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all rounded-lg flex items-center justify-center">
                      <p className="text-white text-xs text-center p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {image.user.name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => setWord('')}>
            Clear
          </Button>
          <Button 
            onClick={() => {
              // TODO: Save card to database
              console.log('Saving card:', { word, dictionaryData, images });
            }}
            disabled={!dictionaryData}
          >
            Create Card
          </Button>
        </div>
      </div>
    </div>
  );
}