/**
 * Decision Engine - Motor Central do AE2
 * Integra Strategic Core (M1), Internal Orchestrator (M2) e Decision Auditor (M3)
 * para produzir decisões estratégicas completas
 */

import type {
  DecisionContext,
  StrategicDecision,
  StrategicAnalysis,
  OrchestrationPlan,
  Agent,
  Constraint,
  DecisionPriority,
  DecisionApproach,
  DecisionConfidence,
  PlanStep,
  Risk,
  ModuleStatus
} from '../types';

import { StrategicCore } from '../modules/strategic-core/strategic-core';
import { InternalOrchestrator } from '../modules/internal-orchestrator/orchestrator';
import { DecisionAuditor } from '../modules/decision-auditor/auditor';
import { profiler } from '../../runtime/profiler';

// ========== Configurações ==========

interface DecisionEngineConfig {
  /** Modo de operação */
  mode: 'lite' | 'fullstack';
  /** Timeout para decisão em ms */
  decisionTimeout: number;
  /** Habilitar auditoria */
  enableAudit: boolean;
  /** Threshold mínimo de confiança */
  minConfidenceThreshold: number;
  /** Habilitar otimização de planos */
  enablePlanOptimization: boolean;
}

const DEFAULT_CONFIG: DecisionEngineConfig = {
  mode: 'lite',
  decisionTimeout: 15000,
  enableAudit: true,
  minConfidenceThreshold: 0.3,
  enablePlanOptimization: true
};

// ========== Classe Principal ==========

export class DecisionEngine {
  private config: DecisionEngineConfig;
  private initialized = false;
  private lastActivity?: number;
  private decisionsCount = 0;

  // Módulos integrados
  private strategicCore: StrategicCore;
  private orchestrator: InternalOrchestrator;
  private auditor: DecisionAuditor;

  constructor(config: Partial<DecisionEngineConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Inicializar módulos
    this.strategicCore = new StrategicCore();
    this.orchestrator = new InternalOrchestrator();
    this.auditor = new DecisionAuditor();
  }

  async initialize(): Promise<void> {
    console.log('[AE2:DecisionEngine] Initializing Decision Engine...');

    // Inicializar módulos
    await this.strategicCore.initialize();
    await this.orchestrator.initialize();
    await this.auditor.initialize();

    this.initialized = true;
    this.lastActivity = Date.now();
    console.log('[AE2:DecisionEngine] Decision Engine initialized ✓');
  }

  getStatus(): ModuleStatus {
    return {
      name: 'DecisionEngine',
      initialized: this.initialized,
      healthy: this.initialized,
      lastActivity: this.lastActivity,
      stats: {
        decisionsCount: this.decisionsCount,
        mode: this.config.mode
      } as Record<string, any>
    };
  }

