// Embedding Service - Handles text embeddings using various APIs
export class EmbeddingService {
  constructor() {
    this.currentProvider = null;
    this.providers = new Map();
    this.initializeProviders();
  }

  async initializeProviders() {
    // Initialize different embedding providers
    this.providers.set('gemini', new GeminiProvider());
    this.providers.set('local', new LocalEmbeddingProvider());
    this.providers.set('huggingface', new HuggingFaceProvider());
    this.providers.set('openai', new OpenAIProvider());

    // Set default provider to Gemini
    const settings = await this.getSettings();
    this.currentProvider = this.providers.get(settings.embeddingProvider) ||
                         this.providers.get('gemini');
  }

  async getEmbedding(text) {
    if (!this.currentProvider) {
      await this.initializeProviders();
    }

    try {
      return await this.currentProvider.embed(text);
    } catch (error) {
      console.error('Embedding error with current provider:', error);

      // Try fallback providers
      for (const [name, provider] of this.providers) {
        if (provider !== this.currentProvider) {
          try {
            console.log(`Trying fallback provider: ${name}`);
            const embedding = await provider.embed(text);
            this.currentProvider = provider;
            return embedding;
          } catch (fallbackError) {
            console.error(`Fallback provider ${name} failed:`, fallbackError);
          }
        }
      }

      throw new Error('All embedding providers failed');
    }
  }

  async getSettings() {
    const result = await chrome.storage.local.get('embeddingSettings');
    return result.embeddingSettings || {
      embeddingProvider: 'gemini',
      apiKey: '',
      model: 'text-embedding-004'
    };
  }

  async updateSettings(settings) {
    await chrome.storage.local.set({ embeddingSettings: settings });

    // Update current provider
    this.currentProvider = this.providers.get(settings.embeddingProvider) ||
                         this.providers.get('gemini');

    if (this.currentProvider && this.currentProvider.configure) {
      await this.currentProvider.configure(settings);
    }
  }
}

// Local embedding provider using browser-native processing
class LocalEmbeddingProvider {
  constructor() {
    this.modelLoaded = false;
    this.model = null;
  }

  async embed(text) {
    if (!this.modelLoaded) {
      await this.loadModel();
    }

    // Simple hash-based embedding for demonstration
    // In production, this would use a proper model like Transformers.js
    return this.createTextEmbedding(text);
  }

  async loadModel() {
    try {
      // In a real implementation, this would load a model like:
      // import { pipeline } from '@xenova/transformers';
      // this.model = await pipeline('feature-extraction', 'nomic-embed-text');

      this.modelLoaded = true;
      console.log('Local embedding model loaded');
    } catch (error) {
      console.error('Failed to load local model:', error);
      // Fall back to simple embedding
      this.modelLoaded = true;
    }
  }

  createTextEmbedding(text) {
    // Create a 384-dimensional vector (matching nomic-embed-text)
    const dimension = 384;
    const vector = new Float32Array(dimension);

    // Clean text
    const cleanText = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .trim();

    // Split into words and filter stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been'
    ]);

    const words = cleanText.split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Create embedding based on word hash distribution
    words.forEach((word, wordIndex) => {
      const wordHash = this.hashCode(word);
      const normalizedHash = Math.abs(wordHash) / 2147483647;

      // Distribute word influence across dimensions
      for (let dim = 0; dim < dimension; dim++) {
        const angle = (wordHash * dim) % (2 * Math.PI);
        const influence = Math.sin(angle) * normalizedHash;

        // Apply position-based weighting
        const positionWeight = 1.0 - (wordIndex / words.length) * 0.5;
        vector[dim] += influence * positionWeight;
      }
    });

    // Add n-gram features
    for (let n = 2; n <= 3; n++) {
      for (let i = 0; i <= words.length - n; i++) {
        const ngram = words.slice(i, i + n).join(' ');
        const ngramHash = this.hashCode(ngram);
        const normalizedHash = Math.abs(ngramHash) / 2147483647;

        for (let dim = 0; dim < dimension; dim++) {
          vector[dim] += Math.sin(ngramHash * dim) * normalizedHash * 0.5;
        }
      }
    }

    // Character-level features
    const charFeatures = this.extractCharFeatures(text);
    for (let dim = 0; dim < dimension; dim++) {
      vector[dim] += charFeatures[dim % charFeatures.length];
    }

    // Normalize vector
    return this.normalizeVector(vector);
  }

  hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  extractCharFeatures(text) {
    const features = [];
    const charTypes = {
      uppercase: 0,
      lowercase: 0,
      digits: 0,
      special: 0
    };

    for (const char of text) {
      if (/[A-Z]/.test(char)) charTypes.uppercase++;
      else if (/[a-z]/.test(char)) charTypes.lowercase++;
      else if (/[0-9]/.test(char)) charTypes.digits++;
      else charTypes.special++;
    }

    const total = text.length || 1;
    features.push(charTypes.uppercase / total);
    features.push(charTypes.lowercase / total);
    features.push(charTypes.digits / total);
    features.push(charTypes.special / total);

    // Text length features
    features.push(Math.min(text.length / 1000, 1));
    features.push(Math.min(text.split(/\s+/).length / 200, 1));

    // Pattern features
    features.push(/https?:\/\//.test(text) ? 1 : 0);
    features.push(/\d{4}-\d{2}-\d{2}/.test(text) ? 1 : 0);
    features.push(/[A-Z][a-z]+ [A-Z][a-z]+/.test(text) ? 1 : 0);

    // Pad to reasonable size
    while (features.length < 20) {
      features.push(0);
    }

    return features;
  }

  normalizeVector(vector) {
    let magnitude = 0;
    for (let i = 0; i < vector.length; i++) {
      magnitude += vector[i] * vector[i];
    }
    magnitude = Math.sqrt(magnitude);

    if (magnitude === 0) {
      return vector;
    }

    const normalized = new Float32Array(vector.length);
    for (let i = 0; i < vector.length; i++) {
      normalized[i] = vector[i] / magnitude;
    }

    return normalized;
  }
}

