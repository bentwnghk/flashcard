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