  /**
   * Método principal: toma uma decisão estratégica baseada no contexto
   */
  async decide(
    context: DecisionContext,
    availableAgents: Agent[] = [],
    constraints: Constraint[] = []
  ): Promise<{
    decision: StrategicDecision;
    plan: OrchestrationPlan;
    analysis: StrategicAnalysis;
  }> {
    if (!this.initialized) {
      throw new Error('DecisionEngine not initialized. Call initialize() first.');
    }

    const startTime = Date.now();
    console.log('[AE2:DecisionEngine] Making decision...');
    this.lastActivity = startTime;
    this.decisionsCount++;

    try {
      // Fase 1: Análise Estratégica (Strategic Core - M1)
      console.log('[AE2:DecisionEngine] Phase 1: Strategic Analysis');
      const analysis = await profiler.profile('AE2_StrategicAnalysis', () =>
        this.strategicCore.analyze(context)
      );

      // Fase 2: Construir Decisão Estratégica
      console.log('[AE2:DecisionEngine] Phase 2: Building Strategic Decision');
      const decision = this.buildStrategicDecision(context, analysis);

      // Fase 3: Criar Plano de Orquestração (Internal Orchestrator - M2)
      console.log('[AE2:DecisionEngine] Phase 3: Creating Orchestration Plan');
      let plan = await profiler.profile('AE2_OrchestrationPlanning', () =>
        this.orchestrator.createPlan(
          decision,
          availableAgents,
          constraints
        )
      );

      // Fase 3.1: Otimizar plano se habilitado
      if (this.config.enablePlanOptimization) {
        console.log('[AE2:DecisionEngine] Phase 3.1: Optimizing Plan');
        plan = await profiler.profile('AE2_PlanOptimization', () =>
          this.orchestrator.optimizePlan(plan)
        );
      }

      // Fase 3.2: Validar plano
      const validation = this.orchestrator.validatePlan(plan);
      if (!validation.valid) {
        console.warn('[AE2:DecisionEngine] Plan validation failed:', validation.errors);
        throw new Error(`Invalid plan: ${validation.errors.join(', ')}`);
      }

      // Fase 4: Auditoria (Decision Auditor - M3)
      if (this.config.enableAudit) {
        console.log('[AE2:DecisionEngine] Phase 4: Auditing Decision');
        const duration = Date.now() - startTime;
        await this.auditor.logDecision(decision, context, duration);
      }

      // Fase 5: Verificar confiança mínima
      if (decision.confidenceScore < this.config.minConfidenceThreshold) {
        console.warn(
          `[AE2:DecisionEngine] Low confidence: ${decision.confidenceScore.toFixed(2)} < ${this.config.minConfidenceThreshold}`
        );
      }

      const totalDuration = Date.now() - startTime;
      console.log(`[AE2:DecisionEngine] Decision complete in ${totalDuration}ms`);
      console.log(`[AE2:DecisionEngine] Priority: ${decision.priority}, Confidence: ${decision.confidenceScore.toFixed(2)}`);

      return { decision, plan, analysis };

    } catch (error) {
      // Log erro
      if (this.config.enableAudit) {
        await this.auditor.logError(error as Error, {
          module: 'DecisionEngine',
          context,
          timestamp: Date.now()
        });
      }
      throw error;
    }
  }

  /**
   * Método simplificado para decisões rápidas (apenas decisão, sem plano)
   */
  async quickDecide(context: DecisionContext): Promise<StrategicDecision> {
    if (!this.initialized) {
      throw new Error('DecisionEngine not initialized');
    }

    const startTime = Date.now();
    console.log('[AE2:DecisionEngine] Quick decision mode...');

    const analysis = await this.strategicCore.analyze(context);
    const decision = this.buildStrategicDecision(context, analysis);

    if (this.config.enableAudit) {
      const duration = Date.now() - startTime;
      await this.auditor.logDecision(decision, context, duration);
    }

    return decision;
  }

  /**
   * Retorna estatísticas do auditor
   */
  getAuditStats() {
    return this.auditor.getStats();
  }

  /**
   * Retorna decisões recentes
   */
  async getRecentDecisions(limit: number = 10) {
    return this.auditor.getRecentDecisions(limit);
  }

  /**
   * Exporta audit log
   */
  exportAuditLog() {
    return this.auditor.exportAuditLog();
  }

  // ========== Métodos Privados ==========

