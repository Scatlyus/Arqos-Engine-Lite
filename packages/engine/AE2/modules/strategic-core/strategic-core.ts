/**
 * Strategic Core - Módulo M1 do AE2
 * Responsável por análise estratégica, alinhamento de objetivos e planejamento
 */

import type {
  DecisionContext,
  StrategicAnalysis,
  PlanStep,
  Risk,
  Constraint,
  ModuleStatus,
  DecisionApproach,
  DecisionPriority
} from '../../types';

// ========== Configurações ==========

interface StrategicCoreConfig {
  /** Peso do histórico na análise (0-1) */
  historyWeight: number;
  /** Peso da urgência na prioridade (0-1) */
  urgencyWeight: number;
  /** Peso da complexidade no custo (0-1) */
  complexityWeight: number;
  /** Threshold para considerar alinhamento alto */
  highAlignmentThreshold: number;
  /** Threshold para considerar alinhamento baixo */
  lowAlignmentThreshold: number;
  /** Timeout base para passos (ms) */
  baseStepTimeout: number;
}

const DEFAULT_CONFIG: StrategicCoreConfig = {
  historyWeight: 0.3,
  urgencyWeight: 0.4,
  complexityWeight: 0.5,
  highAlignmentThreshold: 0.75,
  lowAlignmentThreshold: 0.4,
  baseStepTimeout: 5000
};

// ========== Mapeamentos de Domínio ==========

const DOMAIN_TOOLS: Record<string, string[]> = {
  data_processing: ['DataTransformer', 'ExcelDataProcessor', 'HybridSearch'],
  user_interaction: ['UserIntentParser', 'FeedbackAndAlerting', 'InsightSummarizer'],
  analysis: ['ChainOfThoughtGenerator', 'ScenarioSimulator', 'PredictiveOptimizer'],
  financial: ['FinancialManager', 'PricingEngine', 'InvestmentPlanner', 'TaxComplianceSimulator'],
  content: ['ClauseGeneration', 'Traducao', 'MultimodalSynthesizer'],
  research: ['WebResearchUpdater', 'EmbeddingLookup', 'MarketDataFetcher'],
  security: ['DataAnonymizer', 'VersionManager'],
  default: ['ChainOfThoughtGenerator', 'UserIntentParser', 'InsightSummarizer']
};

const DOMAIN_AGENTS: Record<string, string[]> = {
  mental_health: ['Guardian', 'Sage', 'Coach', 'Mirror', 'Nurturer'],
  gaming: ['Narrator', 'CombatManager', 'CharacterEvolver'],
  finance: ['Analyst', 'Advisor', 'RiskManager'],
  general: ['Assistant', 'Researcher', 'Executor'],
  default: ['Assistant']
};

// ========== Classe Principal ==========

export class StrategicCore {
  private config: StrategicCoreConfig;
  private initialized = false;
  private lastActivity?: number;
  private analysisCount = 0;

  constructor(config: Partial<StrategicCoreConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    console.log('[AE2:M1] Strategic Core initializing...');
    this.initialized = true;
    this.lastActivity = Date.now();
    console.log('[AE2:M1] Strategic Core initialized ✓');
  }

  getStatus(): ModuleStatus {
    return {
      name: 'StrategicCore',
      initialized: this.initialized,
      healthy: this.initialized,
      lastActivity: this.lastActivity,
      stats: {
        analysisCount: this.analysisCount
      }
    };
  }

  /**
   * Analisa o contexto e produz análise estratégica completa
   */
  async analyze(context: DecisionContext): Promise<StrategicAnalysis> {
    console.log('[AE2:M1] Analyzing strategic context...');
    this.lastActivity = Date.now();
    this.analysisCount++;

    // Calcular métricas base
    const goalAlignment = this.calculateGoalAlignment(context);
    const feasibility = this.calculateFeasibility(context);
    const resourceCost = this.calculateResourceCost(context);
    const expectedDuration = this.calculateExpectedDuration(context);

    // Extrair objetivos
    const objectives = this.extractObjectives(context);

    // Processar restrições
    const constraints = this.processConstraints(context.constraints || []);

    const analysis: StrategicAnalysis = {
      goalAlignment,
      feasibility,
      resourceCost,
      expectedDuration,
      objectives,
      constraints
    };

    console.log(`[AE2:M1] Analysis complete: alignment=${goalAlignment.toFixed(2)}, feasibility=${feasibility.toFixed(2)}`);
    return analysis;
  }

