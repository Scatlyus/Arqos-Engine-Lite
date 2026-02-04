/**
 * Self Reflection - Módulo M7 do AE2
 * Responsável por revisão de decisões, refinamento de estratégia e geração de insights
 */

import type {
  ReflectionReport,
  ReflectionMetrics,
  Insight,
  Recommendation,
  StrategicDecision,
  ExecutionOutcome,
  ModuleStatus,
  DecisionPriority
} from '../../types';

// ========== Configurações ==========

interface SelfReflectionConfig {
  /** Número de decisões a manter no histórico */
  historySize: number;
  /** Período de análise padrão em ms */
  defaultAnalysisPeriod: number;
  /** Threshold para detectar padrões */
  patternThreshold: number;
  /** Threshold para gerar alerta de performance */
  performanceAlertThreshold: number;
  /** Habilitar auto-refinamento */
  enableAutoRefinement: boolean;
  /** Máximo de insights por relatório */
  maxInsightsPerReport: number;
}

const DEFAULT_CONFIG: SelfReflectionConfig = {
  historySize: 100,
  defaultAnalysisPeriod: 3600000, // 1 hora
  patternThreshold: 0.3,
  performanceAlertThreshold: 0.6,
  enableAutoRefinement: true,
  maxInsightsPerReport: 10
};

// ========== Tipos Internos ==========

interface DecisionRecord {
  decision: StrategicDecision;
  outcome?: ExecutionOutcome;
  timestamp: number;
  reviewed: boolean;
  feedback?: DecisionFeedback;
}

interface DecisionFeedback {
  accuracy: number;
  efficiency: number;
  userSatisfaction?: number;
  notes?: string;
}

interface ReviewResult {
  decisionId: string;
  assessment: 'excellent' | 'good' | 'acceptable' | 'poor' | 'critical';
  findings: string[];
  improvements: string[];
  confidenceAccuracy: number;
}

interface StrategyRefinement {
  area: string;
  currentApproach: string;
  suggestedApproach: string;
  rationale: string;
  priority: DecisionPriority;
  confidence: number;
}

interface PerformanceTrend {
  metric: string;
  direction: 'improving' | 'stable' | 'declining';
  change: number;
  samples: number;
}

interface LearningPoint {
  type: 'success_pattern' | 'failure_pattern' | 'optimization' | 'risk';
  description: string;
  frequency: number;
  impact: number;
  actionable: boolean;
}

// ========== Classe Principal ==========

export class SelfReflection {
  private config: SelfReflectionConfig;
  private initialized = false;
  private lastActivity?: number;

  // Histórico
  private decisionHistory: DecisionRecord[] = [];
  private reviewHistory: ReviewResult[] = [];
  private refinementHistory: StrategyRefinement[] = [];

  // Aprendizados
  private learningPoints: LearningPoint[] = [];
  private performanceTrends: PerformanceTrend[] = [];

  // Métricas
  private totalReflections = 0;
  private totalReviews = 0;
  private refinementsSuggested = 0;

  constructor(config: Partial<SelfReflectionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    console.log('[AE2:M7] Self Reflection initializing...');
    this.initialized = true;
    this.lastActivity = Date.now();
    console.log('[AE2:M7] Self Reflection initialized ✓');
  }

  getStatus(): ModuleStatus {
    return {
      name: 'SelfReflection',
      initialized: this.initialized,
      healthy: this.initialized,
      lastActivity: this.lastActivity,
      stats: {
        totalReflections: this.totalReflections,
        totalReviews: this.totalReviews,
        refinementsSuggested: this.refinementsSuggested,
        decisionsInHistory: this.decisionHistory.length,
        learningPoints: this.learningPoints.length,
        activeTrends: this.performanceTrends.length
      }
    };
  }

  // ========== Registro de Decisões ==========

  /**
   * Registra uma decisão para análise posterior
   */
  recordDecision(decision: StrategicDecision): void {
    const record: DecisionRecord = {
      decision,
      timestamp: Date.now(),
      reviewed: false
    };

    this.decisionHistory.push(record);

    // Manter tamanho do histórico
    if (this.decisionHistory.length > this.config.historySize) {
      this.decisionHistory.shift();
    }
  }

  /**
   * Registra o resultado de uma execução
   */
  recordOutcome(decisionId: string, outcome: ExecutionOutcome): void {
    const record = this.decisionHistory.find(r => r.decision.id === decisionId);
    if (record) {
      record.outcome = outcome;
    }
  }

