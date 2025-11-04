// Content script - runs on every page to extract content and handle highlighting
(function() {
  'use strict';

  let isProcessing = false;
  let highlightCount = 0;
  let currentHighlights = [];

  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializePageProcessor);
  } else {
    initializePageProcessor();
  }

  function initializePageProcessor() {
  console.log('🚀 Web Memory: 3072D Content script loaded');

  // Listen for messages from page processor
  window.addEventListener('message', handlePageProcessorMessage);

  // Listen for background messages
  chrome.runtime.onMessage.addListener(handleMessage);

  function shouldProcessPage() {
  const url = window.location.href.toLowerCase();
  const hostname = window.location.hostname.toLowerCase();

  // Skip conditions
  const skipPatterns = [
    'mail.google.com', 'web.whatsapp.com', 'facebook.com', 'instagram.com', 'twitter.com',
    'accounts.google.com', 'login.', '.login.', 'signin.', '.signin.', 'gmail.com',
    'chrome://', 'chrome-extension://', 'about:', 'file:'
  ];

  const shouldSkip = skipPatterns.some(pattern => 
    hostname.includes(pattern) || url.includes(pattern)
  );

  if (shouldSkip) {
    console.log('⏭️ Skipped by content script rules:', hostname);
    return false;
  }

  // Check content length
  const contentLength = document.body?.innerText?.length || 0;
  if (contentLength < 100) {
    console.log('⏭️ Content too short:', contentLength, 'chars');
    return false;
  }

  return true;
}

  // FORCE AUTOMATIC PROCESSING
  if (shouldProcessPage()) {
    console.log('🎯 Auto-processing page:', window.location.href);
    setTimeout(() => {
      processPage().catch(error => {
        console.error('❌ Auto-processing failed:', error);
      });
    }, 3000); // 3 second delay for dynamic content
  } else {
    console.log('⏭️ Page skipped by rules:', window.location.href);
  }

  // Observe page changes for SPAs
  observePageChanges();
}


  // Handle messages from injected page processor
  function handlePageProcessorMessage(event) {
    // Only accept messages from same origin
    if (event.source !== window) return;

    if (event.data.type === 'WEB_MEMORY_PAGE_DATA') {
      console.log('Received page data from processor:', event.data.data);

      // Send to background for embedding
      chrome.runtime.sendMessage({
        type: 'EMBED_PAGE',
        data: event.data.data
      }).catch(error => {
        console.error('Failed to send page data to background:', error);
      });
    }
  }

  // Process current page
  async function processPage() {
  if (isProcessing) return;

  try {
    isProcessing = true;
    console.log('🔄 Processing page for 3072D embedding:', window.location.href);

    // Double-check page should be processed
    if (!shouldProcessPage()) {
      console.log('⏭️ Page processing skipped');
      return;
    }

    const pageData = extractPageContent();
    
    if (pageData.content.length < 100) {
      console.log('⏭️ Content too short for 3072D embedding');
      return;
    }

    // FORCE SEND TO BACKGROUND
    console.log('📤 Sending 3072D page data to background:', {
      title: pageData.title,
      contentLength: pageData.content.length,
      chunks: pageData.chunks.length
    });

    const response = await chrome.runtime.sendMessage({
      type: 'EMBED_PAGE',
      data: pageData
    });

    console.log('✅ 3072D page data sent successfully');

  } catch (error) {
    console.error('❌ Page processing error:', error);
  } finally {
    isProcessing = false;
  }
}

  // Check if page should be skipped
  function shouldSkipPage() {
    const url = window.location.href;
    const hostname = window.location.hostname;

    // Skip confidential sites
    const skipPatterns = [
      'mail.google.com',
      'web.whatsapp.com',
      'facebook.com',
      'instagram.com',
      'twitter.com',
      'linkedin.com',
      'gmail.com',
      'outlook.com',
      'yahoo.com',
      'accounts.google.com'
    ];

    return skipPatterns.some(pattern => hostname.includes(pattern)) ||
           url.includes('login') ||
           url.includes('signin') ||
           url.includes('password') ||
           document.title.toLowerCase().includes('login');
  }

  // Extract page content
  function extractPageContent() {
    const pageData = {
      url: window.location.href,
      title: document.title,
      content: '',
      chunks: [],
      metadata: {}
    };

    try {
      // Extract main content using multiple strategies
      let mainContent = '';

      // Strategy 1: Look for main content areas
      const contentSelectors = [
        'main',
        'article',
        '[role="main"]',
        '.content',
        '#content',
        '.post-content',
        '.entry-content',
        '.main-content',
        '.article-content',
        '.page-content'
      ];

      for (const selector of contentSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim().length > mainContent.length) {
          mainContent = extractTextFromElement(element);
        }
      }

      // Strategy 2: Use body content as fallback
      if (mainContent.length < 500) {
        mainContent = extractTextFromElement(document.body);
      }

      // Clean and filter content
      pageData.content = cleanContent(mainContent);

      // Create chunks for embedding
      pageData.chunks = createContentChunks(pageData.content);

      // Extract metadata
      pageData.metadata = extractMetadata();

    } catch (error) {
      console.error('Content extraction error:', error);
    }

    return pageData;
  }

  // Extract text from element, preserving some structure
  function extractTextFromElement(element) {
    if (!element) return '';

    let text = '';

    // Process headings separately
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      text += `\n${heading.tagName} ${heading.textContent.trim()}\n`;
    });

    // Process paragraphs
    const paragraphs = element.querySelectorAll('p');
    paragraphs.forEach(p => {
      const pText = p.textContent.trim();
      if (pText.length > 20) { // Skip very short paragraphs
        text += pText + ' ';
      }
    });

    // Process lists
    const lists = element.querySelectorAll('li');
    lists.forEach(li => {
      const liText = li.textContent.trim();
      if (liText.length > 10) {
        text += `• ${liText} `;
      }
    });

    // Get remaining text from the element
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip script, style, and other non-content elements
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

    let nodeText = '';
    let node;
    while (node = walker.nextNode()) {
      const nodeContent = node.textContent.trim();
      if (nodeContent.length > 3) {
        nodeText += nodeContent + ' ';
      }
    }

    // Combine structured and unstructured text
    return (text + ' ' + nodeText).trim();
  }

  // Clean content
  function cleanContent(content) {
    return content
      .replace(/\s+/g, ' ')           // Multiple spaces to single
      .replace(/\n\s*\n/g, '\n')      // Multiple newlines to single
      .replace(/[^\w\s\.\,\!\?\-\n]/g, '') // Remove special characters except basic punctuation
      .trim();
  }

  // Create content chunks for embedding
  function createContentChunks(content, maxChunkSize = 1000) {
    const chunks = [];
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 20);

    let currentChunk = '';
    let chunkIndex = 0;

    for (const sentence of sentences) {
      const sentenceTrimmed = sentence.trim();

      if (currentChunk.length + sentenceTrimmed.length > maxChunkSize && currentChunk.length > 100) {
        chunks.push({
          id: `chunk_${chunkIndex++}`,
          text: currentChunk.trim(),
          metadata: {
            url: window.location.href,
            chunkIndex: chunkIndex - 1,
            timestamp: Date.now()
          }
        });
        currentChunk = sentenceTrimmed + '. ';
      } else {
        currentChunk += sentenceTrimmed + '. ';
      }
    }

    // Add remaining content
    if (currentChunk.trim().length > 50) {
      chunks.push({
        id: `chunk_${chunkIndex}`,
        text: currentChunk.trim(),
        metadata: {
          url: window.location.href,
          chunkIndex: chunkIndex,
          timestamp: Date.now()
        }
      });
    }

    return chunks.length > 0 ? chunks : [{
      id: `chunk_0`,
      text: content.substring(0, 1000),
      metadata: {
        url: window.location.href,
        chunkIndex: 0,
        timestamp: Date.now()
      }
    }];
  }

  // Extract page metadata
  function extractMetadata() {
    const metadata = {};

    // Description
    const descMeta = document.querySelector('meta[name="description"]');
    if (descMeta) metadata.description = descMeta.content;

    // Keywords
    const keywordsMeta = document.querySelector('meta[name="keywords"]');
    if (keywordsMeta) metadata.keywords = keywordsMeta.content;

    // Author
    const authorMeta = document.querySelector('meta[name="author"]');
    if (authorMeta) metadata.author = authorMeta.content;

    // Published date
    const dateMeta = document.querySelector('meta[property="article:published_time"]') ||
                    document.querySelector('meta[name="date"]') ||
                    document.querySelector('meta[property="og:updated_time"]');
    if (dateMeta) metadata.publishDate = dateMeta.content;

    // Site name
    const siteMeta = document.querySelector('meta[property="og:site_name"]');
    if (siteMeta) metadata.siteName = siteMeta.content;

    // Language
    const htmlLang = document.documentElement.lang || document.querySelector('html').getAttribute('lang');
    if (htmlLang) metadata.language = htmlLang;

    return metadata;
  }

  // Handle messages from background script
  async function handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'HIGHLIGHT_TEXT':
          const highlightResult = await handleHighlightText(message.text, message.options);
          sendResponse(highlightResult);
          break;

        case 'CLEAR_HIGHLIGHTS':
          clearHighlights();
          sendResponse({ success: true });
          break;

        case 'SCROLL_TO_HIGHLIGHT':
          scrollToHighlight(message.index);
          sendResponse({ success: true });
          break;

        case 'GET_PAGE_INFO':
          const pageInfo = getPageInfo();
          sendResponse(pageInfo);
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Message handling error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  // Highlight text on page
  async function handleHighlightText(text, options = {}) {
    try {
      clearHighlights(); // Clear existing highlights

      const { style = 'default', caseSensitive = false, wholeWord = false } = options;
      const searchText = caseSensitive ? text : text.toLowerCase();
      const pageText = document.body.innerText;
      const pageTextLower = pageText.toLowerCase();

      let positions = [];

      if (wholeWord) {
        // Find whole word matches
        const regex = new RegExp(`\\b${searchText}\\b`, caseSensitive ? 'g' : 'gi');
        let match;
        while ((match = regex.exec(pageText)) !== null) {
          positions.push(match.index);
        }
      } else {
        // Find all occurrences
        let index = 0;
        while (true) {
          const pos = caseSensitive ?
            pageText.indexOf(searchText, index) :
            pageTextLower.indexOf(searchText, index);

          if (pos === -1) break;
          positions.push(pos);
          index = pos + 1;
        }
      }

      // Limit highlights to avoid performance issues
      if (positions.length > 50) {
        positions = positions.slice(0, 50);
      }

      // Create highlights using Text Highlighter API if available, otherwise use Range API
      for (const position of positions) {
        const highlight = await createHighlight(position, text.length, style);
        if (highlight) {
          currentHighlights.push(highlight);
        }
      }

      highlightCount = currentHighlights.length;

      // Scroll to first highlight
      if (currentHighlights.length > 0) {
        scrollToHighlight(0);
      }

      console.log(`Highlighted ${highlightCount} occurrences of "${text}"`);
      return { success: true, count: highlightCount };

    } catch (error) {
      console.error('Highlight error:', error);
      return { success: false, error: error.message };
    }
  }

  // Create highlight for text range
  async function createHighlight(startPos, length, style) {
    try {
      // Use Text Highlighter API if available (Chrome 105+)
      if ('Highlight' in window && 'CSS' in window && CSS.supports('color', 'color-mix(in srgb, red, blue)')) {
        return createModernHighlight(startPos, length, style);
      } else {
        // Fallback to DOM manipulation
        return createLegacyHighlight(startPos, length, style);
      }
    } catch (error) {
      console.error('Highlight creation error:', error);
      return null;
    }
  }

  // Create modern highlight using Text Highlighter API
  function createModernHighlight(startPos, length, style) {
    const range = getTextRange(startPos, length);
    if (!range) return null;

    const highlight = new Highlight(range);

    // Apply custom highlight style
    const styleMap = new Map([
      ['default', { backgroundColor: '#ffeb3b', color: '#000' }],
      ['search', { backgroundColor: '#4caf50', color: '#fff' }],
      ['important', { backgroundColor: '#f44336', color: '#fff' }]
    ]);

    const highlightStyle = styleMap.get(style) || styleMap.get('default');
    highlight.style = highlightStyle;

    // Register highlight
    CSS.highlights.set(`highlight_${Date.now()}_${Math.random()}`, highlight);

    return { type: 'modern', range, highlight, style };
  }

  // Create legacy highlight using DOM manipulation
  function createLegacyHighlight(startPos, length, style) {
    const range = getTextRange(startPos, length);
    if (!range) return null;

    const span = document.createElement('span');
    span.className = 'web-memory-highlight';
    span.style.cssText = getHighlightStyle(style);

    try {
      range.surroundContents(span);
      return { type: 'legacy', element: span, style };
    } catch (error) {
      // Fallback for complex ranges
      try {
        span.appendChild(range.extractContents());
        range.insertNode(span);
        return { type: 'legacy', element: span, style };
      } catch (fallbackError) {
        console.error('Legacy highlight fallback error:', fallbackError);
        return null;
      }
    }
  }

  // Get text range from position
  function getTextRange(startPos, length) {
    try {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let currentPos = 0;
      let startNode = null;
      let startOffset = 0;
      let endNode = null;
      let endOffset = 0;

      while (walker.nextNode()) {
        const node = walker.currentNode;
        const nodeText = node.textContent;
        const nodeLength = nodeText.length;

        if (currentPos + nodeLength >= startPos && !startNode) {
          startNode = node;
          startOffset = startPos - currentPos;
        }

        if (currentPos + nodeLength >= startPos + length && !endNode) {
          endNode = node;
          endOffset = startPos + length - currentPos;
          break;
        }

        currentPos += nodeLength;
      }

      if (startNode && endNode) {
        const range = document.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        return range;
      }

      return null;
    } catch (error) {
      console.error('Range creation error:', error);
      return null;
    }
  }

  // Get highlight style CSS
  function getHighlightStyle(style) {
    const styles = {
      default: 'background-color: #ffeb3b; color: #000; padding: 2px 4px; border-radius: 3px;',
      search: 'background-color: #4caf50; color: #fff; padding: 2px 4px; border-radius: 3px;',
      important: 'background-color: #f44336; color: #fff; padding: 2px 4px; border-radius: 3px;'
    };
    return styles[style] || styles.default;
  }

  // Clear all highlights
  function clearHighlights() {
    try {
      // Clear modern highlights
      if ('Highlight' in window && CSS && CSS.highlights) {
        for (const key of CSS.highlights.keys()) {
          if (key.startsWith('highlight_')) {
            CSS.highlights.delete(key);
          }
        }
      }

      // Clear legacy highlights
      const legacyHighlights = document.querySelectorAll('.web-memory-highlight');
      legacyHighlights.forEach(element => {
        const parent = element.parentNode;
        while (element.firstChild) {
          parent.insertBefore(element.firstChild, element);
        }
        parent.removeChild(element);
      });

      currentHighlights = [];
      highlightCount = 0;

    } catch (error) {
      console.error('Clear highlights error:', error);
    }
  }

  // Scroll to specific highlight
  function scrollToHighlight(index) {
    try {
      const highlight = currentHighlights[index];
      if (!highlight) return;

      let element;
      if (highlight.type === 'legacy' && highlight.element) {
        element = highlight.element;
      } else if (highlight.type === 'modern' && highlight.range) {
        element = highlight.range.commonAncestorContainer;
        if (element.nodeType === Node.TEXT_NODE) {
          element = element.parentElement;
        }
      }

      if (element) {
        element.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }

    } catch (error) {
      console.error('Scroll to highlight error:', error);
    }
  }

  // Get page information
  function getPageInfo() {
    return {
      title: document.title,
      url: window.location.href,
      contentLength: document.body.innerText.length,
      headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim()),
      links: document.querySelectorAll('a').length,
      images: document.querySelectorAll('img').length,
      timestamp: Date.now()
    };
  }

  // Observe page changes for dynamic content
  function observePageChanges() {
    try {
      const observer = new MutationObserver((mutations) => {
        let shouldReprocess = false;

        mutations.forEach((mutation) => {
          if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // Check if significant content was added
            mutation.addedNodes.forEach(node => {
              if (node.nodeType === Node.ELEMENT_NODE) {
                const tagName = node.tagName.toLowerCase();
                if (['article', 'main', 'section', 'div'].includes(tagName) &&
                    node.textContent && node.textContent.length > 500) {
                  shouldReprocess = true;
                }
              }
            });
          }
        });

        if (shouldReprocess) {
          // Debounce reprocessing
          clearTimeout(window.webMemoryReprocessTimeout);
          window.webMemoryReprocessTimeout = setTimeout(processPage, 3000);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      console.log('Page change observer started');
    } catch (error) {
      console.error('Observer setup error:', error);
    }
  }

})();