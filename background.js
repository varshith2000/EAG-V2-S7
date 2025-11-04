// Background service worker - manages Gemini 3072D embeddings
let memoryManager;
let embeddingService;

// Initialize on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Background service worker starting...');
  await initializeComponents();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed:', details.reason);
  if (details.reason === 'install') {
    await initializeComponents();

    try {
      chrome.storage.local.set({
        webMemoryIndex: [],
        visitedPages: {},
        settings: {
          autoEmbed: true,
          excludedSites: ['gmail.com', 'web.whatsapp.com', 'facebook.com'],
          embeddingModel: 'gemini-embedding-001'
        },
        embeddingSettings: {
          embeddingProvider: 'gemini',
          apiKey: '',
          model: 'gemini-embedding-001',
          dimensions: 3072
        }
      }, () => {
        console.log('✅ Initial 3072D storage setup completed');
      });
    } catch (error) {
      console.error('Failed to initialize 3072D storage:', error);
    }
  }
});

async function initializeComponents() {
  try {
    console.log('🚀 Initializing 3072D Gemini components...');

    embeddingService = createEmbeddingService();

    memoryManager = {
      embeddingService,
      memories: [],
      embeddings: [],

      async initialize() {
        console.log('📦 Loading 3072D memories...');
        try {
          const result = await new Promise((resolve) => {
            chrome.storage.local.get(['memories', 'embeddings'], resolve);
          });

          this.memories = (result.memories || []).map((memory, index) => {
            if (memory.embedding && Array.isArray(memory.embedding)) {
              memory.embedding = new Float32Array(memory.embedding);
            }
            return memory;
          });

          this.embeddings = (result.embeddings || []).map((e, index) => ({
            id: e.id,
            embedding: new Float32Array(e.embedding)
          }));

          console.log(`📊 Loaded ${this.memories.length} memories and ${this.embeddings.length} 3072D embeddings`);
        } catch (error) {
          console.error('Failed to load 3072D data:', error);
          this.memories = [];
          this.embeddings = [];
        }
      },

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
          console.log('🧠 Generating 3072D Gemini embedding...');
          memory.embedding = await this.embeddingService.getEmbedding(memoryData.content);
          
          this.memories.push(memory);
          this.embeddings.push({ id, embedding: memory.embedding });
          
          await this.saveToStorage();
          console.log('✅ 3072D memory added:', id);
          return memory;
        } catch (error) {
          console.error('❌ 3072D embedding failed:', error);
          throw error;
        }
      },

      async search(query, options = {}) {
        const { limit = 10, type = null, minScore = 0.12 } = options;

        try {
          console.log(`🔍 3072D search for: "${query}" (${this.memories.length} memories)`);
          
          const queryEmbedding = await this.embeddingService.getEmbedding(query);
          console.log(`📏 Query embedding: ${queryEmbedding.length} dimensions`);

          const results = [];

          for (const memory of this.memories) {
            if (type && memory.type !== type) continue;

            const memoryEmbedding = this.embeddings.find(e => e.id === memory.id);
            if (!memoryEmbedding?.embedding || memoryEmbedding.embedding.length !== 3072) continue;

            const similarity = this.cosineSimilarity(queryEmbedding, memoryEmbedding.embedding);
            
            if (similarity >= minScore) {
              results.push({ ...memory, score: similarity, matchType: 'gemini-3072d' });
            }
          }

          results.sort((a, b) => b.score - a.score);
          console.log(`🎯 Found ${results.length} 3072D matches`);
          return results.slice(0, limit);

        } catch (error) {
          console.error('❌ 3072D search error:', error);
          return [];
        }
      },

      cosineSimilarity(vecA, vecB) {
        if (vecA.length !== vecB.length) return 0;
        if (vecA.length !== 3072 || vecB.length !== 3072) return 0;

        let dotProduct = 0, normA = 0, normB = 0;
        for (let i = 0; i < 3072; i++) {
          dotProduct += vecA[i] * vecB[i];
          normA += vecA[i] * vecA[i];
          normB += vecB[i] * vecB[i];
        }

        const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
        return magnitude === 0 ? 0 : dotProduct / magnitude;
      },

      async saveToStorage() {
        await new Promise((resolve) => {
          chrome.storage.local.set({
            memories: this.memories.map(m => ({
              ...m,
              embedding: m.embedding ? Array.from(m.embedding) : null
            })),
            embeddings: this.embeddings.map(e => ({
              id: e.id,
              embedding: Array.from(e.embedding)
            }))
          }, resolve);
        });
      },

      generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
      },

      async getSessionId() {
        const result = await new Promise((resolve) => {
          chrome.storage.local.get('sessionId', resolve);
        });
        if (!result.sessionId) {
          const sessionId = this.generateId();
          await new Promise((resolve) => {
            chrome.storage.local.set({ sessionId }, resolve);
          });
          return sessionId;
        }
        return result.sessionId;
      },

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
    };

    await memoryManager.initialize();
    console.log('✅ 3072D components initialized');
  } catch (error) {
    console.error('❌ Failed to initialize 3072D components:', error);
  }
}