  /**
   * Adiciona feedback a uma decisão
   */
  addFeedback(decisionId: string, feedback: DecisionFeedback): void {
    const record = this.decisionHistory.find(r => r.decision.id === decisionId);
    if (record) {
      record.feedback = feedback;
    }
  }

  // ========== Reflexão Principal ==========

  /**
   * Executa reflexão completa sobre decisões recentes
   */
  async reflect(input: Record<string, unknown> = {}): Promise<ReflectionReport> {
    console.log('[AE2:M7] Starting reflection...');
    this.lastActivity = Date.now();
    this.totalReflections++;

    // Extrair decisões do input ou usar histórico
    const decisions = this.extractDecisions(input);

    // Revisar decisões
    const reviews = await this.reviewDecisions(decisions);

    // Refinar estratégia
    const refinements = this.refineStrategy(reviews);

    // Calcular métricas
    const metrics = this.calculateMetrics();

    // Gerar insights
    const insights = this.generateInsights(reviews, metrics);

    // Gerar recomendações
    const recommendations = this.generateRecommendations(insights, refinements);

    // Construir relatório
    const report: ReflectionReport = {
      id: `reflection_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      summary: this.generateSummary(reviews, metrics),
      period: {
        start: Date.now() - this.config.defaultAnalysisPeriod,
        end: Date.now()
      },
      metrics,
      insights,
      recommendations,
      createdAt: Date.now()
    };

    // Atualizar aprendizados
    this.updateLearningPoints(insights);

    // Atualizar tendências
    this.updatePerformanceTrends(metrics);

    console.log(`[AE2:M7] Reflection complete: ${insights.length} insights, ${recommendations.length} recommendations`);
    return report;
  }

  // ========== Revisão de Decisões ==========

  /**
   * Revisa decisões individuais
   */
  async reviewDecisions(decisions: string[]): Promise<ReviewResult[]> {
    this.lastActivity = Date.now();
    this.totalReviews += decisions.length;

    const results: ReviewResult[] = [];

    // Se não há decisões específicas, revisar do histórico
    const toReview = decisions.length > 0
      ? this.decisionHistory.filter(r => decisions.includes(r.decision.id) && !r.reviewed)
      : this.decisionHistory.filter(r => !r.reviewed).slice(-10);

    for (const record of toReview) {
      const result = this.reviewSingleDecision(record);
      results.push(result);
      record.reviewed = true;
    }

    this.reviewHistory.push(...results);

    // Manter tamanho do histórico de reviews
    if (this.reviewHistory.length > this.config.historySize) {
      this.reviewHistory.splice(0, this.reviewHistory.length - this.config.historySize);
    }

    return results;
  }

  /**
   * Revisa uma única decisão
   */
  private reviewSingleDecision(record: DecisionRecord): ReviewResult {
    const { decision, outcome, feedback } = record;
    const findings: string[] = [];
    const improvements: string[] = [];

    // Avaliar confiança vs resultado real
    let confidenceAccuracy = 0.5;
    if (outcome) {
      if (outcome.status === 'success' && decision.confidence === 'high') {
        confidenceAccuracy = 0.9;
        findings.push('High confidence decision succeeded as expected');
      } else if (outcome.status === 'failure' && decision.confidence === 'low') {
        confidenceAccuracy = 0.7;
        findings.push('Low confidence decision failed - appropriate caution was taken');
      } else if (outcome.status === 'success' && decision.confidence === 'low') {
        confidenceAccuracy = 0.4;
        findings.push('Success despite low confidence - consider recalibrating confidence model');
        improvements.push('Review factors leading to underconfidence');
      } else if (outcome.status === 'failure' && decision.confidence === 'high') {
        confidenceAccuracy = 0.2;
        findings.push('ALERT: High confidence decision failed');
        improvements.push('Urgent: Identify blind spots in confidence calculation');
        improvements.push('Review risk assessment methodology');
      } else {
        confidenceAccuracy = 0.5;
        findings.push('Partial outcome - requires detailed analysis');
      }
    }

    // Avaliar abordagem
    if (decision.approach === 'aggressive' && outcome?.status !== 'success') {
      improvements.push('Consider more balanced approach for similar contexts');
    }
    if (decision.approach === 'conservative' && outcome?.status === 'success') {
      findings.push('Conservative approach successful - validate if speed could be improved');
    }

    // Avaliar riscos identificados vs realizados
    if (outcome?.errors && outcome.errors.length > 0) {
      const unforeseenErrors = outcome.errors.filter(e =>
        !decision.risks.some(r => r.description.toLowerCase().includes(e.code.toLowerCase()))
      );
      if (unforeseenErrors.length > 0) {
        findings.push(`${unforeseenErrors.length} unforeseen errors occurred`);
        improvements.push('Expand risk identification criteria');
      }
    }

    // Avaliar feedback do usuário
    if (feedback) {
      if (feedback.accuracy < 0.5) {
        findings.push('User reported low accuracy');
        improvements.push('Review output validation and formatting');
      }
      if (feedback.efficiency < 0.5) {
        findings.push('User reported low efficiency');
        improvements.push('Optimize execution pipeline');
      }
    }

    // Determinar avaliação geral
    const assessment = this.determineAssessment(confidenceAccuracy, findings, improvements);

    return {
      decisionId: decision.id,
      assessment,
      findings,
      improvements,
      confidenceAccuracy
    };
  }

  private determineAssessment(
    confidenceAccuracy: number,
    findings: string[],
    improvements: string[]
  ): ReviewResult['assessment'] {
    const hasAlerts = findings.some(f => f.includes('ALERT'));
    const improvementCount = improvements.length;

    if (hasAlerts || confidenceAccuracy < 0.3) return 'critical';
    if (confidenceAccuracy >= 0.85 && improvementCount === 0) return 'excellent';
    if (confidenceAccuracy >= 0.7 && improvementCount <= 1) return 'good';
    if (confidenceAccuracy >= 0.5) return 'acceptable';
    return 'poor';
  }

  // ========== Refinamento de Estratégia ==========

  /**
   * Refina estratégia baseado nas revisões
   */
  refineStrategy(reviews: ReviewResult[]): StrategyRefinement[] {
    if (!this.config.enableAutoRefinement) {
      return [];
    }

    this.lastActivity = Date.now();
    const refinements: StrategyRefinement[] = [];

    // Analisar padrões nas revisões
    const poorReviews = reviews.filter(r => r.assessment === 'poor' || r.assessment === 'critical');
    const goodReviews = reviews.filter(r => r.assessment === 'excellent' || r.assessment === 'good');

    // Refinamento de confiança
    const avgConfidenceAccuracy = reviews.reduce((sum, r) => sum + r.confidenceAccuracy, 0) / reviews.length;
    if (avgConfidenceAccuracy < this.config.performanceAlertThreshold) {
      refinements.push({
        area: 'confidence_calibration',
        currentApproach: 'Current confidence model shows systematic bias',
        suggestedApproach: 'Implement Bayesian calibration with historical outcomes',
        rationale: `Average confidence accuracy: ${(avgConfidenceAccuracy * 100).toFixed(1)}%`,
        priority: 'high',
        confidence: 0.8
      });
    }

    // Refinamento de abordagem
    const approachIssues = this.analyzeApproachPatterns(reviews);
    if (approachIssues) {
      refinements.push(approachIssues);
    }

    // Refinamento de identificação de riscos
    const riskIssues = reviews.filter(r =>
      r.improvements.some(i => i.toLowerCase().includes('risk'))
    );
    if (riskIssues.length > reviews.length * 0.3) {
      refinements.push({
        area: 'risk_identification',
        currentApproach: 'Current risk detection missing patterns',
        suggestedApproach: 'Expand risk taxonomy and improve pattern matching',
        rationale: `${riskIssues.length}/${reviews.length} reviews suggest risk identification gaps`,
        priority: 'high',
        confidence: 0.75
      });
    }

    // Refinamento baseado em melhorias recorrentes
    const improvementCounts = new Map<string, number>();
    for (const review of reviews) {
      for (const improvement of review.improvements) {
        const key = improvement.toLowerCase().split(' ').slice(0, 3).join('_');
        improvementCounts.set(key, (improvementCounts.get(key) || 0) + 1);
      }
    }

    for (const [key, count] of improvementCounts) {
      if (count >= 3) {
        refinements.push({
          area: key.replace(/_/g, ' '),
          currentApproach: 'Recurring issue detected',
          suggestedApproach: `Systematic fix needed for: ${key.replace(/_/g, ' ')}`,
          rationale: `Issue appeared in ${count} reviews`,
          priority: count >= 5 ? 'high' : 'normal',
          confidence: 0.7
        });
      }
    }

    this.refinementsSuggested += refinements.length;
    this.refinementHistory.push(...refinements);

    return refinements;
  }

  private analyzeApproachPatterns(reviews: ReviewResult[]): StrategyRefinement | null {
    // Buscar padrões de decisões relacionadas
    const aggressiveFailures = this.decisionHistory.filter(r =>
      r.decision.approach === 'aggressive' &&
      r.outcome?.status === 'failure'
    ).length;

    const conservativeSuccesses = this.decisionHistory.filter(r =>
      r.decision.approach === 'conservative' &&
      r.outcome?.status === 'success'
    ).length;

    const total = this.decisionHistory.filter(r => r.outcome).length;

    if (total > 5 && aggressiveFailures / total > 0.4) {
      return {
        area: 'approach_selection',
        currentApproach: 'Aggressive approach used frequently with high failure rate',
        suggestedApproach: 'Increase threshold for aggressive approach selection',
        rationale: `${aggressiveFailures}/${total} aggressive decisions failed`,
        priority: 'high',
        confidence: 0.85
      };
    }

    return null;
  }

  // ========== Métricas ==========

  /**
   * Calcula métricas de reflexão
   */
  private calculateMetrics(): ReflectionMetrics {
    const decisionsWithOutcome = this.decisionHistory.filter(r => r.outcome);

    // Taxa de sucesso
    const successCount = decisionsWithOutcome.filter(r =>
      r.outcome?.status === 'success'
    ).length;
    const successRate = decisionsWithOutcome.length > 0
      ? successCount / decisionsWithOutcome.length
      : 0;

    // Confiança média
    const avgConfidence = this.decisionHistory.reduce((sum, r) =>
      sum + r.decision.confidenceScore, 0
    ) / Math.max(1, this.decisionHistory.length);

    // Tempo médio de execução
    const avgExecutionTime = decisionsWithOutcome.reduce((sum, r) =>
      sum + (r.outcome?.duration ?? 0), 0
    ) / Math.max(1, decisionsWithOutcome.length);

    // Top agentes
    const agentCounts = new Map<string, number>();
    for (const record of this.decisionHistory) {
      for (const agent of record.decision.selectedAgents) {
        agentCounts.set(agent, (agentCounts.get(agent) || 0) + 1);
      }
    }
    const topAgents = Array.from(agentCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([agent]) => agent);

    // Top ferramentas
    const toolCounts = new Map<string, number>();
    for (const record of this.decisionHistory) {
      for (const tool of record.decision.recommendedTools) {
        toolCounts.set(tool, (toolCounts.get(tool) || 0) + 1);
      }
    }
    const topTools = Array.from(toolCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool]) => tool);

    return {
      totalDecisions: this.decisionHistory.length,
      successRate: Number(successRate.toFixed(3)),
      avgConfidence: Number(avgConfidence.toFixed(3)),
      avgExecutionTime: Math.round(avgExecutionTime),
      topAgents,
      topTools
    };
  }

  // ========== Insights ==========

  /**
   * Gera insights baseados nas análises
   */
  private generateInsights(reviews: ReviewResult[], metrics: ReflectionMetrics): Insight[] {
    const insights: Insight[] = [];

    // Insight de taxa de sucesso
    if (metrics.successRate < 0.6) {
      insights.push({
        type: 'anomaly',
        description: `Low success rate detected: ${(metrics.successRate * 100).toFixed(1)}%`,
        confidence: 0.9,
        evidence: ['Historical success rate below threshold', `${metrics.totalDecisions} decisions analyzed`]
      });
    } else if (metrics.successRate > 0.85) {
      insights.push({
        type: 'pattern',
        description: `High success rate maintained: ${(metrics.successRate * 100).toFixed(1)}%`,
        confidence: 0.9,
        evidence: ['Consistent positive outcomes', 'Strategy effectiveness confirmed']
      });
    }

    // Insight de padrões de falha
    const criticalReviews = reviews.filter(r => r.assessment === 'critical');
    if (criticalReviews.length > 0) {
      insights.push({
        type: 'anomaly',
        description: `${criticalReviews.length} critical decision failures detected`,
        confidence: 0.95,
        evidence: criticalReviews.map(r => r.findings[0] || 'Critical assessment')
      });
    }

    // Insight de tendência
    const trend = this.detectTrend();
    if (trend) {
      insights.push({
        type: 'trend',
        description: `Performance ${trend.direction}: ${(trend.change * 100).toFixed(1)}% over ${trend.samples} samples`,
        confidence: Math.min(0.9, 0.5 + trend.samples * 0.05),
        evidence: [`Metric: ${trend.metric}`, `Direction: ${trend.direction}`]
      });
    }

    // Insight de correlações
    const correlations = this.findCorrelations();
    for (const corr of correlations.slice(0, 2)) {
      insights.push({
        type: 'correlation',
        description: corr.description,
        confidence: corr.strength,
        evidence: corr.evidence
      });
    }

    return insights.slice(0, this.config.maxInsightsPerReport);
  }

  private detectTrend(): PerformanceTrend | null {
    if (this.decisionHistory.length < 10) return null;

    const recent = this.decisionHistory.slice(-10);
    const older = this.decisionHistory.slice(-20, -10);

    if (older.length < 5) return null;

    const recentSuccess = recent.filter(r => r.outcome?.status === 'success').length / recent.length;
    const olderSuccess = older.filter(r => r.outcome?.status === 'success').length / older.length;

    const change = recentSuccess - olderSuccess;
    const direction: PerformanceTrend['direction'] =
      change > 0.1 ? 'improving' :
      change < -0.1 ? 'declining' : 'stable';

    return {
      metric: 'success_rate',
      direction,
      change,
      samples: recent.length + older.length
    };
  }

  private findCorrelations(): { description: string; strength: number; evidence: string[] }[] {
    const correlations: { description: string; strength: number; evidence: string[] }[] = [];

    // Correlação: Confiança alta -> Sucesso
    const highConfidence = this.decisionHistory.filter(r => r.decision.confidenceScore > 0.7);
    const highConfidenceSuccess = highConfidence.filter(r => r.outcome?.status === 'success');
    if (highConfidence.length > 5) {
      const rate = highConfidenceSuccess.length / highConfidence.length;
      if (rate > 0.7) {
        correlations.push({
          description: 'High confidence strongly correlates with successful outcomes',
          strength: rate,
          evidence: [`${highConfidenceSuccess.length}/${highConfidence.length} high-confidence decisions succeeded`]
        });
      }
    }

    // Correlação: Abordagem conservadora -> Menos erros
    const conservative = this.decisionHistory.filter(r => r.decision.approach === 'conservative' && r.outcome);
    const conservativeErrors = conservative.filter(r => (r.outcome?.errors?.length ?? 0) > 0);
    if (conservative.length > 5) {
      const errorRate = conservativeErrors.length / conservative.length;
      if (errorRate < 0.3) {
        correlations.push({
          description: 'Conservative approach correlates with lower error rates',
          strength: 1 - errorRate,
          evidence: [`Only ${conservativeErrors.length}/${conservative.length} conservative decisions had errors`]
        });
      }
    }

    return correlations;
  }

  // ========== Recomendações ==========

  /**
   * Gera recomendações baseadas nos insights e refinamentos
   */
  private generateRecommendations(
    insights: Insight[],
    refinements: StrategyRefinement[]
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Recomendações de insights
    for (const insight of insights) {
      if (insight.type === 'anomaly') {
        recommendations.push({
          type: 'warning',
          description: `Address: ${insight.description}`,
          priority: 'high',
          actionable: true
        });
      } else if (insight.type === 'trend' && insight.description.includes('declining')) {
        recommendations.push({
          type: 'improvement',
          description: `Investigate declining performance: ${insight.description}`,
          priority: 'high',
          actionable: true
        });
      }
    }

    // Recomendações de refinamentos
    for (const refinement of refinements) {
      recommendations.push({
        type: 'optimization',
        description: `${refinement.area}: ${refinement.suggestedApproach}`,
        priority: refinement.priority,
        actionable: true
      });
    }

    // Recomendações baseadas em aprendizados
    for (const learning of this.learningPoints.filter(l => l.actionable && l.impact > 0.5)) {
      if (!recommendations.some(r => r.description.includes(learning.description))) {
        recommendations.push({
          type: learning.type === 'risk' ? 'warning' : 'improvement',
          description: learning.description,
          priority: learning.impact > 0.7 ? 'high' : 'normal',
          actionable: true
        });
      }
    }

    return recommendations;
  }

  // ========== Aprendizado ==========

  private updateLearningPoints(insights: Insight[]): void {
    for (const insight of insights) {
      const existing = this.learningPoints.find(l =>
        l.description.toLowerCase().includes(insight.description.toLowerCase().slice(0, 30))
      );

      if (existing) {
        existing.frequency++;
        existing.impact = Math.max(existing.impact, insight.confidence);
      } else {
        const type: LearningPoint['type'] =
          insight.type === 'anomaly' ? 'failure_pattern' :
          insight.type === 'pattern' ? 'success_pattern' :
          insight.type === 'trend' ? 'optimization' : 'risk';

        this.learningPoints.push({
          type,
          description: insight.description,
          frequency: 1,
          impact: insight.confidence,
          actionable: true
        });
      }
    }

    // Limitar tamanho
    if (this.learningPoints.length > 50) {
      this.learningPoints.sort((a, b) => b.impact * b.frequency - a.impact * a.frequency);
      this.learningPoints = this.learningPoints.slice(0, 50);
    }
  }

  private updatePerformanceTrends(metrics: ReflectionMetrics): void {
    // Atualizar tendência de sucesso
    const existingSuccessTrend = this.performanceTrends.find(t => t.metric === 'success_rate');
    const newTrend = this.detectTrend();

    if (newTrend) {
      if (existingSuccessTrend) {
        Object.assign(existingSuccessTrend, newTrend);
      } else {
        this.performanceTrends.push(newTrend);
      }
    }
  }

  /**
   * Gera resumo da reflexão
   */
  private generateSummary(reviews: ReviewResult[], metrics: ReflectionMetrics): string {
    const parts: string[] = [];

    parts.push(`Analyzed ${metrics.totalDecisions} decisions`);
    parts.push(`Success rate: ${(metrics.successRate * 100).toFixed(1)}%`);
    parts.push(`Reviews: ${reviews.length} (${reviews.filter(r => r.assessment === 'excellent' || r.assessment === 'good').length} positive)`);

    const criticalCount = reviews.filter(r => r.assessment === 'critical').length;
    if (criticalCount > 0) {
      parts.push(`ATTENTION: ${criticalCount} critical issues found`);
    }

    return parts.join('; ');
  }

  /**
   * Extrai decisões do input
   */
  private extractDecisions(input: Record<string, unknown>): string[] {
    if (Array.isArray(input.recent_decisions)) {
      return input.recent_decisions as string[];
    }
    if (Array.isArray(input.decisions)) {
      return input.decisions as string[];
    }
    return [];
  }

  // ========== Utilitários Públicos ==========

  /**
   * Obtém histórico de decisões
   */
  getDecisionHistory(): DecisionRecord[] {
    return [...this.decisionHistory];
  }

  /**
   * Obtém aprendizados
   */
  getLearningPoints(): LearningPoint[] {
    return [...this.learningPoints];
  }

  /**
   * Obtém tendências
   */
  getPerformanceTrends(): PerformanceTrend[] {
    return [...this.performanceTrends];
  }
}

// ========== Funções Exportadas (Compatibilidade) ==========

export function reviewDecisions(decisions: string[]): { findings: string[] } {
  if (!decisions.length) {
    return { findings: ['no_decisions'] };
  }

  const findings = decisions.length > 3 ? ['overcommitment_risk'] : ['decisions_ok'];
  return { findings };
}

export function refineStrategy(findings: string[]): { adjustments: string[] } {
  const adjustments = findings.includes('overcommitment_risk')
    ? ['reduce_parallelism', 'tighten_scope']
    : ['maintain_strategy'];

  return { adjustments };
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE2:M7] Testando Self Reflection...\n');

  async function runTests() {
    const reflection = new SelfReflection();
    await reflection.initialize();

    // Teste 1: Registrar decisões
    console.log('=== Teste 1: Registrar Decisões ===');
    const testDecisions: StrategicDecision[] = [
      {
        id: 'dec_1',
        priority: 'high',
        approach: 'balanced',
        confidence: 'high',
        confidenceScore: 0.85,
        selectedAgents: ['assistant', 'researcher'],
        recommendedTools: ['ChainOfThought', 'DataTransformer'],
        planSteps: [],
        strategicAnalysis: { goalAlignment: 0.8, feasibility: 0.7, resourceCost: 0.5, expectedDuration: 5000, objectives: [], constraints: [] },
        risks: [],
        timeoutMs: 10000,
        createdAt: Date.now(),
        reasoning: 'Test decision 1'
      },
      {
        id: 'dec_2',
        priority: 'normal',
        approach: 'conservative',
        confidence: 'medium',
        confidenceScore: 0.6,
        selectedAgents: ['assistant'],
        recommendedTools: ['InputValidator'],
        planSteps: [],
        strategicAnalysis: { goalAlignment: 0.6, feasibility: 0.8, resourceCost: 0.3, expectedDuration: 3000, objectives: [], constraints: [] },
        risks: [{ id: 'r1', type: 'technical', severity: 'medium', description: 'Potential timeout' }],
        timeoutMs: 5000,
        createdAt: Date.now(),
        reasoning: 'Test decision 2'
      },
      {
        id: 'dec_3',
        priority: 'critical',
        approach: 'aggressive',
        confidence: 'high',
        confidenceScore: 0.9,
        selectedAgents: ['assistant', 'executor'],
        recommendedTools: ['ChainOfThought', 'ReportGenerator'],
        planSteps: [],
        strategicAnalysis: { goalAlignment: 0.9, feasibility: 0.6, resourceCost: 0.7, expectedDuration: 8000, objectives: [], constraints: [] },
        risks: [],
        timeoutMs: 15000,
        createdAt: Date.now(),
        reasoning: 'Test decision 3'
      }
    ];

    for (const decision of testDecisions) {
      reflection.recordDecision(decision);
    }
    console.log('Decisões registradas:', reflection.getDecisionHistory().length);

    // Teste 2: Registrar outcomes
    console.log('\n=== Teste 2: Registrar Outcomes ===');
    reflection.recordOutcome('dec_1', {
      id: 'out_1', planId: 'plan_1', decisionId: 'dec_1',
      status: 'success', duration: 4500, stepsCompleted: 3, stepsTotal: 3,
      errors: [], startedAt: Date.now() - 5000, completedAt: Date.now()
    });
    reflection.recordOutcome('dec_2', {
      id: 'out_2', planId: 'plan_2', decisionId: 'dec_2',
      status: 'success', duration: 2800, stepsCompleted: 2, stepsTotal: 2,
      errors: [], startedAt: Date.now() - 3000, completedAt: Date.now()
    });
    reflection.recordOutcome('dec_3', {
      id: 'out_3', planId: 'plan_3', decisionId: 'dec_3',
      status: 'failure', duration: 12000, stepsCompleted: 1, stepsTotal: 3,
      errors: [{ stepId: 's2', code: 'TIMEOUT', message: 'Step timed out', recoverable: false }],
      startedAt: Date.now() - 12000, completedAt: Date.now()
    });
    console.log('Outcomes registrados');

    // Teste 3: Reflexão
    console.log('\n=== Teste 3: Reflexão Completa ===');
    const report = await reflection.reflect({
      recent_decisions: ['dec_1', 'dec_2', 'dec_3']
    });
    console.log('Sumário:', report.summary);
    console.log('Métricas:', {
      totalDecisions: report.metrics.totalDecisions,
      successRate: (report.metrics.successRate * 100).toFixed(1) + '%',
      avgConfidence: report.metrics.avgConfidence.toFixed(2)
    });
    console.log('Insights:', report.insights.length);
    for (const insight of report.insights.slice(0, 3)) {
      console.log(`  [${insight.type}] ${insight.description}`);
    }
    console.log('Recomendações:', report.recommendations.length);
    for (const rec of report.recommendations.slice(0, 3)) {
      console.log(`  [${rec.priority}] ${rec.type}: ${rec.description}`);
    }

    // Teste 4: Aprendizados
    console.log('\n=== Teste 4: Aprendizados ===');
    const learnings = reflection.getLearningPoints();
    console.log('Pontos de aprendizado:', learnings.length);
    for (const learning of learnings.slice(0, 3)) {
      console.log(`  [${learning.type}] ${learning.description} (impact: ${learning.impact.toFixed(2)})`);
    }

    console.log('\n[AE2:M7] Status:', reflection.getStatus());
    console.log('\n[AE2:M7] ✓ Self Reflection testado com sucesso');
  }

  runTests().catch(console.error);
}
