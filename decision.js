// Decision module - AI-powered planning and decision making
export class DecisionModule {
  constructor() {
    this.planningEngine = new PlanningEngine();
    this.contextAnalyzer = new ContextAnalyzer();
  }

  // Generate execution plan for user query
  async generatePlan(query, perceptionResult, memories, context = {}) {
    try {
      // Analyze the context and requirements
      const analysis = await this.contextAnalyzer.analyzeRequest(
        query,
        perceptionResult,
        memories,
        context
      );

      // Generate plan based on analysis
      const plan = await this.planningEngine.createPlan(analysis);

      // Optimize the plan
      const optimizedPlan = await this.optimizePlan(plan, memories);

      return optimizedPlan;
    } catch (error) {
      console.error('Plan generation error:', error);
      return this.createFallbackPlan(query);
    }
  }

  // Create fallback plan when AI planning fails
  createFallbackPlan(query) {
    return {
      id: this.generatePlanId(),
      query,
      type: 'search',
      steps: [
        {
          id: '1',
          type: 'search',
          description: 'Search web memory for relevant content',
          parameters: { query },
          tool: 'search_web_memory'
        },
        {
          id: '2',
          type: 'navigation',
          description: 'Navigate to best matching page',
          parameters: { url: '{{result.0.url}}', highlightText: query },
          tool: 'navigate_to_page',
          dependencies: ['1']
        }
      ],
      priority: 'normal',
      timestamp: Date.now()
    };
  }

  // Optimize plan based on available memories
  async optimizePlan(plan, memories) {
    // Check if we have relevant memories that can simplify the plan
    const relevantMemories = memories.filter(memory =>
      memory.score > 0.7 && memory.type === 'web_page'
    );

    if (relevantMemories.length > 0) {
      // Add memory-based shortcuts
      plan.memoryShortcuts = relevantMemories.map(memory => ({
        id: memory.id,
        url: memory.metadata.url,
        title: memory.metadata.title,
        score: memory.score
      }));
    }

    return plan;
  }

  // Decide next action based on current state
  async decideNextAction(currentPlan, currentStep, executionResults, context) {
    const step = currentPlan.steps.find(s => s.id === currentStep);

    if (!step) {
      return {
        action: 'complete',
        message: 'Plan execution completed',
        nextStep: null
      };
    }

    // Check if step dependencies are met
    if (step.dependencies) {
      const dependenciesMet = step.dependencies.every(dep =>
        executionResults.some(result => result.stepId === dep && result.success)
      );

      if (!dependenciesMet) {
        return {
          action: 'wait',
          message: 'Waiting for dependencies to complete',
          nextStep: step.dependencies[0]
        };
      }
    }

    // Execute the step
    try {
      const result = await this.executeStep(step, context);
      return {
        action: 'execute',
        result,
        nextStep: this.getNextStepId(currentPlan, currentStep)
      };
    } catch (error) {
      return {
        action: 'error',
        error: error.message,
        nextStep: this.handleStepError(currentPlan, currentStep, error)
      };
    }
  }