  /**
   * Determina a prioridade baseada na análise
   */
  determinePriority(analysis: StrategicAnalysis, context: DecisionContext): DecisionPriority {
    const urgency = context.urgency ?? 50;
    const alignment = analysis.goalAlignment;

    // Fórmula: combina urgência e alinhamento
    const priorityScore = (urgency / 100) * this.config.urgencyWeight +
      alignment * (1 - this.config.urgencyWeight);

    if (priorityScore >= 0.85 || urgency >= 90) return 'critical';
    if (priorityScore >= 0.7) return 'high';
    if (priorityScore >= 0.4) return 'normal';
    return 'low';
  }

  /**
   * Determina a abordagem recomendada
   */
  determineApproach(analysis: StrategicAnalysis, context: DecisionContext): DecisionApproach {
    const { goalAlignment, feasibility, resourceCost } = analysis;
    const hasHistory = (context.history?.length ?? 0) > 0;
    const historySuccessRate = this.calculateHistorySuccessRate(context);

    // Alta confiança e recursos disponíveis: agressivo
    if (goalAlignment >= this.config.highAlignmentThreshold &&
        feasibility >= 0.8 &&
        resourceCost <= 0.5) {
      return 'aggressive';
    }

    // Baixo alinhamento ou muitas restrições: conservador
    if (goalAlignment < this.config.lowAlignmentThreshold ||
        feasibility < 0.4 ||
        (context.constraints?.length ?? 0) > 5) {
      return 'conservative';
    }

    // Sem histórico ou baixa taxa de sucesso: exploratório
    if (!hasHistory || historySuccessRate < 0.5) {
      return 'exploratory';
    }

    // Caso padrão: balanceado
    return 'balanced';
  }

  /**
   * Constrói passos do plano baseado na análise
   */
  buildPlanSteps(analysis: StrategicAnalysis, context: DecisionContext): PlanStep[] {
    const steps: PlanStep[] = [];
    const domain = context.domain || 'default';
    const tools = this.selectTools(domain, analysis);
    let stepCounter = 0;

    // Passo 1: Validação de entrada
    steps.push({
      id: `step_${++stepCounter}`,
      action: 'validate_input',
      tool: 'UserIntentParser',
      dependencies: [],
      timeout: this.config.baseStepTimeout,
      retryable: true,
      optional: false
    });

    // Passo 2: Coleta de contexto (se necessário)
    if (analysis.goalAlignment < this.config.highAlignmentThreshold) {
      steps.push({
        id: `step_${++stepCounter}`,
        action: 'gather_context',
        tool: 'EmbeddingLookup',
        dependencies: [`step_${stepCounter - 1}`],
        timeout: this.config.baseStepTimeout * 2,
        retryable: true,
        optional: true
      });
    }

    // Passo 3: Processamento principal
    const mainTool = tools[0] || 'ChainOfThoughtGenerator';
    steps.push({
      id: `step_${++stepCounter}`,
      action: 'process_main',
      tool: mainTool,
      dependencies: steps.map(s => s.id),
      timeout: this.calculateStepTimeout(analysis),
      retryable: true,
      optional: false
    });

    // Passo 4: Ferramentas auxiliares
    for (const tool of tools.slice(1, 3)) {
      steps.push({
        id: `step_${++stepCounter}`,
        action: `apply_${tool.toLowerCase()}`,
        tool,
        dependencies: [`step_${stepCounter - 1}`],
        timeout: this.config.baseStepTimeout,
        retryable: true,
        optional: true
      });
    }

    // Passo 5: Geração de output
    steps.push({
      id: `step_${++stepCounter}`,
      action: 'generate_output',
      tool: 'InsightSummarizer',
      dependencies: steps.filter(s => !s.optional).map(s => s.id),
      timeout: this.config.baseStepTimeout,
      retryable: false,
      optional: false
    });

    return steps;
  }

