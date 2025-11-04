// Action module - handle tool execution and web page interactions
export class ActionModule {
  constructor() {
    this.highlightManager = new HighlightManager();
    this.navigationManager = new NavigationManager();
    this.searchManager = new SearchManager();
  }

  // Execute search action
  async executeSearch(query, options = {}) {
    try {
      const results = await this.searchManager.performSearch(query, options);
      return new ToolCallResult({
        success: true,
        action: 'search',
        query,
        results,
        timestamp: Date.now()
      });
    } catch (error) {
      return new ToolCallResult({
        success: false,
        action: 'search',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  // Execute navigation action
  async executeNavigation(url, highlightText = null) {
    try {
      const result = await this.navigationManager.navigateTo(url, highlightText);
      return new ToolCallResult({
        success: true,
        action: 'navigation',
        url,
        highlighted: highlightText ? true : false,
        timestamp: Date.now()
      });
    } catch (error) {
      return new ToolCallResult({
        success: false,
        action: 'navigation',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  // Execute highlight action
  async executeHighlight(tabId, text, options = {}) {
    try {
      const result = await this.highlightManager.highlightText(tabId, text, options);
      return new ToolCallResult({
        success: true,
        action: 'highlight',
        tabId,
        text,
        highlightedCount: result.count,
        timestamp: Date.now()
      });
    } catch (error) {
      return new ToolCallResult({
        success: false,
        action: 'highlight',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  // Execute tool function calls
  async executeTool(functionCall) {
    const { functionName, parameters } = this.parseFunctionCall(functionCall);

    switch (functionName) {
      case 'search_web_memory':
        return await this.executeSearch(parameters.query, parameters.options);

      case 'navigate_to_page':
        return await this.executeNavigation(parameters.url, parameters.highlightText);

      case 'highlight_text':
        return await this.executeHighlight(parameters.tabId, parameters.text, parameters.options);

      case 'get_page_info':
        return await this.getPageInfo(parameters.tabId);

      case 'bookmark_page':
        return await this.bookmarkPage(parameters.url, parameters.title);

      default:
        throw new Error(`Unknown function: ${functionName}`);
    }
  }

  // Parse function call string
  parseFunctionCall(functionCall) {
    try {
      // Extract function name and parameters
      const match = functionCall.match(/(\w+)\((.*)\)/);
      if (!match) {
        throw new Error('Invalid function call format');
      }

      const functionName = match[1];
      const paramString = match[2];

      // Parse parameters (simple JSON parsing for now)
      let parameters = {};
      if (paramString.trim()) {
        try {
          parameters = JSON.parse(paramString);
        } catch (e) {
          // Fallback for simple key=value pairs
          parameters = this.parseSimpleParameters(paramString);
        }
      }

      return { functionName, parameters };
    } catch (error) {
      console.error('Function call parsing error:', error);
      throw new Error(`Failed to parse function call: ${functionCall}`);
    }
  }

  parseSimpleParameters(paramString) {
    const params = {};
    const pairs = paramString.split(',');

    pairs.forEach(pair => {
      const [key, ...valueParts] = pair.trim().split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim();
        params[key.trim()] = value.replace(/['"]/g, ''); // Remove quotes
      }
    });

    return params;
  }

  // Get page information
  async getPageInfo(tabId) {
    try {
      const [tab] = await chrome.tabs.get(tabId);

      // Inject content script to get page info
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return {
            title: document.title,
            url: window.location.href,
            contentLength: document.body.innerText.length,
            headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim()),
            links: document.querySelectorAll('a').length,
            images: document.querySelectorAll('img').length
          };
        }
      });

      return new ToolCallResult({
        success: true,
        action: 'get_page_info',
        data: results[0].result,
        timestamp: Date.now()
      });
    } catch (error) {
      return new ToolCallResult({
        success: false,
        action: 'get_page_info',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }

  // Bookmark page
  async bookmarkPage(url, title) {
    try {
      const bookmark = await chrome.bookmarks.create({
        url,
        title: title || 'Untitled Page'
      });

      return new ToolCallResult({
        success: true,
        action: 'bookmark_page',
        bookmark,
        timestamp: Date.now()
      });
    } catch (error) {
      return new ToolCallResult({
        success: false,
        action: 'bookmark_page',
        error: error.message,
        timestamp: Date.now()
      });
    }
  }
}

// Tool call result class
class ToolCallResult {
  constructor(data) {
    this.success = data.success || false;
    this.action = data.action;
    this.data = data.data || null;
    this.results = data.results || [];
    this.error = data.error || null;
    this.timestamp = data.timestamp || Date.now();
  }

  // Get formatted result
  getFormattedResult() {
    if (this.success) {
      return `✓ ${this.action} completed successfully`;
    } else {
      return `✗ ${this.action} failed: ${this.error}`;
    }
  }

  // Get result summary
  getSummary() {
    switch (this.action) {
      case 'search':
        return `Found ${this.results.length} results`;
      case 'navigation':
        return `Navigated to ${this.data?.url || 'page'}`;
      case 'highlight':
        return `Highlighted ${this.highlightedCount || 0} instances`;
      case 'get_page_info':
        return `Retrieved page information`;
      case 'bookmark_page':
        return `Page bookmarked successfully`;
      default:
        return this.getFormattedResult();
    }
  }
}

// Highlight manager for text highlighting
class HighlightManager {
  constructor() {
    this.highlightStyles = {
      default: {
        backgroundColor: '#ffeb3b',
        color: '#000',
        padding: '2px 4px',
        borderRadius: '3px'
      },
      search: {
        backgroundColor: '#4caf50',
        color: '#fff',
        padding: '2px 4px',
        borderRadius: '3px'
      },
      important: {
        backgroundColor: '#f44336',
        color: '#fff',
        padding: '2px 4px',
        borderRadius: '3px'
      }
    };
  }

  async highlightText(tabId, text, options = {}) {
    const { style = 'default', caseSensitive = false, wholeWord = false } = options;

    try {
      // Inject highlighting script
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['highlight.js']
      });

      // Send highlight message
      const results = await chrome.tabs.sendMessage(tabId, {
        type: 'HIGHLIGHT_TEXT',
        text,
        options: { style: this.highlightStyles[style], caseSensitive, wholeWord }
      });

      return { count: results?.count || 0 };
    } catch (error) {
      console.error('Highlight error:', error);
      throw error;
    }
  }

  async clearHighlights(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'CLEAR_HIGHLIGHTS'
      });
      return true;
    } catch (error) {
      console.error('Clear highlights error:', error);
      throw error;
    }
  }

  async scrollToHighlight(tabId, index = 0) {
    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'SCROLL_TO_HIGHLIGHT',
        index
      });
      return true;
    } catch (error) {
      console.error('Scroll to highlight error:', error);
      throw error;
    }
  }
}

// Navigation manager for page navigation
class NavigationManager {
  async navigateTo(url, highlightText = null) {
    try {
      // Check if tab with this URL already exists
      const tabs = await chrome.tabs.query({});
      const existingTab = tabs.find(tab => tab.url === url);

      let tab;
      if (existingTab) {
        // Switch to existing tab
        tab = await chrome.tabs.update(existingTab.id, { active: true });
      } else {
        // Create new tab
        tab = await chrome.tabs.create({ url });
      }

      // Wait for tab to load
      await this.waitForTabLoad(tab.id);

      // Highlight text if specified
      if (highlightText) {
        const highlightManager = new HighlightManager();
        await highlightManager.highlightText(tab.id, highlightText, { style: 'search' });
      }

      return { tabId: tab.id, created: !existingTab };
    } catch (error) {
      console.error('Navigation error:', error);
      throw error;
    }
  }

  async waitForTabLoad(tabId, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkTab = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);

          if (tab.status === 'complete') {
            resolve(tab);
          } else if (Date.now() - startTime > timeout) {
            reject(new Error('Tab loading timeout'));
          } else {
            setTimeout(checkTab, 500);
          }
        } catch (error) {
          reject(error);
        }
      };

      checkTab();
    });
  }

  async getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async getAllTabs() {
    return await chrome.tabs.query({});
  }
}

