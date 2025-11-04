// Popup script - handles UI interactions and communication with background script
class WebMemoryPopup {
  constructor() {
    this.currentResults = [];
    this.searchHistory = [];
    this.isLoading = false;

    this.initializeElements();
    this.attachEventListeners();
    this.loadInitialData();
  }

  initializeElements() {
    this.searchInput = document.getElementById('searchInput');
    this.searchButton = document.getElementById('searchButton');
    this.contentTypeFilter = document.getElementById('contentTypeFilter');
    this.dateFilter = document.getElementById('dateFilter');
    this.resultsContainer = document.getElementById('resultsContainer');
    this.resultsCount = document.getElementById('resultsCount');
    this.totalPages = document.getElementById('totalPages');
    this.totalSearches = document.getElementById('totalSearches');
    this.messageContainer = document.getElementById('messageContainer');
    this.exportButton = document.getElementById('exportButton');
    this.settingsButton = document.getElementById('settingsButton');

    // Settings panel elements
    this.settingsPanel = document.getElementById('settingsPanel');
    this.geminiApiKey = document.getElementById('geminiApiKey');
    this.geminiModel = document.getElementById('geminiModel');
    this.saveSettings = document.getElementById('saveSettings');
    this.cancelSettings = document.getElementById('cancelSettings');
    this.forceIndex = document.getElementById('forceIndex');
  }

