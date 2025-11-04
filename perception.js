// Perception module - analyze web page content and user intent
export class PerceptionModule {
  constructor() {
    this.contentExtractor = new ContentExtractor();
    this.intentAnalyzer = new IntentAnalyzer();
  }

  // Extract and analyze web page content
  async extractPerception(url, documentContent) {
    try {
      // Extract structured content from page
      const pageContent = await this.contentExtractor.extract(documentContent);

      // Analyze page intent and key entities
      const intentAnalysis = await this.intentAnalyzer.analyzePage(pageContent);

      return new PerceptionResult({
        url,
        intent: intentAnalysis.intent,
        entities: intentAnalysis.entities,
        keywords: intentAnalysis.keywords,
        contentType: intentAnalysis.contentType,
        summary: intentAnalysis.summary,
        importance: intentAnalysis.importance,
        toolHints: intentAnalysis.toolHints
      });

    } catch (error) {
      console.error('Perception extraction error:', error);
      return new PerceptionResult({
        url,
        intent: 'unknown',
        entities: [],
        keywords: [],
        contentType: 'unknown',
        summary: 'Failed to analyze page content',
        importance: 0.5
      });
    }
  }

  // Analyze user search query
  async analyzeUserQuery(query) {
    return await this.intentAnalyzer.analyzeQuery(query);
  }

  // Analyze user interaction context
  async analyzeContext(context) {
    return await this.intentAnalyzer.analyzeContext(context);
  }
}

// Result class for perception data
class PerceptionResult {
  constructor(data) {
    this.url = data.url;
    this.intent = data.intent || 'unknown';
    this.entities = data.entities || [];
    this.keywords = data.keywords || [];
    this.contentType = data.contentType || 'unknown';
    this.summary = data.summary || '';
    this.importance = data.importance || 0.5;
    this.toolHints = data.toolHints || [];
    this.timestamp = Date.now();
  }

  // Get relevance score for a query
  getRelevanceScore(query) {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Check content type match
    if (this.contentType.toLowerCase().includes(queryLower)) {
      score += 0.3;
    }

    // Check keyword matches
    const matchingKeywords = this.keywords.filter(keyword =>
      keyword.toLowerCase().includes(queryLower) ||
      queryLower.includes(keyword.toLowerCase())
    );
    score += (matchingKeywords.length / Math.max(this.keywords.length, 1)) * 0.4;

    // Check entity matches
    const matchingEntities = this.entities.filter(entity =>
      entity.text.toLowerCase().includes(queryLower) ||
      queryLower.includes(entity.text.toLowerCase())
    );
    score += (matchingEntities.length / Math.max(this.entities.length, 1)) * 0.2;

    // Apply importance factor
    score *= this.importance;

    return Math.min(score, 1.0);
  }

  // Get chunks for embedding
  getChunks(maxChunkSize = 1000) {
    const chunks = [];
    const content = this.summary + ' ' + this.keywords.join(' ');

    // Split content into chunks
    for (let i = 0; i < content.length; i += maxChunkSize) {
      chunks.push({
        text: content.substring(i, i + maxChunkSize),
        metadata: {
          url: this.url,
          chunkIndex: Math.floor(i / maxChunkSize),
          timestamp: this.timestamp,
          contentType: this.contentType
        }
      });
    }

    return chunks.length > 0 ? chunks : [{
      text: this.summary || 'No content available',
      metadata: {
        url: this.url,
        chunkIndex: 0,
        timestamp: this.timestamp,
        contentType: this.contentType
      }
    }];
  }
}

