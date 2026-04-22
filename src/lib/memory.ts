export interface MemoryResult {
  id: string;
  type: 'path' | 'preference';
  key?: string;
  content: string;
  confidence: number;
}

export class LocalMemoryCore {
  public async storeMemory(content: string, type: 'path' | 'preference', key?: string) {
    try {
      await fetch("/api/memory/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, type, key }),
      });
    } catch (e) {
      console.error("Failed to store memory:", e);
    }
  }

  public async retrieveContext(query: string): Promise<MemoryResult[]> {
    try {
      const response = await fetch("/api/memory/retrieve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await response.json();
      return data.results || [];
    } catch (e) {
      console.error("Failed to retrieve memory:", e);
      return [];
    }
  }
}

export const memoryCore = new LocalMemoryCore();