  /**
   * Identifica riscos potenciais
   */
  identifyRisks(analysis: StrategicAnalysis, context: DecisionContext): Risk[] {
    const risks: Risk[] = [];
    let riskCounter = 0;

    // Risco de timeout
    if (analysis.expectedDuration > 30000) {
      risks.push({
        id: `risk_${++riskCounter}`,
        type: 'timeout',
        severity: analysis.expectedDuration > 60000 ? 'high' : 'medium',
        description: `Duração estimada alta: ${Math.round(analysis.expectedDuration / 1000)}s`,
        mitigation: 'Considerar paralelização ou simplificação'
      });
    }

    // Risco de recursos
    if (analysis.resourceCost > 0.7) {
      risks.push({
        id: `risk_${++riskCounter}`,
        type: 'resource',
        severity: analysis.resourceCost > 0.85 ? 'high' : 'medium',
        description: 'Alto consumo de recursos esperado',
        mitigation: 'Implementar cache ou reduzir escopo'
      });
    }

    // Risco de alinhamento
    if (analysis.goalAlignment < this.config.lowAlignmentThreshold) {
      risks.push({
        id: `risk_${++riskCounter}`,
        type: 'technical',
        severity: 'high',
        description: 'Baixo alinhamento com objetivos estratégicos',
        mitigation: 'Solicitar clarificação do usuário'
      });
    }

    // Risco de dependências
    const mandatoryConstraints = (context.constraints || []).filter(c => c.mandatory);
    if (mandatoryConstraints.length > 3) {
      risks.push({
        id: `risk_${++riskCounter}`,
        type: 'dependency',
        severity: 'medium',
        description: `Muitas restrições obrigatórias (${mandatoryConstraints.length})`,
        mitigation: 'Priorizar restrições críticas'
      });
    }

    // Risco de histórico negativo
    const historySuccessRate = this.calculateHistorySuccessRate(context);
    if (historySuccessRate < 0.3 && (context.history?.length ?? 0) >= 3) {
      risks.push({
        id: `risk_${++riskCounter}`,
        type: 'unknown',
        severity: 'high',
        description: 'Histórico de falhas recorrentes',
        mitigation: 'Abordagem exploratória recomendada'
      });
    }

    return risks;
  }

  /**
   * Seleciona agentes apropriados para o contexto
   */
  selectAgents(domain: string, analysis: StrategicAnalysis): string[] {
    const domainAgents = DOMAIN_AGENTS[domain] || DOMAIN_AGENTS.default;

    // Se alinhamento alto, usar agente principal
    if (analysis.goalAlignment >= this.config.highAlignmentThreshold) {
      return [domainAgents[0]];
    }

    // Se complexo, usar múltiplos agentes
    if (analysis.resourceCost > 0.6) {
      return domainAgents.slice(0, Math.min(3, domainAgents.length));
    }

    // Padrão: até 2 agentes
    return domainAgents.slice(0, 2);
  }

  /**
   * Calcula o score de confiança
   */
  calculateConfidenceScore(analysis: StrategicAnalysis, context: DecisionContext): number {
    const baseConfidence = (analysis.goalAlignment + analysis.feasibility) / 2;
    const historyBonus = this.calculateHistorySuccessRate(context) * this.config.historyWeight;
    const constraintPenalty = Math.min(0.2, (context.constraints?.length ?? 0) * 0.03);

    return Math.max(0, Math.min(1, baseConfidence + historyBonus - constraintPenalty));
  }

  // ========== Métodos Privados ==========