  /**
   * Constrói a decisão estratégica completa
   */
  private buildStrategicDecision(
    context: DecisionContext,
    analysis: StrategicAnalysis
  ): StrategicDecision {
    // Determinar prioridade
    const priority = this.strategicCore.determinePriority(analysis, context);

    // Determinar abordagem
    const approach = this.strategicCore.determineApproach(analysis, context);

    // Construir passos do plano
    const planSteps = this.strategicCore.buildPlanSteps(analysis, context);

    // Identificar riscos
    const risks = this.strategicCore.identifyRisks(analysis, context);

    // Selecionar agentes
    const domain = context.domain || 'default';
    const selectedAgents = this.strategicCore.selectAgents(domain, analysis);

    // Calcular confidence score
    const confidenceScore = this.strategicCore.calculateConfidenceScore(analysis, context);

    // Determinar nível de confiança
    const confidence = this.determineConfidenceLevel(confidenceScore);

    // Ferramentas recomendadas (do primeiro step de cada tipo)
    const recommendedTools = planSteps
      .filter(s => s.tool)
      .map(s => s.tool!)
      .filter((tool, index, self) => self.indexOf(tool) === index)
      .slice(0, 5);

    // Timeout baseado na análise
    const timeoutMs = Math.min(
      analysis.expectedDuration * 1.5,
      this.config.decisionTimeout
    );

    // Gerar reasoning
    const reasoning = this.generateReasoning(
      context,
      analysis,
      priority,
      approach,
      confidenceScore
    );

    const decision: StrategicDecision = {
      id: this.generateDecisionId(),
      priority,
      approach,
      confidence,
      confidenceScore,
      selectedAgents,
      recommendedTools,
      planSteps,
      strategicAnalysis: analysis,
      risks,
      timeoutMs,
      createdAt: Date.now(),
      reasoning
    };

    return decision;
  }

  /**
   * Determina o nível de confiança baseado no score
   */
  private determineConfidenceLevel(score: number): DecisionConfidence {
    if (score >= 0.75) return 'high';
    if (score >= 0.5) return 'medium';
    return 'low';
  }

  /**
   * Gera raciocínio explicativo da decisão
   */
  private generateReasoning(
    context: DecisionContext,
    analysis: StrategicAnalysis,
    priority: DecisionPriority,
    approach: DecisionApproach,
    confidenceScore: number
  ): string {
    const parts: string[] = [];

    // Contexto
    if (context.intent) {
      parts.push(`Intenção identificada: "${context.intent}".`);
    }

    // Análise
    parts.push(
      `Análise estratégica indica alinhamento de ${(analysis.goalAlignment * 100).toFixed(0)}% ` +
      `com viabilidade de ${(analysis.feasibility * 100).toFixed(0)}%.`
    );

    // Prioridade
    const priorityReason = this.getPriorityReasoning(priority, context, analysis);
    parts.push(priorityReason);

    // Abordagem
    const approachReason = this.getApproachReasoning(approach, analysis);
    parts.push(approachReason);

    // Confiança
    parts.push(
      `Confiança da decisão: ${(confidenceScore * 100).toFixed(0)}% ` +
      `(${this.determineConfidenceLevel(confidenceScore)}).`
    );

    // Riscos
    if (analysis.constraints.length > 0) {
      parts.push(
        `${analysis.constraints.length} restrição(ões) aplicada(s).`
      );
    }

    return parts.join(' ');
  }

  private getPriorityReasoning(
    priority: DecisionPriority,
    context: DecisionContext,
    analysis: StrategicAnalysis
  ): string {
    const urgency = context.urgency ?? 50;

    switch (priority) {
      case 'critical':
        return `Prioridade crítica devido à ${urgency >= 90 ? 'urgência extrema' : 'alto alinhamento estratégico'}.`;
      case 'high':
        return `Alta prioridade considerando urgência moderada-alta e bom alinhamento.`;
      case 'normal':
        return `Prioridade normal para execução equilibrada.`;
      case 'low':
        return `Baixa prioridade - ${analysis.goalAlignment < 0.4 ? 'alinhamento fraco' : 'não urgente'}.`;
    }
  }

  private getApproachReasoning(approach: DecisionApproach, analysis: StrategicAnalysis): string {
    switch (approach) {
      case 'aggressive':
        return `Abordagem agressiva recomendada: alta confiança e recursos disponíveis.`;
      case 'balanced':
        return `Abordagem balanceada adequada para o contexto atual.`;
      case 'conservative':
        return `Abordagem conservadora devido a ${analysis.feasibility < 0.5 ? 'baixa viabilidade' : 'múltiplas restrições'}.`;
      case 'exploratory':
        return `Abordagem exploratória recomendada para validar hipóteses.`;
    }
  }

  private generateDecisionId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }
}

// ========== Factory Functions ==========

