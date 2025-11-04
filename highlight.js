// Highlight script - standalone text highlighting functionality
(function() {
  'use strict';

  let currentHighlights = [];
  let highlightStyles = {
    default: 'background-color: #ffeb3b; color: #000; padding: 2px 4px; border-radius: 3px; border: 1px solid #fbc02d;',
    search: 'background-color: #4caf50; color: #fff; padding: 2px 4px; border-radius: 3px; border: 1px solid #388e3c;',
    important: 'background-color: #f44336; color: #fff; padding: 2px 4px; border-radius: 3px; border: 1px solid #d32f2f;'
  };

  // Listen for messages from content script
  window.addEventListener('message', function(event) {
    if (event.source !== window) return;

    if (event.data.type === 'WEB_MEMORY_HIGHLIGHT') {
      handleHighlightMessage(event.data);
    }
  });

  // Handle highlight messages
  function handleHighlightMessage(data) {
    switch (data.action) {
      case 'highlight':
        highlightText(data.text, data.options);
        break;
      case 'clear':
        clearHighlights();
        break;
      case 'scroll':
        scrollToHighlight(data.index);
        break;
    }
  }

  // Main highlighting function
  function highlightText(text, options = {}) {
    clearHighlights(); // Clear existing highlights

    const {
      style = 'default',
      caseSensitive = false,
      wholeWord = false,
      maxHighlights = 50
    } = options;

    const searchRegex = createSearchRegex(text, caseSensitive, wholeWord);
    if (!searchRegex) return 0;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Skip script, style, and other non-content elements
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          const tagName = parent.tagName.toLowerCase();
          if (['script', 'style', 'noscript', 'iframe', 'object', 'embed'].includes(tagName)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Skip already highlighted elements
          if (parent.classList.contains('web-memory-highlight')) {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    let highlightCount = 0;

    for (const textNode of textNodes) {
      if (highlightCount >= maxHighlights) break;

      const matches = findMatchesInTextNode(textNode, searchRegex);
      for (const match of matches) {
        if (highlightCount >= maxHighlights) break;

        const highlight = createHighlight(textNode, match, style);
        if (highlight) {
          currentHighlights.push(highlight);
          highlightCount++;
        }
      }
    }

    // Scroll to first highlight
    if (currentHighlights.length > 0) {
      scrollToHighlight(0);
    }

    console.log(`Highlighted ${highlightCount} occurrences of "${text}"`);
    return highlightCount;
  }

  // Create search regex
  function createSearchRegex(text, caseSensitive, wholeWord) {
    if (!text || text.length === 0) return null;

    let escapedText = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    if (wholeWord) {
      escapedText = `\\b${escapedText}\\b`;
    }

    const flags = caseSensitive ? 'g' : 'gi';
    try {
      return new RegExp(escapedText, flags);
    } catch (error) {
      console.error('Invalid regex:', error);
      return null;
    }
  }

  // Find matches in a text node
  function findMatchesInTextNode(textNode, regex) {
    const matches = [];
    const text = textNode.textContent;
    let match;

    // Reset regex lastIndex
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0]
      });

      // Prevent infinite loops for zero-length matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }

    return matches;
  }

  // Create highlight element for a match
  function createHighlight(textNode, match, style) {
    try {
      const parent = textNode.parentNode;
      const beforeText = textNode.textContent.substring(0, match.start);
      const matchText = textNode.textContent.substring(match.start, match.end);
      const afterText = textNode.textContent.substring(match.end);

      // Create highlight span
      const highlightSpan = document.createElement('span');
      highlightSpan.className = 'web-memory-highlight';
      highlightSpan.style.cssText = highlightStyles[style] || highlightStyles.default;
      highlightSpan.setAttribute('data-highlight-text', matchText);
      highlightSpan.setAttribute('data-highlight-index', currentHighlights.length);

      // Create text nodes for before and after text
      const beforeNode = document.createTextNode(beforeText);
      const afterNode = document.createTextNode(afterText);

      // Replace original text node with new structure
      if (beforeText || afterText) {
        // Split the text node
        if (beforeText) {
          parent.insertBefore(beforeNode, textNode);
        }
        parent.insertBefore(highlightSpan, textNode);
        if (afterText) {
          parent.insertBefore(afterNode, textNode);
        }
        parent.removeChild(textNode);
      } else {
        // Entire node is highlighted
        parent.replaceChild(highlightSpan, textNode);
      }

      // Add match text to highlight
      highlightSpan.appendChild(document.createTextNode(matchText));

      return {
        element: highlightSpan,
        text: matchText,
        index: currentHighlights.length
      };

    } catch (error) {
      console.error('Error creating highlight:', error);
      return null;
    }
  }

  // Clear all highlights
  function clearHighlights() {
    const highlights = document.querySelectorAll('.web-memory-highlight');

    highlights.forEach(highlight => {
      const parent = highlight.parentNode;
      const text = highlight.textContent;

      // Replace highlight with plain text
      const textNode = document.createTextNode(text);
      parent.replaceChild(textNode, highlight);

      // Normalize parent to merge adjacent text nodes
      parent.normalize();
    });

    currentHighlights = [];
  }

  // Scroll to specific highlight
  function scrollToHighlight(index) {
    const highlight = currentHighlights[index];
    if (!highlight || !highlight.element) return;

    try {
      highlight.element.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });

      // Add brief animation to draw attention
      highlight.element.style.transition = 'transform 0.3s ease';
      highlight.element.style.transform = 'scale(1.1)';

      setTimeout(() => {
        if (highlight.element) {
          highlight.element.style.transform = 'scale(1)';
        }
      }, 300);

    } catch (error) {
      console.error('Error scrolling to highlight:', error);
    }
  }

  // Advanced highlighting with context awareness
  function highlightWithContext(text, contextWords = 2) {
    clearHighlights();

    const searchRegex = createSearchRegex(text, false, false);
    if (!searchRegex) return 0;

    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }

    let highlightCount = 0;

    for (const textNode of textNodes) {
      const matches = findMatchesInTextNode(textNode, searchRegex);
      for (const match of matches) {
        // Get context around the match
        const fullText = textNode.textContent;
        const contextStart = Math.max(0, match.start - contextWords * 10);
        const contextEnd = Math.min(fullText.length, match.end + contextWords * 10);

        const context = fullText.substring(contextStart, contextEnd);
        const contextHighlight = createContextHighlight(textNode, match, contextStart, contextEnd);

        if (contextHighlight) {
          currentHighlights.push(contextHighlight);
          highlightCount++;
        }
      }
    }

    return highlightCount;
  }

  // Create highlight with context
  function createContextHighlight(textNode, match, contextStart, contextEnd) {
    try {
      const parent = textNode.parentNode;
      const fullText = textNode.textContent;

      // Create highlight container
      const container = document.createElement('div');
      container.className = 'web-memory-highlight-context';
      container.style.cssText = `
        margin: 4px 0;
        padding: 8px;
        background-color: #f5f5f5;
        border-left: 4px solid #ffeb3b;
        border-radius: 4px;
        font-family: monospace;
        white-space: pre-wrap;
        word-break: break-word;
      `;

      // Create context text with highlighted match
      const beforeText = fullText.substring(contextStart, match.start);
      const matchText = fullText.substring(match.start, match.end);
      const afterText = fullText.substring(match.end, contextEnd);

      container.appendChild(document.createTextNode('...' + beforeText));

      const highlightSpan = document.createElement('span');
      highlightSpan.style.cssText = highlightStyles.search;
      highlightSpan.textContent = matchText;
      container.appendChild(highlightSpan);

      container.appendChild(document.createTextNode(afterText + '...'));

      // Replace original text node
      parent.replaceChild(container, textNode);

      return {
        element: container,
        text: matchText,
        index: currentHighlights.length
      };

    } catch (error) {
      console.error('Error creating context highlight:', error);
      return null;
    }
  }

  // Keyboard navigation for highlights
  function setupKeyboardNavigation() {
    document.addEventListener('keydown', function(event) {
      // Ctrl+Shift+N for next highlight
      if (event.ctrlKey && event.shiftKey && event.key === 'N') {
        event.preventDefault();
        navigateHighlights('next');
      }

      // Ctrl+Shift+P for previous highlight
      if (event.ctrlKey && event.shiftKey && event.key === 'P') {
        event.preventDefault();
        navigateHighlights('previous');
      }

      // Escape to clear highlights
      if (event.key === 'Escape' && event.ctrlKey) {
        event.preventDefault();
        clearHighlights();
      }
    });
  }

  // Navigate between highlights
  function navigateHighlights(direction) {
    if (currentHighlights.length === 0) return;

    // Find currently focused highlight
    let currentIndex = -1;
    if (document.activeElement && document.activeElement.classList.contains('web-memory-highlight')) {
      currentIndex = parseInt(document.activeElement.getAttribute('data-highlight-index')) || 0;
    }

    let nextIndex;
    if (direction === 'next') {
      nextIndex = (currentIndex + 1) % currentHighlights.length;
    } else {
      nextIndex = currentIndex <= 0 ? currentHighlights.length - 1 : currentIndex - 1;
    }

    scrollToHighlight(nextIndex);
  }

  // Export highlighting functions for external use
  window.WebMemoryHighlight = {
    highlight: highlightText,
    highlightWithContext: highlightWithContext,
    clear: clearHighlights,
    scrollTo: scrollToHighlight,
    setupKeyboardNavigation: setupKeyboardNavigation,
    getHighlights: () => currentHighlights.slice()
  };

  // Setup keyboard navigation
  setupKeyboardNavigation();

  console.log('Web Memory Highlight script loaded');

})();