  private calculateGoalAlignment(context: DecisionContext): number {
    let score = 0.5; // Base

    // Intenção clara aumenta alinhamento
    const intent = (context.intent || '').trim();
    if (intent.length > 0) {
      score += Math.min(0.25, intent.length / 200);

      // Palavras-chave de clareza
      const clarityKeywords = ['quero', 'preciso', 'gostaria', 'faça', 'execute', 'analise'];
      const hasClarity = clarityKeywords.some(kw => intent.toLowerCase().includes(kw));
      if (hasClarity) score += 0.1;
    }

    // Domínio conhecido aumenta alinhamento
    if (context.domain && DOMAIN_TOOLS[context.domain]) {
      score += 0.1;
    }

    // Histórico de sucesso aumenta alinhamento
    score += this.calculateHistorySuccessRate(context) * this.config.historyWeight;

    // Muitas restrições diminuem alinhamento
    const constraintCount = context.constraints?.length ?? 0;
    score -= Math.min(0.2, constraintCount * 0.04);

    return Math.max(0, Math.min(1, Number(score.toFixed(3))));
  }

  private calculateFeasibility(context: DecisionContext): number {
    let score = 0.7; // Base otimista

    // Complexidade diminui viabilidade
    const complexity = context.complexity ?? 50;
    score -= (complexity / 100) * this.config.complexityWeight * 0.4;

    // Restrições de segurança são mais impactantes
    const securityConstraints = (context.constraints || [])
      .filter(c => c.type === 'security');
    score -= securityConstraints.length * 0.08;

    // Urgência muito alta pode reduzir viabilidade
    if ((context.urgency ?? 50) > 80) {
      score -= 0.1;
    }

    return Math.max(0.1, Math.min(1, Number(score.toFixed(3))));
  }

  private calculateResourceCost(context: DecisionContext): number {
    let cost = 0.3; // Base

    // Complexidade aumenta custo
    const complexity = context.complexity ?? 50;
    cost += (complexity / 100) * this.config.complexityWeight;

    // Múltiplas restrições aumentam custo
    const constraintCount = context.constraints?.length ?? 0;
    cost += Math.min(0.3, constraintCount * 0.05);

    // Intenção longa sugere mais processamento
    const intentLength = (context.intent || '').length;
    cost += Math.min(0.15, intentLength / 1000);

    return Math.max(0, Math.min(1, Number(cost.toFixed(3))));
  }

  private calculateExpectedDuration(context: DecisionContext): number {
    const baseMs = 5000; // 5 segundos base

    // Complexidade aumenta duração
    const complexity = context.complexity ?? 50;
    const complexityMultiplier = 1 + (complexity / 100);

    // Restrições aumentam duração
    const constraintCount = context.constraints?.length ?? 0;
    const constraintMultiplier = 1 + (constraintCount * 0.1);

    return Math.round(baseMs * complexityMultiplier * constraintMultiplier);
  }

  private extractObjectives(context: DecisionContext): string[] {
    const objectives: string[] = [];
    const intent = (context.intent || '').trim();

    if (!intent) {
      objectives.push('clarify_user_intent');
      return objectives;
    }

    // Objetivo principal é sempre a intenção
    objectives.push(intent);

    // Objetivos derivados do domínio
    if (context.domain) {
      objectives.push(`apply_${context.domain}_expertise`);
    }

    // Se tem histórico de falhas, adicionar objetivo de melhoria
    if (this.calculateHistorySuccessRate(context) < 0.5) {
      objectives.push('improve_response_quality');
    }

    return objectives;
  }

  private processConstraints(constraints: Constraint[]): Constraint[] {
    // Ordenar por prioridade (mandatory primeiro, depois por priority)
    return [...constraints].sort((a, b) => {
      if (a.mandatory !== b.mandatory) {
        return a.mandatory ? -1 : 1;
      }
      return (b.priority ?? 0) - (a.priority ?? 0);
    });
  }

  private selectTools(domain: string, analysis: StrategicAnalysis): string[] {
    const domainTools = DOMAIN_TOOLS[domain] || DOMAIN_TOOLS.default;

    // Se baixo alinhamento, usar ferramentas de clarificação
    if (analysis.goalAlignment < this.config.lowAlignmentThreshold) {
      return ['UserIntentParser', 'ChainOfThoughtGenerator', ...domainTools.slice(0, 1)];
    }

    return domainTools;
  }

  private calculateStepTimeout(analysis: StrategicAnalysis): number {
    const baseFactor = 1 + analysis.resourceCost;
    return Math.round(this.config.baseStepTimeout * baseFactor * 2);
  }