// Content extraction utilities
class ContentExtractor {
  async extract(documentContent) {
    const content = {
      title: '',
      mainContent: '',
      headings: [],
      links: [],
      images: [],
      metadata: {}
    };

    try {
      // Extract title
      content.title = documentContent.title ||
                     documentContent.querySelector('title')?.textContent ||
                     documentContent.querySelector('h1')?.textContent ||
                     'Untitled';

      // Extract main content (try different selectors)
      const contentSelectors = [
        'main',
        'article',
        '[role="main"]',
        '.content',
        '#content',
        '.post-content',
        '.entry-content',
        '.main-content'
      ];

      for (const selector of contentSelectors) {
        const element = documentContent.querySelector(selector);
        if (element) {
          content.mainContent = this.getTextContent(element);
          break;
        }
      }

      // Fallback to body content
      if (!content.mainContent) {
        content.mainContent = this.getTextContent(documentContent.body);
      }

      // Extract headings
      const headingElements = documentContent.querySelectorAll('h1, h2, h3, h4, h5, h6');
      content.headings = Array.from(headingElements).map(h => ({
        level: parseInt(h.tagName.substring(1)),
        text: h.textContent.trim()
      }));

      // Extract links
      const linkElements = documentContent.querySelectorAll('a[href]');
      content.links = Array.from(linkElements).map(link => ({
        url: link.href,
        text: link.textContent.trim()
      })).filter(link => link.text.length > 0);

      // Extract images with alt text
      const imageElements = documentContent.querySelectorAll('img[src]');
      content.images = Array.from(imageElements).map(img => ({
        url: img.src,
        alt: img.alt || '',
        title: img.title || ''
      })).filter(img => img.alt.length > 0 || img.title.length > 0);

      // Extract metadata
      content.metadata = {
        description: documentContent.querySelector('meta[name="description"]')?.content || '',
        keywords: documentContent.querySelector('meta[name="keywords"]')?.content || '',
        author: documentContent.querySelector('meta[name="author"]')?.content || '',
        publishDate: documentContent.querySelector('meta[property="article:published_time"]')?.content ||
                   documentContent.querySelector('meta[name="date"]')?.content || ''
      };

    } catch (error) {
      console.error('Content extraction error:', error);
    }

    return content;
  }

  getTextContent(element) {
    // Clean and extract text content
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let text = '';
    let node;
    while (node = walker.nextNode()) {
      const nodeText = node.textContent.trim();
      if (nodeText.length > 0) {
        text += nodeText + ' ';
      }
    }

    // Clean up whitespace
    return text.replace(/\s+/g, ' ').trim();
  }
}

// Intent analysis utilities
class IntentAnalyzer {
  async analyzePage(pageContent) {
    const analysis = {
      intent: 'information',
      entities: [],
      keywords: [],
      contentType: this.detectContentType(pageContent),
      summary: this.generateSummary(pageContent),
      importance: this.calculateImportance(pageContent),
      toolHints: []
    };

    // Extract entities using simple patterns
    analysis.entities = this.extractEntities(pageContent);

    // Extract keywords
    analysis.keywords = this.extractKeywords(pageContent);

    // Determine intent
    analysis.intent = this.determineIntent(pageContent, analysis.contentType);

    // Suggest tools based on content
    analysis.toolHints = this.suggestTools(analysis.contentType, analysis.intent);

    return analysis;
  }

  async analyzeQuery(query) {
    return {
      intent: this.determineQueryIntent(query),
      entities: this.extractQueryEntities(query),
      keywords: this.extractQueryKeywords(query),
      urgency: this.assessUrgency(query)
    };
  }

  async analyzeContext(context) {
    return {
      recentQueries: context.recentQueries || [],
      currentDomain: context.currentDomain || '',
      timeSpent: context.timeSpent || 0,
      deviceType: 'desktop' // Could be enhanced
    };
  }

  detectContentType(content) {
    const text = (content.title + ' ' + content.mainContent).toLowerCase();

    // Check for different content types
    if (text.includes('product') || text.includes('buy') || text.includes('price') || text.includes('shop')) {
      return 'ecommerce';
    }
    if (text.includes('article') || text.includes('blog') || text.includes('post')) {
      return 'article';
    }
    if (text.includes('documentation') || text.includes('tutorial') || text.includes('guide')) {
      return 'documentation';
    }
    if (text.includes('news') || text.includes('breaking') || text.includes('report')) {
      return 'news';
    }
    if (text.includes('video') || text.includes('youtube') || text.includes('watch')) {
      return 'video';
    }
    if (text.includes('github') || text.includes('code') || text.includes('repository')) {
      return 'code';
    }

    return 'general';
  }

  generateSummary(content) {
    // Simple summary generation - take first few sentences
    const text = content.mainContent;
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    const summary = sentences.slice(0, 3).join('. ') + (sentences.length > 3 ? '...' : '');
    return summary.substring(0, 500);
  }

  calculateImportance(content) {
    let importance = 0.5; // Base importance

    // Increase importance for certain content types
    const text = (content.title + ' ' + content.mainContent).toLowerCase();

    if (this.detectContentType(content) === 'documentation') importance += 0.2;
    if (this.detectContentType(content) === 'news') importance += 0.1;
    if (text.includes('tutorial') || text.includes('guide')) importance += 0.15;
    if (content.title.length > 50) importance += 0.05;
    if (content.mainContent.length > 1000) importance += 0.1;

    return Math.min(importance, 1.0);
  }

