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