  private calculateHistorySuccessRate(context: DecisionContext): number {
    const history = context.history || [];
    if (history.length === 0) return 0.5; // Sem histórico = neutro

    const successes = history.filter(h => h.outcome === 'success').length;
    return successes / history.length;
  }
}

// ========== Funções Exportadas (Compatibilidade) ==========

export function assessGoalAlignment(context: DecisionContext): number {
  const core = new StrategicCore();
  return core['calculateGoalAlignment'](context);
}

export function buildPlan(context: DecisionContext): string[] {
  const steps: string[] = [];
  const intent = (context.intent || '').trim();
  const constraints = context.constraints || [];

  if (!intent) {
    steps.push('clarify_intent');
  } else {
    steps.push('confirm_intent');
  }

  if (constraints.length > 0) {
    steps.push('map_constraints');
  }

  steps.push('select_tools');
  steps.push('define_success_metrics');

  return steps;
}

export function trackObjectives(context: DecisionContext): { objectives: string[]; constraints: Constraint[] } {
  const intent = (context.intent || '').trim();
  const objectives = intent ? [intent] : ['define_primary_goal'];
  const constraints = context.constraints || [];

  return { objectives, constraints };
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE2:M1] Testando Strategic Core...\n');

  async function runTests() {
    const core = new StrategicCore();
    await core.initialize();

    // Teste 1: Contexto simples
    console.log('=== Teste 1: Contexto Simples ===');
    const context1: DecisionContext = {
      intent: 'Analise os dados de vendas do último trimestre',
      domain: 'data_processing',
      urgency: 60,
      complexity: 40
    };

    const analysis1 = await core.analyze(context1);
    console.log('Análise:', analysis1);
    console.log('Prioridade:', core.determinePriority(analysis1, context1));
    console.log('Abordagem:', core.determineApproach(analysis1, context1));
    console.log('Riscos:', core.identifyRisks(analysis1, context1));

    // Teste 2: Contexto complexo
    console.log('\n=== Teste 2: Contexto Complexo ===');
    const context2: DecisionContext = {
      intent: 'Preciso de uma análise completa do portfólio financeiro com projeções',
      domain: 'financial',
      urgency: 85,
      complexity: 75,
      constraints: [
        { id: 'c1', type: 'security', mandatory: true, description: 'Dados sensíveis' },
        { id: 'c2', type: 'time', mandatory: true, description: 'Prazo de 1 hora', value: 3600000 },
        { id: 'c3', type: 'business', mandatory: false, description: 'Formato PDF' }
      ],
      history: [
        { intent: 'análise anterior', outcome: 'success', timestamp: Date.now() - 86400000 },
        { intent: 'relatório mensal', outcome: 'partial', timestamp: Date.now() - 172800000 }
      ]
    };

    const analysis2 = await core.analyze(context2);
    console.log('Análise:', analysis2);
    console.log('Prioridade:', core.determinePriority(analysis2, context2));
    console.log('Abordagem:', core.determineApproach(analysis2, context2));
    console.log('Passos do Plano:', core.buildPlanSteps(analysis2, context2));
    console.log('Riscos:', core.identifyRisks(analysis2, context2));
    console.log('Agentes:', core.selectAgents(context2.domain!, analysis2));
    console.log('Confiança:', core.calculateConfidenceScore(analysis2, context2));

    // Teste 3: Contexto vago
    console.log('\n=== Teste 3: Contexto Vago ===');
    const context3: DecisionContext = {
      intent: 'ajuda',
      urgency: 20
    };

    const analysis3 = await core.analyze(context3);
    console.log('Análise:', analysis3);
    console.log('Prioridade:', core.determinePriority(analysis3, context3));
    console.log('Abordagem:', core.determineApproach(analysis3, context3));
    console.log('Riscos:', core.identifyRisks(analysis3, context3));

    console.log('\n[AE2:M1] Status:', core.getStatus());
    console.log('\n[AE2:M1] ✓ Strategic Core testado com sucesso');
  }

  runTests().catch(console.error);
}
