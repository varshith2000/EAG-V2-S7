// Memory Manager - 3072D Gemini embedding functionality
export class MemoryManager {
  constructor() {
    this.embeddings = [];
    this.memories = [];
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      const result = await chrome.storage.local.get(['memories', 'embeddings']);
      
      this.memories = (result.memories || []).map(m => ({
        ...m,
        embedding: m.embedding ? new Float32Array(m.embedding) : null
      }));

      this.embeddings = (result.embeddings || []).map(e => ({
        id: e.id,
        embedding: new Float32Array(e.embedding)
      }));

      console.log(`📦 MemoryManager: Loaded ${this.memories.length} memories, ${this.embeddings.length} 3072D embeddings`);
      this.isInitialized = true;
    } catch (error) {
      console.error('❌ Failed to initialize 3072D MemoryManager:', error);
      throw error;
    }
  }

  async addMemory(memoryData) {
    const id = this.generateId();
    const timestamp = Date.now();

    const memory = {
      id,
      type: memoryData.type || 'general',
      content: memoryData.content,
      metadata: {
        ...memoryData.metadata,
        timestamp,
        sessionId: await this.getSessionId()
      },
      tags: memoryData.tags || [],
      embedding: null
    };

    try {
      // Generate 3072D Gemini embedding
      const embeddingService = this.getEmbeddingService();
      memory.embedding = await embeddingService.getEmbedding(memoryData.content);

      this.memories.push(memory);
      this.embeddings.push({ id, embedding: memory.embedding });
      
      await this.saveToStorage();
      console.log(`✅ 3072D memory added: ${id}`);
      return memory;
    } catch (error) {
      console.error('❌ 3072D embedding failed:', error);
      throw error;
    }
  }

  async search(query, options = {}) {
    const { limit = 10, type = null, minScore = 0.12 } = options;

    try {
      const embeddingService = this.getEmbeddingService();
      const queryEmbedding = await embeddingService.getEmbedding(query);
      
      console.log(`🔍 3072D search: "${query}" (${queryEmbedding.length}D)`);

      const results = [];
      
      for (const memory of this.memories) {
        if (type && memory.type !== type) continue;

        const memoryEmbedding = this.embeddings.find(e => e.id === memory.id);
        if (!memoryEmbedding?.embedding || memoryEmbedding.embedding.length !== 3072) {
          continue;
        }

        const similarity = this.cosineSimilarity(queryEmbedding, memoryEmbedding.embedding);
        
        if (similarity >= minScore) {
          results.push({ ...memory, score: similarity, matchType: 'gemini-3072d' });
        }
      }

      results.sort((a, b) => b.score - a.score);
      console.log(`🎯 3072D search: ${results.length} results`);
      return results.slice(0, limit);

    } catch (error) {
      console.error('❌ 3072D search error:', error);
      return [];
    }
  }

  cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length || vecA.length !== 3072) return 0;

    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < 3072; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  getEmbeddingService() {
    // Return the background script's embedding service
    if (typeof window !== 'undefined' && window.embeddingService) {
      return window.embeddingService;
    }
    
    // Fallback for testing
    return {
      getEmbedding: async (text) => {
        // This should be replaced with actual background service
        return new Float32Array(3072).map(() => Math.random());
      }
    };
  }

  async saveToStorage() {
    await chrome.storage.local.set({
      memories: this.memories.map(m => ({
        ...m,
        embedding: m.embedding ? Array.from(m.embedding) : null
      })),
      embeddings: this.embeddings.map(e => ({
        id: e.id,
        embedding: Array.from(e.embedding)
      }))
    });
  }

  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async getSessionId() {
    const result = await chrome.storage.local.get('sessionId');
    if (!result.sessionId) {
      const sessionId = this.generateId();
      await chrome.storage.local.set({ sessionId });
      return sessionId;
    }
    return result.sessionId;
  }

  async getStats() {
    const typeStats = {};
    this.memories.forEach(memory => {
      typeStats[memory.type] = (typeStats[memory.type] || 0) + 1;
    });

    return {
      totalMemories: this.memories.length,
      typeStats,
      lastUpdated: Date.now()
    };
  }
}