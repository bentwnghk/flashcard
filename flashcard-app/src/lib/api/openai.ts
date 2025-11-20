import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
});

export async function generateMnemonic(word: string, definition: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
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
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
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
      model: process.env.OPENAI_MODEL || 'gpt-5-mini',
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