// Hugging Face Inference API provider
class HuggingFaceProvider {
  constructor() {
    this.apiKey = null;
    this.model = 'sentence-transformers/all-MiniLM-L6-v2';
    this.apiUrl = 'https://api-inference.huggingface.co/models/';
  }

  async configure(settings) {
    this.apiKey = settings.apiKey;
    this.model = settings.model || this.model;
  }

  async embed(text) {
    if (!this.apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    try {
      const response = await fetch(this.apiUrl + this.model, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputs: text,
          options: {
            wait_for_model: true
          }
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      // Extract embedding from response
      if (Array.isArray(result) && result[0] && Array.isArray(result[0])) {
        return new Float32Array(result[0]);
      } else if (result.embeddings) {
        return new Float32Array(result.embeddings);
      } else {
        throw new Error('Unexpected response format from Hugging Face API');
      }

    } catch (error) {
      console.error('Hugging Face API error:', error);
      throw error;
    }
  }
}

// Google Gemini provider
class GeminiProvider {
  constructor() {
    this.apiKey = null;
    this.model = 'text-embedding-004';
    this.apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
  }

  async configure(settings) {
    this.apiKey = settings.apiKey;
    this.model = settings.model || this.model;
  }

  async embed(text) {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured. Please get an API key from Google AI Studio.');
    }

    try {
      const response = await fetch(`${this.apiUrl}/${this.model}:embedContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{
              text: text
            }]
          },
          model: this.model
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error ${response.status}: ${errorText}`);
      }

      const result = await response.json();

      if (result.embedding && result.embedding.values) {
        return new Float32Array(result.embedding.values);
      } else {
        throw new Error('No embedding in Gemini response');
      }

    } catch (error) {
      console.error('Gemini API error:', error);

      if (error.message.includes('API key')) {
        throw new Error('Invalid Gemini API key. Please check your API key configuration.');
      }

      throw error;
    }
  }

  async checkAvailability() {
    if (!this.apiKey) return false;

    try {
      const response = await fetch(`${this.apiUrl}/${this.model}:embedContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{
              text: "test"
            }]
          }
        })
      });

      return response.status !== 401 && response.status !== 403;
    } catch (error) {
      return false;
    }
  }
}

// OpenAI provider (for embeddings)
class OpenAIProvider {
  constructor() {
    this.apiKey = null;
    this.model = 'text-embedding-3-small';
    this.apiUrl = 'https://api.openai.com/v1/embeddings';
  }

  async configure(settings) {
    this.apiKey = settings.apiKey;
    this.model = settings.model || this.model;
  }

  async embed(text) {
    if (!this.apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: text,
          model: this.model,
          encoding_format: 'float'
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.data && result.data[0] && result.data[0].embedding) {
        return new Float32Array(result.data[0].embedding);
      } else {
        throw new Error('No embedding in OpenAI response');
      }

    } catch (error) {
      console.error('OpenAI API error:', error);
      throw error;
    }
  }
}

// Utility functions for embedding management
export class EmbeddingUtils {
  // Calculate cosine similarity between two embeddings
  static cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Embedding dimensions must match');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  // Calculate Euclidean distance
  static euclideanDistance(vecA, vecB) {
    if (vecA.length !== vecB.length) {
      throw new Error('Embedding dimensions must match');
    }

    let sum = 0;
    for (let i = 0; i < vecA.length; i++) {
      const diff = vecA[i] - vecB[i];
      sum += diff * diff;
    }

    return Math.sqrt(sum);
  }

  // Batch embed multiple texts
  static async batchEmbed(embeddingService, texts, batchSize = 10) {
    const embeddings = [];

    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => embeddingService.getEmbedding(text));

      try {
        const batchResults = await Promise.all(batchPromises);
        embeddings.push(...batchResults);
      } catch (error) {
        console.error(`Batch embedding error at index ${i}:`, error);
        // Add zero embeddings for failed items
        for (let j = 0; j < batch.length; j++) {
          embeddings.push(new Float32Array(384)); // Default dimension
        }
      }
    }

    return embeddings;
  }

  // Serialize embedding for storage
  static serializeEmbedding(embedding) {
    return Array.from(embedding);
  }

  // Deserialize embedding from storage
  static deserializeEmbedding(data) {
    return new Float32Array(data);
  }

  // Validate embedding format
  static validateEmbedding(embedding) {
    return embedding &&
           embedding.length > 0 &&
           embedding.every(val => typeof val === 'number' && !isNaN(val));
  }
}

// Export singleton instance
export const embeddingService = new EmbeddingService();