  extractEntities(content) {
    const text = content.title + ' ' + content.mainContent;
    const entities = [];

    // Simple entity extraction patterns
    const patterns = {
      email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
      url: /https?:\/\/[^\s]+/g,
      phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
      date: /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b\d{4}[\/-]\d{1,2}[\/-]\d{1,2}\b/g,
      price: /\$\s*\d+(?:,\d{3})*(?:\.\d{2})?/g
    };

    Object.entries(patterns).forEach(([type, pattern]) => {
      const matches = text.match(pattern);
      if (matches) {
        matches.slice(0, 5).forEach(match => { // Limit to avoid spam
          entities.push({ type, text: match });
        });
      }
    });

    // Extract capitalized words (potential names, organizations)
    const capitalizedWords = text.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    capitalizedWords.slice(0, 10).forEach(word => {
      if (word.length > 3) {
        entities.push({ type: 'proper_noun', text: word });
      }
    });

    return entities;
  }

  extractKeywords(content) {
    const text = (content.title + ' ' + content.mainContent).toLowerCase();

    // Remove common stop words
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'before', 'after', 'above', 'below', 'between', 'among', 'is', 'are',
      'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
      'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must'
    ]);

    // Extract words and count frequency
    const words = text.match(/\b[a-z]{3,}\b/g) || [];
    const wordFreq = {};

    words.forEach(word => {
      if (!stopWords.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });

    // Sort by frequency and return top keywords
    return Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word]) => word);
  }

  determineIntent(content, contentType) {
    const text = (content.title + ' ' + content.mainContent).toLowerCase();

    if (contentType === 'ecommerce') return 'shopping';
    if (contentType === 'documentation') return 'learning';
    if (contentType === 'news') return 'information';
    if (text.includes('how to') || text.includes('tutorial')) return 'instructional';
    if (text.includes('review') || text.includes('opinion')) return 'evaluation';
    if (text.includes('contact') || text.includes('about')) return 'navigation';

    return 'information';
  }

  suggestTools(contentType, intent) {
    const tools = [];

    switch (contentType) {
      case 'documentation':
        tools.push('search', 'bookmark', 'highlight');
        break;
      case 'ecommerce':
        tools.push('price_tracker', 'wishlist', 'compare');
        break;
      case 'article':
        tools.push('read_later', 'share', 'note');
        break;
      case 'code':
        tools.push('code_snippet', 'documentation_search');
        break;
    }

    switch (intent) {
      case 'learning':
        tools.push('progress_tracker', 'notes');
        break;
      case 'shopping':
        tools.push('price_alert', 'coupon_finder');
        break;
    }

    return [...new Set(tools)]; // Remove duplicates
  }

  determineQueryIntent(query) {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.startsWith('how to') || lowerQuery.includes('tutorial')) {
      return 'instructional';
    }
    if (lowerQuery.includes('buy') || lowerQuery.includes('price') || lowerQuery.includes('shop')) {
      return 'shopping';
    }
    if (lowerQuery.includes('what is') || lowerQuery.includes('define')) {
      return 'definition';
    }
    if (lowerQuery.includes('compare') || lowerQuery.includes('vs')) {
      return 'comparison';
    }
    if (lowerQuery.includes('find') || lowerQuery.includes('search')) {
      return 'search';
    }

    return 'information';
  }

  extractQueryEntities(query) {
    // Simple entity extraction for queries
    const entities = [];

    // URLs
    const urls = query.match(/https?:\/\/[^\s]+/g);
    if (urls) {
      urls.forEach(url => entities.push({ type: 'url', text: url }));
    }

    // Quoted phrases
    const quotes = query.match(/"([^"]+)"/g);
    if (quotes) {
      quotes.forEach(quote => {
        const text = quote.replace(/"/g, '');
        entities.push({ type: 'exact_phrase', text });
      });
    }

    return entities;
  }

  extractQueryKeywords(query) {
    // Remove stop words and extract keywords
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
      'is', 'are', 'was', 'were', 'be', 'been', 'i', 'you', 'he', 'she',
      'it', 'we', 'they', 'what', 'where', 'when', 'why', 'how'
    ]);

    return query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10);
  }

  assessUrgency(query) {
    const urgentWords = ['urgent', 'asap', 'immediately', 'now', 'emergency', 'critical'];
    const lowerQuery = query.toLowerCase();

    return urgentWords.some(word => lowerQuery.includes(word)) ? 'high' : 'normal';
  }
}