// Main Agent - orchestrates all components
import { PerceptionModule } from './perception.js';
import { DecisionModule } from './decision.js';
import { ActionModule } from './action.js';

export class Agent {
  constructor(memoryManager) {
    this.memoryManager = memoryManager;
    this.perception = new PerceptionModule();
    this.decision = new DecisionModule();
    this.action = new ActionModule();
    this.currentPlan = null;
    this.executionHistory = [];
    this.maxExecutionSteps = 5;
  }

  // Main processing loop
  async processQuery(query, context = {}) {
    try {
      console.log(`Processing query: ${query}`);

      // Step 1: Extract user intent and perception
      const perceptionResult = await this.extractPerception(query, context);

      // Step 2: Retrieve relevant memories
      const relevantMemories = await this.retrieveMemories(query, perceptionResult);

      // Step 3: Generate execution plan
      const plan = await this.generatePlan(query, perceptionResult, relevantMemories, context);

      // Step 4: Execute plan
      const executionResult = await this.executePlan(plan, context);

      // Step 5: Store interaction in memory
      await this.storeInteraction(query, perceptionResult, executionResult);

      return executionResult;

    } catch (error) {
      console.error('Query processing error:', error);
      return {
        success: false,
        error: error.message,
        query,
        timestamp: Date.now()
      };
    }
  }

  // Step 1: Extract perception
  async extractPerception(query, context) {
    try {
      // Get current page information if available
      let pagePerception = null;
      if (context.currentUrl) {
        // For now, we'll create a basic perception
        pagePerception = {
          url: context.currentUrl,
          intent: 'context_aware',
          entities: [],
          keywords: [],
          contentType: 'unknown',
          summary: '',
          importance: 0.5
        };
      }

      // Analyze user query
      const queryAnalysis = await this.perception.analyzeUserQuery(query);

      return {
        query,
        queryAnalysis,
        pageContext: pagePerception,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Perception extraction error:', error);
      return {
        query,
        queryAnalysis: { intent: 'unknown', keywords: [] },
        timestamp: Date.now()
      };
    }
  }

  // Step 2: Retrieve memories
  async retrieveMemories(query, perceptionResult) {
    try {
      if (!this.memoryManager) {
        console.warn('Memory manager not initialized');
        return [];
      }

      // Search for relevant memories
      const memories = await this.memoryManager.search(query, {
        limit: 10,
        type: 'web_page',
        minScore: 0.3
      });

      console.log(`Found ${memories.length} relevant memories`);
      return memories;

    } catch (error) {
      console.error('Memory retrieval error:', error);
      return [];
    }
  }

  // Step 3: Generate plan
  async generatePlan(query, perceptionResult, memories, context) {
    try {
      const plan = await this.decision.generatePlan(
        query,
        perceptionResult,
        memories,
        context
      );

      this.currentPlan = plan;
      console.log(`Generated plan: ${plan.type} with ${plan.steps.length} steps`);

      return plan;

    } catch (error) {
      console.error('Plan generation error:', error);
      // Use fallback plan
      this.currentPlan = this.decision.createFallbackPlan(query);
      return this.currentPlan;
    }
  }

  // Step 4: Execute plan
  async executePlan(plan, context) {
    const executionResults = [];
    let currentStepId = plan.steps[0]?.id;

    try {
      for (let attempt = 0; attempt < this.maxExecutionSteps; attempt++) {
        if (!currentStepId) break;

        // Get current step
        const currentStep = plan.steps.find(s => s.id === currentStepId);
        if (!currentStep) break;

        console.log(`Executing step: ${currentStep.type} - ${currentStep.description}`);

        // Decide next action
        const decision = await this.decision.decideNextAction(
          plan,
          currentStepId,
          executionResults,
          { ...context, actionModule: this.action }
        );

        // Execute action
        let stepResult;
        switch (decision.action) {
          case 'execute':
            stepResult = decision.result;
            executionResults.push({
              stepId: currentStepId,
              success: stepResult.success,
              data: stepResult.data || stepResult.results,
              error: stepResult.error
            });
            break;

          case 'complete':
            return this.createExecutionResult(plan, executionResults, true);

          case 'error':
            executionResults.push({
              stepId: currentStepId,
              success: false,
              error: decision.error
            });
            // Continue with next step or fail
            break;

          case 'wait':
            // Wait for dependencies and retry
            await new Promise(resolve => setTimeout(resolve, 500));
            continue;

          default:
            throw new Error(`Unknown decision action: ${decision.action}`);
        }

        // Move to next step
        currentStepId = decision.nextStep;

        // Add delay between steps for better UX
        if (currentStepId) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }

      return this.createExecutionResult(plan, executionResults, false);

    } catch (error) {
      console.error('Plan execution error:', error);
      return this.createExecutionResult(plan, executionResults, false, error);
    }
  }

  // Create execution result
  createExecutionResult(plan, executionResults, success, error = null) {
    const result = {
      success,
      plan: {
        id: plan.id,
        type: plan.type,
        query: plan.query
      },
      stepsExecuted: executionResults.length,
      totalSteps: plan.steps.length,
      results: [],
      timestamp: Date.now()
    };

    // Collect results from execution
    executionResults.forEach(stepResult => {
      if (stepResult.success && stepResult.data) {
        result.results.push(...(Array.isArray(stepResult.data) ? stepResult.data : [stepResult.data]));
      }
    });

    // Add error if present
    if (error) {
      result.error = error.message;
    }

    // Store in execution history
    this.executionHistory.push(result);

    // Keep history limited
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100);
    }