// Search manager for web memory search
class SearchManager {
  constructor() {
    this.searchHistory = [];
  }

  async performSearch(query, options = {}) {
    const { limit = 10, type = null, minScore = 0.3 } = options;

    try {
      // Send search request to background script
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_QUERY',
        query,
        options: { limit, type, minScore }
      });

      // Store in search history
      this.searchHistory.push({
        query,
        results: response.results,
        timestamp: Date.now()
      });

      // Keep only last 50 searches
      if (this.searchHistory.length > 50) {
        this.searchHistory = this.searchHistory.slice(-50);
      }

      return response.results || [];
    } catch (error) {
      console.error('Search error:', error);
      throw error;
    }
  }

  getSearchHistory() {
    return this.searchHistory;
  }

  clearSearchHistory() {
    this.searchHistory = [];
  }

  // Advanced search with filters
  async advancedSearch(query, filters = {}) {
    const {
      dateRange = null,
      contentType = null,
      minScore = 0.3,
      excludeSites = [],
      includeSites = []
    } = filters;

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ADVANCED_SEARCH',
        query,
        filters: {
          dateRange,
          contentType,
          minScore,
          excludeSites,
          includeSites
        }
      });

      return response.results || [];
    } catch (error) {
      console.error('Advanced search error:', error);
      throw error;
    }
  }
}