  attachEventListeners() {
    this.forceIndex.addEventListener('click', async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Inject content script manually
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Force run page processor
            if (typeof extractAdvancedPageContent === 'function') {
              extractAdvancedPageContent().then(pageData => {
                window.postMessage({
                  type: 'WEB_MEMORY_PAGE_DATA',
                  data: pageData
                }, '*');
              });
            }
          }
        });
        
        this.showMessage('🎯 Force indexing triggered!', 'success');
      } catch (error) {
        this.showMessage('Force indexing failed: ' + error.message, 'error');
      }
    });
    // Search functionality
    this.searchButton.addEventListener('click', () => this.performSearch());
    this.searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.performSearch();
    });

    // Real-time search with debouncing
    this.searchInput.addEventListener('input', this.debounce(() => {
      if (this.searchInput.value.trim()) {
        this.performSearch();
      }
    }, 500));

    // Filters
    this.contentTypeFilter.addEventListener('change', () => {
      if (this.currentResults.length > 0) {
        this.filterResults();
      }
    });

    this.dateFilter.addEventListener('change', () => {
      if (this.currentResults.length > 0) {
        this.filterResults();
      }
    });

    // Actions
    this.indexCurrentPageButton = document.getElementById('indexCurrentPage');
    this.exportButton.addEventListener('click', () => this.exportData());
    this.settingsButton.addEventListener('click', () => this.toggleSettingsPanel());
    this.indexCurrentPageButton.addEventListener('click', () => this.indexCurrentPage());

    // Settings panel actions
    this.saveSettings.addEventListener('click', () => this.saveGeminiSettings());
    this.cancelSettings.addEventListener('click', () => this.hideSettingsPanel());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        this.searchInput.focus();
      }
    });
  }

  async loadInitialData() {
    try {
      // Load statistics
      const response = await chrome.runtime.sendMessage({
        type: 'GET_MEMORY_STATS'
      });

      if (response && response.stats) {
        this.updateStats(response.stats);
      }

      // Load recent searches
      const recentSearches = await this.getRecentSearches();
      this.searchHistory = recentSearches;

    } catch (error) {
      console.error('Failed to load initial data:', error);
      this.showMessage('Failed to load initial data', 'error');
    }
  }

  async performSearch() {
    const query = this.searchInput.value.trim();
    if (!query) return;

    if (this.isLoading) return;

    try {
      this.setLoading(true);
      this.clearMessage();

      // Send search request to background script
      console.log('Sending search request for:', query);
      const response = await chrome.runtime.sendMessage({
        type: 'SEARCH_QUERY',
        query: query
      });

      console.log('Search response received:', response);

      if (response && response.results) {
        console.log('Displaying', response.results.length, 'results');
        this.currentResults = response.results;
        this.displayResults(response.results);
        this.updateSearchCount();

        // Store search in history
        this.addToSearchHistory(query);
      } else {
        console.log('No results in response, showing empty state');
        this.currentResults = [];
        this.displayNoResults(query);
      }

    } catch (error) {
      console.error('Search error:', error);
      this.showMessage('Search failed: ' + error.message, 'error');
      this.displayNoResults(query);
    } finally {
      this.setLoading(false);
    }
  }

  displayResults(results) {
    console.log('displayResults called with:', results.length, 'results');

    if (results.length === 0) {
      console.log('No results to display, calling displayNoResults');
      this.displayNoResults(this.searchInput.value);
      return;
    }

    const resultsHtml = results.map((result, index) => this.createResultItem(result, index)).join('');
    console.log('Generated HTML length:', resultsHtml.length);

    this.resultsContainer.innerHTML = resultsHtml;
    this.resultsCount.textContent = `${results.length} result${results.length !== 1 ? 's' : ''}`;
    console.log('Results container updated with HTML');

    // Add click handlers to result items
    this.attachResultHandlers();
    console.log('Click handlers attached');
  }

  createResultItem(result, index) {
    const url = new URL(result.url);
    const domain = url.hostname.replace('www.', '');
    const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;

    return `
      <div class="result-item" data-index="${index}" data-url="${result.url}">
        <div class="result-title">${this.escapeHtml(result.title)}</div>
        <a href="${result.url}" class="result-url" target="_blank">
          <img src="${favicon}" alt="" style="width: 12px; height: 12px; margin-right: 4px;">
          ${url.href}
        </a>
        <div class="result-snippet">${this.escapeHtml(result.snippet)}</div>
        <div class="result-meta">
          <div class="result-score">${Math.round(result.score * 100)}% match</div>
          <div class="result-actions">
            <button class="action-button highlight-button" data-index="${index}">
              🔍 Open & Highlight
            </button>
          </div>
        </div>
      </div>
    `;
  }

  attachResultHandlers() {
    const resultItems = this.resultsContainer.querySelectorAll('.result-item');
    const highlightButtons = this.resultsContainer.querySelectorAll('.highlight-button');

    resultItems.forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.classList.contains('action-button')) {
          const url = item.dataset.url;
          this.openUrl(url);
        }
      });
    });

    highlightButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const index = parseInt(button.dataset.index);
        this.openAndHighlight(index);
      });
    });
  }

  async openUrl(url) {
    try {
      await chrome.tabs.create({ url });
      window.close();
    } catch (error) {
      console.error('Failed to open URL:', error);
      this.showMessage('Failed to open page', 'error');
    }
  }

  async openAndHighlight(resultIndex) {
    const result = this.currentResults[resultIndex];
    if (!result) return;

    try {
      // Get current tab or create new one
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (currentTab && currentTab.url === result.url) {
        // Highlight in current tab
        await this.highlightInTab(currentTab.id, this.searchInput.value);
        window.close();
      } else {
        // Open new tab and highlight
        const newTab = await chrome.tabs.create({ url: result.url, active: true });

        // Wait for tab to load, then highlight
        const checkTabLoaded = async () => {
          try {
            const tab = await chrome.tabs.get(newTab.id);
            if (tab.status === 'complete') {
              await this.highlightInTab(tab.id, this.searchInput.value);
            } else {
              setTimeout(checkTabLoaded, 500);
            }
          } catch (error) {
            console.error('Error checking tab status:', error);
          }
        };

        setTimeout(checkTabLoaded, 1000);
        window.close();
      }

    } catch (error) {
      console.error('Failed to open and highlight:', error);
      this.showMessage('Failed to open page', 'error');
    }
  }

  async highlightInTab(tabId, text) {
    try {
      await chrome.runtime.sendMessage({
        type: 'HIGHLIGHT_TEXT',
        tabId: tabId,
        text: text
      });
    } catch (error) {
      console.error('Failed to highlight:', error);
    }
  }

  displayNoResults(query) {
    this.resultsContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">😔</div>
        <div class="empty-title">No Results Found</div>
        <div class="empty-text">
          No pages found matching "<strong>${this.escapeHtml(query)}</strong>".<br>
          Try browsing more pages or use different keywords.
        </div>
      </div>
    `;
    this.resultsCount.textContent = '0 results';
  }

  filterResults() {
    const contentType = this.contentTypeFilter.value;
    const dateFilter = this.dateFilter.value;

    let filteredResults = [...this.currentResults];

    // Filter by content type
    if (contentType) {
      filteredResults = filteredResults.filter(result => {
        // This would need content type metadata from memory
        return true; // Placeholder
      });
    }

    // Filter by date
    if (dateFilter) {
      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;

      filteredResults = filteredResults.filter(result => {
        const resultAge = now - result.timestamp;
        switch (dateFilter) {
          case 'today':
            return resultAge < dayMs;
          case 'week':
            return resultAge < 7 * dayMs;
          case 'month':
            return resultAge < 30 * dayMs;
          default:
            return true;
        }
      });
    }

    // Display filtered results
    this.displayResults(filteredResults);
  }

  setLoading(loading) {
    this.isLoading = loading;
    this.searchButton.disabled = loading;

    if (loading) {
      this.resultsContainer.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          <div>Searching your web memory...</div>
        </div>
      `;
      this.resultsCount.textContent = 'Searching...';
    }
  }

  updateStats(stats) {
    if (stats.totalMemories !== undefined) {
      this.totalPages.textContent = stats.totalMemories.toLocaleString();
    }
  }

  updateSearchCount() {
    // This would track total searches across sessions
    const currentCount = parseInt(this.totalSearches.textContent) || 0;
    this.totalSearches.textContent = currentCount + 1;
  }

  async exportData() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'EXPORT_INDEX'
      });

      if (response && response.downloadUrl) {
        const link = document.createElement('a');
        link.href = response.downloadUrl;
        link.download = `web-memory-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(response.downloadUrl);
        this.showMessage('Data exported successfully!', 'success');
      }
    } catch (error) {
      console.error('Export error:', error);
      this.showMessage('Export failed: ' + error.message, 'error');
    }
  }

  openSettings() {
    // This would open a settings page or modal
    this.showMessage('Settings page coming soon!', 'success');
  }

  showMessage(message, type = 'info') {
    const messageHtml = `
      <div class="${type}-message">
        ${message}
      </div>
    `;
    this.messageContainer.innerHTML = messageHtml;

    // Auto-hide after 3 seconds
    setTimeout(() => {
      this.clearMessage();
    }, 3000);
  }

  clearMessage() {
    this.messageContainer.innerHTML = '';
  }

  async addToSearchHistory(query) {
    const searchEntry = {
      query,
      timestamp: Date.now(),
      resultCount: this.currentResults.length
    };

    this.searchHistory.unshift(searchEntry);
    this.searchHistory = this.searchHistory.slice(0, 50); // Keep only recent 50

    try {
      await chrome.storage.local.set({
        searchHistory: this.searchHistory
      });
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }

  async getRecentSearches() {
    try {
      const result = await chrome.storage.local.get('searchHistory');
      return result.searchHistory || [];
    } catch (error) {
      console.error('Failed to get search history:', error);
      return [];
    }
  }

  // Utility functions
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Auto-focus search input when popup opens
  focusSearch() {
    setTimeout(() => {
      this.searchInput.focus();
    }, 100);
  }

  // Settings panel methods
  async toggleSettingsPanel() {
    if (this.settingsPanel.style.display === 'none') {
      await this.loadSettings();
      this.showSettingsPanel();
    } else {
      this.hideSettingsPanel();
    }
  }

  showSettingsPanel() {
    this.settingsPanel.style.display = 'block';
    this.settingsButton.textContent = '🔍 Search'; // Change button text
  }

  hideSettingsPanel() {
    this.settingsPanel.style.display = 'none';
    this.settingsButton.textContent = '⚙️ Settings'; // Restore button text
  }

  async loadSettings() {
  try {
    const result = await chrome.storage.local.get('embeddingSettings');
    const settings = result.embeddingSettings || {
      embeddingProvider: 'gemini',
      apiKey: '',
      model: 'gemini-embedding-001'
    };

    this.geminiApiKey.value = settings.apiKey || '';
    this.geminiModel.value = settings.model || 'gemini-embedding-001';
    console.log('📋 Loaded 3072D settings:', settings);
  } catch (error) {
    console.error('Failed to load 3072D settings:', error);
  }
}

async saveGeminiSettings() {
  try {
    const apiKey = this.geminiApiKey.value.trim();
    const model = this.geminiModel.value;

    if (!apiKey) {
      this.showMessage('Please enter a Gemini API key', 'error');
      return;
    }

    const settings = {
      embeddingProvider: 'gemini',
      apiKey: apiKey,
      model: model,
      dimensions: model === 'gemini-embedding-001' ? 3072 : 768
    };

    await chrome.storage.local.set({ embeddingSettings: settings });

    await chrome.runtime.sendMessage({
      type: 'UPDATE_EMBEDDING_SETTINGS',
      settings: settings
    });

    this.showMessage(`✅ Gemini ${model} (3072D) settings saved!`, 'success');
    this.hideSettingsPanel();

  } catch (error) {
    console.error('Failed to save 3072D settings:', error);
    this.showMessage('Save failed: ' + error.message, 'error');
  }
}

  async indexCurrentPage() {
    try {
      this.setLoading(true);
      this.clearMessage();

      // Get current active tab
      const [currentTab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!currentTab) {
        this.showMessage('No active tab found', 'error');
        return;
      }

      // Send request to background script to index current page
      const response = await chrome.runtime.sendMessage({
        type: 'INDEX_CURRENT_PAGE',
        tabId: currentTab.id
      });

      if (response && response.success) {
        this.showMessage('Current page indexed successfully!', 'success');

        // Refresh stats after a short delay
        setTimeout(() => {
          this.loadInitialData();
        }, 2000);
      } else {
        this.showMessage('Failed to index current page', 'error');
      }

    } catch (error) {
      console.error('Index current page error:', error);
      this.showMessage('Failed to index page: ' + error.message, 'error');
    } finally {
      this.setLoading(false);
    }
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const popup = new WebMemoryPopup();
  popup.focusSearch();
});

// Handle popup close
window.addEventListener('beforeunload', () => {
  // Cleanup if needed
});