    return result;
  }

  // Step 5: Store interaction
  async storeInteraction(query, perceptionResult, executionResult) {
    try {
      if (!this.memoryManager) return;

      // Store as query interaction
      await this.memoryManager.addMemory({
        type: 'query',
        content: query,
        metadata: {
          timestamp: Date.now(),
          intent: perceptionResult.queryAnalysis?.intent || 'unknown',
          success: executionResult.success,
          resultCount: executionResult.results?.length || 0
        },
        tags: ['user_query', perceptionResult.queryAnalysis?.intent].filter(Boolean)
      });

      // Store successful results for future reference
      if (executionResult.success && executionResult.results.length > 0) {
        for (const result of executionResult.results) {
          if (result.url) {
            await this.memoryManager.addMemory({
              type: 'search_result',
              content: `${result.title || 'Untitled'} - ${result.snippet || ''}`,
              metadata: {
                url: result.url,
                title: result.title,
                snippet: result.snippet,
                score: result.score,
                timestamp: Date.now(),
                query: query
              },
              tags: ['search_result', 'user_query']
            });
          }
        }
      }

    } catch (error) {
      console.error('Interaction storage error:', error);
    }
  }

  // Get agent statistics
  async getStats() {
    const memoryStats = this.memoryManager ? await this.memoryManager.getStats() : null;

    return {
      totalQueries: this.executionHistory.length,
      successfulQueries: this.executionHistory.filter(r => r.success).length,
      currentPlan: this.currentPlan?.type || null,
      memoryStats,
      lastActivity: this.executionHistory.length > 0 ?
        this.executionHistory[this.executionHistory.length - 1].timestamp : null
    };
  }

  // Search web memory (direct search without full planning)
  async searchWebMemory(query, options = {}) {
    try {
      if (!this.memoryManager) {
        throw new Error('Memory manager not available');
      }

      const results = await this.memoryManager.search(query, options);

      // Store search interaction
      await this.memoryManager.addMemory({
        type: 'search_query',
        content: query,
        metadata: {
          timestamp: Date.now(),
          resultCount: results.length,
          options: options
        },
        tags: ['search', 'user_query']
      });

      return {
        success: true,
        query,
        results,
        count: results.length,
        timestamp: Date.now()
      };

    } catch (error) {
      console.error('Direct search error:', error);
      return {
        success: false,
        query,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Navigate to page with highlighting
  async navigateToPage(url, highlightText = null) {
    try {
      const result = await this.action.executeNavigation(url, highlightText);

      if (result.success) {
        // Store navigation interaction
        await this.memoryManager.addMemory({
          type: 'navigation',
          content: `Navigated to ${url}`,
          metadata: {
            url,
            highlighted: highlightText ? true : false,
            timestamp: Date.now()
          },
          tags: ['navigation', 'user_action']
        });
      }

      return result;

    } catch (error) {
      console.error('Navigation error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Highlight text on current page
  async highlightText(tabId, text, options = {}) {
    try {
      const result = await this.action.executeHighlight(tabId, text, options);

      if (result.success) {
        // Store highlighting interaction
        await this.memoryManager.addMemory({
          type: 'highlight',
          content: `Highlighted: ${text}`,
          metadata: {
            tabId,
            text,
            highlightedCount: result.highlightedCount,
            timestamp: Date.now()
          },
          tags: ['highlight', 'user_action']
        });
      }

      return result;

    } catch (error) {
      console.error('Highlight error:', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  // Clear execution history
  clearHistory() {
    this.executionHistory = [];
    this.currentPlan = null;
  }

  // Get execution history
  getHistory(limit = 10) {
    return this.executionHistory.slice(-limit);
  }

  // Export agent data
  async exportData() {
    const data = {
      executionHistory: this.executionHistory,
      stats: await this.getStats(),
      exportDate: Date.now(),
      version: '1.0.0'
    };

    return JSON.stringify(data, null, 2);
  }
}