// 3072D Gemini Embedding Service
function createEmbeddingService() {
  return {
    currentProvider: 'gemini',
    apiKey: '',
    model: 'gemini-embedding-001',

    async getEmbedding(text) {
      try {
        const settings = await this.getSettings();
        if (!settings.apiKey?.trim()) {
          throw new Error('Gemini API key not configured');
        }
        
        this.apiKey = settings.apiKey;
        this.model = 'gemini-embedding-001';

        return await this.getGemini3072DEmbedding(text);
      } catch (error) {
        console.error('❌ 3072D Gemini embedding failed:', error);
        throw error;
      }
    },

    async getSettings() {
      const result = await new Promise((resolve) => {
        chrome.storage.local.get('embeddingSettings', resolve);
      });
      return result.embeddingSettings || {
        embeddingProvider: 'gemini',
        apiKey: '',
        model: 'gemini-embedding-001'
      };
    },

    async getGemini3072DEmbedding(text) {
      if (!this.apiKey) throw new Error('API key missing');

      // Chunk large texts
      const estimatedSize = new Blob([text]).size;
      if (estimatedSize > 35000) {
        return await this.getChunked3072DEmbedding(text);
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${this.apiKey}`, 
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gemini-embedding-001',
            content: { parts: [{ text: text }] }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini 3072D error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      if (result.embedding?.values) {
        const embedding = new Float32Array(result.embedding.values);
        console.log(`✅ 3072D embedding: ${embedding.length} dimensions`);
        return embedding;
      }
      throw new Error('No embedding values');
    },

    async getChunked3072DEmbedding(text) {
      const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
      const chunks = [];
      let currentChunk = '';

      for (const sentence of sentences) {
        const testChunk = currentChunk + sentence + '. ';
        if (new Blob([testChunk]).size > 30000 && currentChunk.length > 100) {
          chunks.push(currentChunk.trim());
          currentChunk = sentence + '. ';
        } else {
          currentChunk = testChunk;
        }
      }

      if (currentChunk.trim().length > 50) {
        chunks.push(currentChunk.trim());
      }

      const chunkEmbeddings = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkEmbedding = await this.getGemini3072DEmbedding(chunks[i]);
        chunkEmbeddings.push(chunkEmbedding);
      }

      return this.average3072DEmbeddings(chunkEmbeddings);
    },

    average3072DEmbeddings(embeddings) {
      if (embeddings.length === 0) return null;
      if (embeddings.length === 1) return embeddings[0];

      const averaged = new Float32Array(3072);
      for (let i = 0; i < 3072; i++) {
        let sum = 0;
        for (const embedding of embeddings) {
          sum += embedding[i];
        }
        averaged[i] = sum / embeddings.length;
      }
      return averaged;
    },

    async updateSettings(settings) {
      await new Promise((resolve) => {
        chrome.storage.local.set({ embeddingSettings: settings }, resolve);
      });
      this.apiKey = settings.apiKey;
      console.log('🎯 3072D settings updated');
    }
  };
}

// Message handlers

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  (async () => {

    try {

      switch (message.type) {

        case 'SEARCH_QUERY':

          const results = await handleSearch(message.query);

          sendResponse({ results });

          break;

        case 'EMBED_PAGE':

          const embedResult = await handleEmbedPage(message.data);

          sendResponse(embedResult);

          break;



        case 'UPDATE_EMBEDDING_SETTINGS':

          await updateEmbeddingSettings(message.settings);

          sendResponse({ success: true });

          break;



        case 'GET_MEMORY_STATS':

          if (!memoryManager) await initializeComponents();

          const stats = memoryManager ? await memoryManager.getStats() : { totalMemories: 0, typeStats: {} };

          sendResponse({ stats });

          break;



        default:

          sendResponse({ success: false, error: 'Unknown message type' });

      }

    } catch (error) {

      console.error('Message error:', error);

      sendResponse({ success: false, error: error.message });

    }

  })();

  return true;

});



async function handleEmbedPage(data) {

  try {

    if (!memoryManager) {

      await initializeComponents();

    }

    if (!memoryManager) {

      return { success: false, error: 'Memory manager not initialized' };

    }



    const memoryData = {

      type: 'web_page',

      content: data.content,

      metadata: {

        url: data.url,

        title: data.title,

        ...data.metadata

      }

    };



    await memoryManager.addMemory(memoryData);

    return { success: true };

  } catch (error) {

    console.error('❌ Page embedding error:', error);

    return { success: false, error: error.message };

  }

}

async function handleSearch(query) {
  try {
    if (!memoryManager) await initializeComponents();
    if (!memoryManager) return [];

    const results = await memoryManager.search(query, { 
      limit: 10, 
      type: 'web_page',
      minScore: 0.12
    });

    return results.map(result => ({
      id: result.id,
      url: result.metadata.url,
      title: result.metadata.title || 'Untitled',
      snippet: result.content ? result.content.substring(0, 200) + '...' : 'No content',
      score: result.score || 0,
      timestamp: result.metadata.timestamp,
      matchType: 'gemini-3072d'
    }));

  } catch (error) {
    console.error('❌ 3072D search error:', error);
    return [];
  }
}

async function updateEmbeddingSettings(settings) {
  try {
    if (memoryManager?.embeddingService) {
      await memoryManager.embeddingService.updateSettings(settings);
      console.log('✅ 3072D settings updated in background');
    }
  } catch (error) {
    console.error('Failed to update 3072D settings:', error);
  }
}

// Add this AFTER the message handlers in background.js

// AUTO-INDEXING: Fix webNavigation listener
if (chrome.webNavigation?.onCompleted) {
  chrome.webNavigation.onCompleted.addListener(async (details) => {
    // Only process main frame
    if (details.frameId !== 0) return;

    try {
      const url = new URL(details.url);
      
      // Skip invalid protocols
      const invalidProtocols = ['chrome:', 'chrome-extension:', 'moz-extension:', 'about:', 'file:'];
      if (invalidProtocols.includes(url.protocol)) return;

      // Skip excluded sites
      const excludedPatterns = [
        'mail.google.com', 'web.whatsapp.com', 'facebook.com', 'instagram.com', 'twitter.com',
        'accounts.google.com', 'login.', '.login.', 'signin.', '.signin.', 'gmail.com', 'outlook.com'
      ];

      const isExcluded = excludedPatterns.some(pattern => 
        url.hostname.includes(pattern) || url.href.includes(pattern)
      );
      
      if (isExcluded) {
        console.log(`⏭️ Skipped excluded site: ${url.hostname}`);
        return;
      }

      console.log(`🔄 Auto-indexing: ${url.href}`);

      // Wait for page to fully load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Inject page processor
      await chrome.scripting.executeScript({
        target: { tabId: details.tabId },
        files: ['page-processor.js']
      });

      console.log(`✅ Auto-indexing triggered for: ${url.href}`);

    } catch (error) {
      console.error('❌ Auto-indexing failed:', error);
    }
  }, {
    url: [
      { urlMatches: 'https://*/*' },
      { urlMatches: 'http://*/*' }
    ]
  });
}

// MANUAL INDEXING: Enhanced current page indexing
async function indexCurrentPage(tabId) {
  try {
    console.log('🔄 Manual indexing current tab:', tabId);

    const tab = await chrome.tabs.get(tabId);
    if (!tab?.url) throw new Error('Invalid tab');

    const url = new URL(tab.url);
    const invalidProtocols = ['chrome:', 'chrome-extension:', 'moz-extension:', 'about:'];
    if (invalidProtocols.includes(url.protocol)) {
      throw new Error('Cannot index browser pages');
    }

    // Check excluded sites
    const excludedPatterns = [
      'mail.google.com', 'web.whatsapp.com', 'facebook.com', 'instagram.com', 'twitter.com',
      'accounts.google.com', 'login.', '.login.', 'signin.', '.signin.'
    ];

    const isExcluded = excludedPatterns.some(pattern => url.hostname.includes(pattern));
    if (isExcluded) {
      throw new Error('Site is excluded from indexing');
    }

    // Inject page processor
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['page-processor.js']
    });

    console.log('✅ Page processor injected for manual indexing');

  } catch (error) {
    console.error('❌ Manual indexing error:', error);
    throw error;
  }
}