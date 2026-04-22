import { LocalIndex } from 'vectra';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const index = new LocalIndex(path.join(__dirname, '..', 'vector_store'));

export interface MemoryItem {
  id: string;
  type: 'path' | 'preference';
  key?: string;
  content: string;
}

export async function initVectorDB() {
  if (!await index.isIndexCreated()) {
    await index.createIndex();
    
    // Seed initial data
    const initialItems: MemoryItem[] = [
      { id: 'p1', type: 'path', key: 'python scripts', content: '/Users/admin/projects/python_scripts' },
      { id: 'p2', type: 'path', key: 'downloads', content: '/Users/admin/Downloads' },
      { id: 'p3', type: 'path', key: 'documents', content: '/Users/admin/Documents' },
      { id: 'p4', type: 'path', key: 'project alpha', content: '/Users/admin/projects/alpha' },
      { id: 'p5', type: 'path', key: 'ssh keys', content: '/Users/admin/.ssh' },
      { id: 'p6', type: 'path', key: 'system logs', content: '/var/log' },
      { id: 'pref1', type: 'preference', content: 'Always use absolute paths when moving files.' },
      { id: 'pref2', type: 'preference', content: 'Prefer non-destructive commands like cp over mv when unsure.' },
      { id: 'pref3', type: 'preference', content: 'Python environment is usually in .venv or venv folders.' },
      { id: 'pref4', type: 'preference', content: 'Never delete files without user confirmation.' }
    ];

    for (const item of initialItems) {
      await storeMemory(item.content, item.type, item.key, item.id);
    }
  }
}

export async function storeMemory(content: string, type: 'path' | 'preference', key?: string, id?: string) {
  const textToEmbed = type === 'path' ? `Path to ${key}: ${content}` : `Preference: ${content}`;
  
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: textToEmbed,
  });

  if (result.embeddings && result.embeddings.length > 0) {
    const vector = result.embeddings[0].values;
    if (vector) {
      await index.insertItem({
        id: id || `mem_${Date.now()}`,
        vector,
        metadata: { type, key, content, textToEmbed }
      });
    }
  }
}

export async function retrieveContext(query: string) {
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: query,
  });

  if (result.embeddings && result.embeddings.length > 0) {
    const vector = result.embeddings[0].values;
    if (vector) {
      const results = await index.queryItems(vector, query, 4);
      return results.map(r => ({
        id: r.item.id,
        type: r.item.metadata.type,
        key: r.item.metadata.key,
        content: r.item.metadata.content,
        confidence: r.score
      }));
    }
  }
  return [];
}