/**
 * Cria uma instância do Decision Engine em modo lite
 */
export function createLiteDecisionEngine(): DecisionEngine {
  return new DecisionEngine({ mode: 'lite' });
}

/**
 * Cria uma instância do Decision Engine em modo fullstack
 */
export function createFullstackDecisionEngine(): DecisionEngine {
  return new DecisionEngine({
    mode: 'fullstack',
    decisionTimeout: 30000,
    enablePlanOptimization: true
  });
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE2:DecisionEngine] Testando Decision Engine...\n');

  async function runTests() {
    // Teste 1: Decisão simples
    console.log('=== Teste 1: Decisão Simples ===');
    const engine1 = createLiteDecisionEngine();
    await engine1.initialize();

    const context1: DecisionContext = {
      intent: 'Analisar vendas do último mês',
      domain: 'data_processing',
      urgency: 60,
      complexity: 40
    };

    const result1 = await engine1.decide(context1);
    console.log('Decisão:', result1.decision.id);
    console.log('Prioridade:', result1.decision.priority);
    console.log('Abordagem:', result1.decision.approach);
    console.log('Confiança:', result1.decision.confidenceScore.toFixed(2));
    console.log('Agentes:', result1.decision.selectedAgents);
    console.log('Plano:', result1.plan.id, `(${result1.plan.steps.length} steps)`);
    console.log('Raciocínio:', result1.decision.reasoning);

    // Teste 2: Decisão complexa
    console.log('\n=== Teste 2: Decisão Complexa ===');
    const context2: DecisionContext = {
      intent: 'Análise financeira completa com projeções e alertas',
      domain: 'financial',
      urgency: 85,
      complexity: 75,
      constraints: [
        { id: 'c1', type: 'security', mandatory: true, description: 'Dados sensíveis' },
        { id: 'c2', type: 'time', mandatory: true, description: 'Prazo 1h', value: 3600000 }
      ],
      history: [
        { intent: 'análise anterior', outcome: 'success', timestamp: Date.now() - 86400000 }
      ]
    };

    const agents2: Agent[] = [
      { id: 'analyst', name: 'Financial Analyst', status: 'available', load: 30 },
      { id: 'advisor', name: 'Risk Advisor', status: 'available', load: 50 }
    ];

    const result2 = await engine1.decide(context2, agents2, context2.constraints || []);
    console.log('Decisão:', result2.decision.id);
    console.log('Prioridade:', result2.decision.priority);
    console.log('Confiança:', result2.decision.confidenceScore.toFixed(2));
    console.log('Riscos:', result2.decision.risks.length);
    console.log('Plano válido:', result2.plan.steps.length > 0);
    console.log('Timeout budget:', result2.plan.timeoutBudget, 'ms');
    console.log('Métricas:', result2.plan.expectedMetrics);
    console.log('Raciocínio:', result2.decision.reasoning);

    // Teste 3: Quick decision
    console.log('\n=== Teste 3: Quick Decision ===');
    const context3: DecisionContext = {
      intent: 'ajuda rápida',
      urgency: 30
    };

    const decision3 = await engine1.quickDecide(context3);
    console.log('Decisão rápida:', decision3.id);
    console.log('Prioridade:', decision3.priority);
    console.log('Confiança:', decision3.confidenceScore.toFixed(2));

    // Teste 4: Estatísticas
    console.log('\n=== Teste 4: Estatísticas ===');
    const stats = engine1.getAuditStats();
    console.log('Total de decisões:', stats.totalDecisions);
    console.log('Tempo médio:', Math.round(stats.avgDecisionTime), 'ms');
    console.log('Decisões críticas:', stats.criticalDecisions);

    const recent = await engine1.getRecentDecisions(3);
    console.log('Decisões recentes:', recent.length);

    console.log('\n[AE2:DecisionEngine] Status:', engine1.getStatus());
    console.log('\n[AE2:DecisionEngine] ✓ Decision Engine testado com sucesso');
  }

  runTests().catch(console.error);
}