  // Execute individual step
  async executeStep(step, context) {
    switch (step.type) {
      case 'search':
        return await this.executeSearchStep(step, context);
      case 'navigation':
        return await this.executeNavigationStep(step, context);
      case 'highlight':
        return await this.executeHighlightStep(step, context);
      case 'analysis':
        return await this.executeAnalysisStep(step, context);
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  async executeSearchStep(step, context) {
    const actionModule = context.actionModule;
    return await actionModule.executeSearch(step.parameters.query, step.parameters.options);
  }

  async executeNavigationStep(step, context) {
    const actionModule = context.actionModule;
    return await actionModule.executeNavigation(
      step.parameters.url,
      step.parameters.highlightText
    );
  }

  async executeHighlightStep(step, context) {
    const actionModule = context.actionModule;
    return await actionModule.executeHighlight(
      context.tabId,
      step.parameters.text,
      step.parameters.options
    );
  }

  async executeAnalysisStep(step, context) {
    // Analysis step - could integrate with AI API for deeper analysis
    return {
      success: true,
      analysis: 'Analysis completed',
      insights: []
    };
  }

  // Get next step ID
  getNextStepId(plan, currentStepId) {
    const currentIndex = plan.steps.findIndex(s => s.id === currentStepId);
    const nextStep = plan.steps[currentIndex + 1];
    return nextStep ? nextStep.id : null;
  }

  // Handle step execution errors
  handleStepError(plan, stepId, error) {
    // Implement error recovery logic
    const retryableSteps = ['search', 'navigation'];
    const step = plan.steps.find(s => s.id === stepId);

    if (step && retryableSteps.includes(step.type)) {
      // Retry the step
      return stepId;
    }

    // Skip to next step or fail gracefully
    return this.getNextStepId(plan, stepId);
  }

  generatePlanId() {
    return 'plan_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Planning engine for creating execution plans
class PlanningEngine {
  constructor() {
    this.planTemplates = new Map();
    this.initializeTemplates();
  }

  initializeTemplates() {
    // Search and navigation plan
    this.planTemplates.set('search_navigate', {
      type: 'search_navigate',
      steps: [
        {
          id: 'search',
          type: 'search',
          description: 'Search for relevant content',
          tool: 'search_web_memory'
        },
        {
          id: 'navigate',
          type: 'navigation',
          description: 'Navigate to best result',
          tool: 'navigate_to_page',
          dependencies: ['search']
        }
      ]
    });

    // Deep analysis plan
    this.planTemplates.set('deep_analysis', {
      type: 'deep_analysis',
      steps: [
        {
          id: 'search',
          type: 'search',
          description: 'Find relevant pages',
          tool: 'search_web_memory'
        },
        {
          id: 'analyze',
          type: 'analysis',
          description: 'Analyze search results',
          tool: 'analyze_results',
          dependencies: ['search']
        },
        {
          id: 'navigate_best',
          type: 'navigation',
          description: 'Navigate to best match',
          tool: 'navigate_to_page',
          dependencies: ['analyze']
        },
        {
          id: 'highlight',
          type: 'highlight',
          description: 'Highlight relevant text',
          tool: 'highlight_text',
          dependencies: ['navigate_best']
        }
      ]
    });
  }

  async createPlan(analysis) {
    const planType = this.determinePlanType(analysis);
    const template = this.planTemplates.get(planType);

    if (!template) {
      return this.createBasicPlan(analysis);
    }

    // Customize template based on analysis
    const plan = this.customizeTemplate(template, analysis);

    return {
      id: this.generatePlanId(),
      query: analysis.query,
      type: planType,
      steps: plan.steps,
      priority: analysis.urgency === 'high' ? 'high' : 'normal',
      estimatedTime: this.estimateExecutionTime(plan.steps),
      timestamp: Date.now(),
      metadata: {
        intent: analysis.intent,
        entities: analysis.entities,
        context: analysis.context
      }
    };
  }

  determinePlanType(analysis) {
    if (analysis.intent === 'information') {
      return 'search_navigate';
    }

    if (analysis.intent === 'learning' || analysis.intent === 'research') {
      return 'deep_analysis';
    }

    if (analysis.entities.length > 2) {
      return 'deep_analysis';
    }

    return 'search_navigate';
  }

  customizeTemplate(template, analysis) {
    const customizedPlan = JSON.parse(JSON.stringify(template));

    customizedPlan.steps.forEach(step => {
      switch (step.tool) {
        case 'search_web_memory':
          step.parameters = {
            query: analysis.query,
            options: {
              limit: analysis.complexity === 'high' ? 20 : 10,
              type: analysis.contentType
            }
          };
          break;

        case 'navigate_to_page':
          step.parameters = {
            url: '{{result.0.url}}',
            highlightText: analysis.query
          };
          break;

        case 'highlight_text':
          step.parameters = {
            text: analysis.query,
            options: {
              style: 'search',
              caseSensitive: false
            }
          };
          break;

        case 'analyze_results':
          step.parameters = {
            results: '{{search.results}}',
            query: analysis.query
          };
          break;
      }
    });

    return customizedPlan;
  }

  createBasicPlan(analysis) {
    return {
      id: this.generatePlanId(),
      query: analysis.query,
      type: 'basic',
      steps: [
        {
          id: 'search',
          type: 'search',
          description: 'Search for content',
          parameters: { query: analysis.query },
          tool: 'search_web_memory'
        }
      ],
      priority: 'normal',
      timestamp: Date.now()
    };
  }

  estimateExecutionTime(steps) {
    const stepTimes = {
      search: 1000,      // 1 second
      navigation: 2000, // 2 seconds
      highlight: 500,   // 0.5 seconds
      analysis: 3000    // 3 seconds
    };

    return steps.reduce((total, step) => {
      return total + (stepTimes[step.type] || 1000);
    }, 0);
  }

  generatePlanId() {
    return 'plan_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// Context analyzer for understanding request context
class ContextAnalyzer {
  async analyzeRequest(query, perceptionResult, memories, context) {
    const analysis = {
      query,
      intent: 'information',
      entities: [],
      keywords: [],
      urgency: 'normal',
      complexity: 'medium',
      contentType: null,
      context: {},
      confidence: 0.5
    };

    // Extract intent from query
    analysis.intent = this.extractIntent(query);

    // Extract entities
    analysis.entities = this.extractEntities(query);

    // Extract keywords
    analysis.keywords = this.extractKeywords(query);

    // Determine urgency
    analysis.urgency = this.assessUrgency(query);

    // Determine complexity
    analysis.complexity = this.assessComplexity(query, analysis.entities);

    // Determine content type
    analysis.contentType = this.determineContentType(query, perceptionResult);

    // Add context information
    analysis.context = {
      currentUrl: context.currentUrl || '',
      recentSearches: context.recentSearches || [],
      timeOfDay: new Date().getHours(),
      deviceType: 'desktop'
    };

    // Calculate confidence
    analysis.confidence = this.calculateConfidence(analysis);

    return analysis;
  }

  extractIntent(query) {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('how to') || lowerQuery.includes('tutorial')) {
      return 'learning';
    }

    if (lowerQuery.includes('find') || lowerQuery.includes('search') || lowerQuery.includes('look for')) {
      return 'search';
    }

    if (lowerQuery.includes('compare') || lowerQuery.includes('vs') || lowerQuery.includes('difference')) {
      return 'comparison';
    }

    if (lowerQuery.includes('what is') || lowerQuery.includes('define') || lowerQuery.includes('explain')) {
      return 'definition';
    }

    if (lowerQuery.includes('where') || lowerQuery.includes('locate')) {
      return 'location';
    }

    if (lowerQuery.includes('buy') || lowerQuery.includes('price') || lowerQuery.includes('shop')) {
      return 'shopping';
    }

    return 'information';
  }

  extractEntities(query) {
    const entities = [];

    // URLs
    const urls = query.match(/https?:\/\/[^\s]+/g);
    if (urls) {
      urls.forEach(url => entities.push({ type: 'url', value: url }));
    }

    // Quoted phrases
    const quotes = query.match(/"([^"]+)"/g);
    if (quotes) {
      quotes.forEach(quote => {
        entities.push({
          type: 'exact_phrase',
          value: quote.replace(/"/g, '')
        });
      });
    }

    // Numbers and dates
    const numbers = query.match(/\b\d+(?:\.\d+)?\b/g);
    if (numbers) {
      numbers.forEach(num => entities.push({ type: 'number', value: num }));
    }

    return entities;
  }

  extractKeywords(query) {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been'
    ]);

    return query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10);
  }

  assessUrgency(query) {
    const urgentWords = ['urgent', 'asap', 'immediately', 'now', 'emergency', 'quick'];
    const lowerQuery = query.toLowerCase();

    return urgentWords.some(word => lowerQuery.includes(word)) ? 'high' : 'normal';
  }

  assessComplexity(query, entities) {
    let complexity = 1;

    // Increase complexity based on query length
    if (query.length > 50) complexity++;
    if (query.length > 100) complexity++;

    // Increase complexity based on entities
    if (entities.length > 3) complexity++;

    // Increase complexity for question words
    const questionWords = ['why', 'how', 'what', 'when', 'where', 'who'];
    if (questionWords.some(word => query.toLowerCase().includes(word))) {
      complexity++;
    }

    if (complexity >= 4) return 'high';
    if (complexity >= 3) return 'medium';
    return 'low';
  }

  determineContentType(query, perceptionResult) {
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('video') || lowerQuery.includes('youtube')) return 'video';
    if (lowerQuery.includes('image') || lowerQuery.includes('photo')) return 'image';
    if (lowerQuery.includes('document') || lowerQuery.includes('pdf')) return 'document';
    if (lowerQuery.includes('article') || lowerQuery.includes('blog')) return 'article';
    if (lowerQuery.includes('tutorial') || lowerQuery.includes('guide')) return 'tutorial';

    return null;
  }

  calculateConfidence(analysis) {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on entities
    confidence += Math.min(analysis.entities.length * 0.1, 0.3);

    // Increase confidence based on keywords
    confidence += Math.min(analysis.keywords.length * 0.05, 0.2);

    // Adjust based on complexity
    if (analysis.complexity === 'low') confidence += 0.1;
    if (analysis.complexity === 'high') confidence -= 0.1;

    return Math.min(Math.max(confidence, 0.1), 1.0);
  }
}