// Page processor - injected script for advanced page analysis
(function() {
  'use strict';

  console.log('🔧 Web Memory: 3072D Page processor injected');

  // FORCE RUN - No waiting
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runProcessor);
  } else {
    runProcessor();
  }

  async function runProcessor() {
    try {
      console.log('🚀 Running 3072D page processor');
      
      // Small delay for dynamic content
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const pageData = await extractAdvancedPageContent();
      
      console.log('📊 3072D extraction completed:', {
        title: pageData.title,
        contentLength: pageData.content.length,
        chunks: pageData.chunks.length
      });

      // FORCE SEND DATA
      window.postMessage({
        type: 'WEB_MEMORY_PAGE_DATA',
        data: pageData
      }, '*');

      console.log('✅ 3072D data sent to content script');

    } catch (error) {
      console.error('❌ Page processor failed:', error);
    }
  }

  // Main content extraction function
  async function extractAdvancedPageContent() {
    const pageData = {
      url: window.location.href,
      title: document.title,
      content: '',
      chunks: [],
      metadata: {
        contentType: detectContentType(),
        language: detectLanguage(),
        readingTime: 0,
        wordCount: 0,
        structure: {}
      },
      links: [],
      images: [],
      headings: []
    };

    try {
      // Extract main content with advanced strategies
      pageData.content = await extractMainContent();

      // Create intelligent chunks
      pageData.chunks = createIntelligentChunks(pageData.content);

      // Extract structured data
      pageData.metadata.structure = extractPageStructure();
      pageData.metadata.readingTime = estimateReadingTime(pageData.content);
      pageData.metadata.wordCount = pageData.content.split(/\s+/).length;

      // Extract links and images
      pageData.links = extractImportantLinks();
      pageData.images = extractImportantImages();
      pageData.headings = extractHeadings();

      // Extract structured data (JSON-LD, microdata, etc.)
      const structuredData = extractStructuredData();
      if (structuredData) {
        pageData.metadata.structuredData = structuredData;
      }

    } catch (error) {
      console.error('Content extraction error:', error);
    }

    return pageData;
  }

  function detectContentType() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();
    const meta = document.querySelector('meta[name="description"]')?.content || '';

    const content = (title + ' ' + meta).toLowerCase();

    // Check for common content type indicators
    if (url.includes('github.com') || content.includes('repository') || content.includes('code')) {
      return 'code';
    }

    if (url.includes('wikipedia.org') || content.includes('encyclopedia') || content.includes('reference')) {
      return 'reference';
    }

    if (content.includes('product') || content.includes('buy') || content.includes('price') || content.includes('shop')) {
      return 'ecommerce';
    }

    if (content.includes('article') || content.includes('blog') || content.includes('post') || content.includes('news')) {
      return 'article';
    }

    if (content.includes('documentation') || content.includes('tutorial') || content.includes('guide') || content.includes('manual')) {
      return 'documentation';
    }

    if (content.includes('video') || url.includes('youtube.com') || url.includes('vimeo.com')) {
      return 'video';
    }

    // Check for article schema
    const articleSchema = document.querySelector('[property="og:type"][content="article"]');
    if (articleSchema) return 'article';

    // Check for e-commerce indicators
    const priceElements = document.querySelectorAll('[class*="price"], [class*="cost"], [class*="amount"]');
    if (priceElements.length > 0) return 'ecommerce';

    return 'general';
  }

  function detectLanguage() {
    // Try HTML lang attribute first
    const htmlLang = document.documentElement.lang || document.querySelector('html')?.getAttribute('lang');
    if (htmlLang) return htmlLang;

    // Try meta tags
    const metaLang = document.querySelector('meta[http-equiv="content-language"]');
    if (metaLang) return metaLang.content;

    // Analyze content as fallback
    const text = document.body.innerText;
    if (text) {
      // Simple language detection based on common words
      if (/\b(the|and|or|but|in|on|at|to|for|of|with|by)\b/i.test(text)) {
        return 'en';
      }
    }

    return 'unknown';
  }

  async function extractMainContent() {
    // Strategy 1: Use Readability algorithm (Mozilla's)
    let content = extractWithReadability();

    // Strategy 2: Use content selectors
    if (!content || content.length < 500) {
      content = extractWithSelectors();
    }

    // Strategy 3: Use machine learning heuristics
    if (!content || content.length < 500) {
      content = extractWithHeuristics();
    }

    // Strategy 4: Fallback to body content
    if (!content || content.length < 100) {
      content = extractFromElement(document.body);
    }

    // Clean and normalize content
    return cleanExtractedContent(content);
  }

  function extractWithReadability() {
    try {
      // Simplified readability algorithm
      const candidates = [];

      // Find potential content containers
      const contentSelectors = [
        'main', 'article', '[role="main"]',
        '.content', '#content', '.post-content',
        '.entry-content', '.main-content', '.article-content'
      ];

      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          candidates.push({
            element,
            score: scoreContentElement(element),
            content: extractFromElement(element)
          });
        }
      }

      // Find best candidate
      const best = candidates.sort((a, b) => b.score - a.score)[0];
      return best ? best.content : '';

    } catch (error) {
      console.error('Readability extraction error:', error);
      return '';
    }
  }

  function scoreContentElement(element) {
    let score = 0;

    // Text length
    const text = element.innerText || '';
    score += Math.min(text.length / 100, 50);

    // Paragraph count
    const paragraphs = element.querySelectorAll('p').length;
    score += paragraphs * 5;

    // Heading presence
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6').length;
    score += headings * 3;

    // Link density (lower is better for main content)
    const links = element.querySelectorAll('a').length;
    const words = text.split(/\s+/).length;
    const linkDensity = links / Math.max(words, 1);
    score -= linkDensity * 20;

    // Class name hints
    const className = element.className.toLowerCase();
    if (className.includes('content')) score += 20;
    if (className.includes('main')) score += 15;
    if (className.includes('article')) score += 15;
    if (className.includes('post')) score += 10;

    // ID hints
    const id = element.id.toLowerCase();
    if (id.includes('content')) score += 20;
    if (id.includes('main')) score += 15;
    if (id.includes('article')) score += 15;

    // Penalize navigation and sidebar elements
    if (className.includes('nav') || className.includes('sidebar') || className.includes('menu')) {
      score -= 50;
    }

    return Math.max(0, score);
  }

  function extractWithSelectors() {
    const selectors = [
      'article',
      'main',
      '[role="main"]',
      '.content',
      '#content',
      '.post-content',
      '.entry-content',
      '.article-content',
      '.main-content'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const content = extractFromElement(element);
        if (content.length > 200) {
          return content;
        }
      }
    }

    return '';
  }

  function extractWithHeuristics() {
    // Find elements with high content-to-markup ratio
    const elements = document.querySelectorAll('div, section, article, main');
    let bestContent = '';
    let bestRatio = 0;

    for (const element of elements) {
      const text = extractFromElement(element);
      const html = element.innerHTML;
      const ratio = text.length / Math.max(html.length, 1);

      if (text.length > 200 && ratio > bestRatio) {
        bestRatio = ratio;
        bestContent = text;
      }
    }

    return bestContent;
  }

  function extractFromElement(element) {
    if (!element) return '';

    let content = '';

    // Extract headings separately
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      content += `\n${heading.tagName} ${heading.textContent.trim()}\n`;
    });

    // Extract paragraphs
    const paragraphs = element.querySelectorAll('p');
    paragraphs.forEach(p => {
      const text = p.textContent.trim();
      if (text.length > 10) {
        content += text + ' ';
      }
    });

    // Extract lists
    const lists = element.querySelectorAll('li');
    lists.forEach(li => {
      const text = li.textContent.trim();
      if (text.length > 5) {
        content += `• ${text} `;
      }
    });

    // Extract text content from other elements
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'nav', 'header', 'footer'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    let textContent = '';
    let node;
    while (node = walker.nextNode()) {
      const nodeText = node.textContent.trim();
      if (nodeText.length > 3) {
        textContent += nodeText + ' ';
      }
    }

    return (content + ' ' + textContent).trim();
  }

  function cleanExtractedContent(content) {
    return content
      .replace(/\s+/g, ' ')           // Multiple spaces to single
      .replace(/\n\s*\n/g, '\n')      // Multiple newlines to single
      .replace(/\t+/g, ' ')           // Tabs to spaces
      .replace(/[^\w\s\.\,\!\?\-\n\']/g, '') // Remove special characters
      .trim();
  }

  function createIntelligentChunks(content, maxChunkSize = 1000) {
    const chunks = [];

    // Split content into paragraphs
    const paragraphs = content.split('\n').filter(p => p.trim().length > 20);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const paragraph of paragraphs) {
      const trimmedParagraph = paragraph.trim();

      // If adding this paragraph would exceed chunk size, start new chunk
      if (currentChunk.length + trimmedParagraph.length > maxChunkSize && currentChunk.length > 200) {
        chunks.push(createChunk(currentChunk.trim(), chunkIndex++));
        currentChunk = trimmedParagraph + '\n\n';
      } else {
        currentChunk += trimmedParagraph + '\n\n';
      }
    }

    // Add remaining content
    if (currentChunk.trim().length > 50) {
      chunks.push(createChunk(currentChunk.trim(), chunkIndex));
    }

    // If no chunks were created, create one with the entire content
    if (chunks.length === 0 && content.length > 0) {
      chunks.push(createChunk(content.substring(0, maxChunkSize), 0));
    }

    return chunks;
  }

  function createChunk(text, index) {
    return {
      id: `chunk_${Date.now()}_${index}`,
      text: text.trim(),
      metadata: {
        url: window.location.href,
        chunkIndex: index,
        timestamp: Date.now(),
        wordCount: text.split(/\s+/).length,
        characterCount: text.length
      }
    };
  }

  function extractPageStructure() {
    const structure = {
      headings: [],
      sections: 0,
      links: 0,
      images: 0,
      lists: 0
    };

    // Extract heading structure
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      structure.headings.push({
        level: parseInt(heading.tagName.substring(1)),
        text: heading.textContent.trim(),
        id: heading.id || ''
      });
    });

    // Count structural elements
    structure.sections = document.querySelectorAll('section, article, main').length;
    structure.links = document.querySelectorAll('a[href]').length;
    structure.images = document.querySelectorAll('img[src]').length;
    structure.lists = document.querySelectorAll('ul, ol, dl').length;

    return structure;
  }

  function estimateReadingTime(content) {
    const wordsPerMinute = 200; // Average reading speed
    const words = content.split(/\s+/).length;
    return Math.ceil(words / wordsPerMinute);
  }

  function extractImportantLinks() {
    const links = [];
    const linkElements = document.querySelectorAll('a[href]');

    linkElements.forEach(link => {
      const href = link.href;
      const text = link.textContent.trim();

      // Only include external links with meaningful text
      if (href && text.length > 5 && href.includes('http') && !href.includes(window.location.hostname)) {
        links.push({
          url: href,
          text: text,
          title: link.title || ''
        });
      }
    });

    // Limit to most important links
    return links.slice(0, 20);
  }

  function extractImportantImages() {
    const images = [];
    const imgElements = document.querySelectorAll('img[src]');

    imgElements.forEach(img => {
      if (img.src && (img.alt || img.title)) {
        images.push({
          url: img.src,
          alt: img.alt || '',
          title: img.title || '',
          width: img.naturalWidth || img.width,
          height: img.naturalHeight || img.height
        });
      }
    });

    return images.slice(0, 10);
  }

  function extractHeadings() {
    const headings = [];
    const headingElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6');

    headingElements.forEach(heading => {
      headings.push({
        level: parseInt(heading.tagName.substring(1)),
        text: heading.textContent.trim(),
        id: heading.id || ''
      });
    });

    return headings;
  }

  function extractStructuredData() {
    const structuredData = [];

    // JSON-LD
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    jsonLdScripts.forEach(script => {
      try {
        const data = JSON.parse(script.textContent);
        structuredData.push({ type: 'json-ld', data });
      } catch (error) {
        console.warn('Failed to parse JSON-LD:', error);
      }
    });

    // Microdata
    const microdataItems = document.querySelectorAll('[itemscope]');
    microdataItems.forEach(item => {
      const microdata = extractMicrodata(item);
      if (Object.keys(microdata).length > 0) {
        structuredData.push({ type: 'microdata', data: microdata });
      }
    });

    // Open Graph
    const ogData = {};
    document.querySelectorAll('meta[property^="og:"]').forEach(meta => {
      const property = meta.getAttribute('property');
      const content = meta.getAttribute('content');
      if (property && content) {
        ogData[property] = content;
      }
    });

    if (Object.keys(ogData).length > 0) {
      structuredData.push({ type: 'opengraph', data: ogData });
    }

    return structuredData.length > 0 ? structuredData : null;
  }

  function extractMicrodata(item) {
    const data = {
      type: item.getAttribute('itemtype') || '',
      properties: {}
    };

    // Extract properties
    const props = item.querySelectorAll('[itemprop]');
    props.forEach(prop => {
      const name = prop.getAttribute('itemprop');
      let value = prop.getAttribute('content') || prop.textContent.trim();

      if (value && name) {
        data.properties[name] = value;
      }
    });

    return data;
  }

})();