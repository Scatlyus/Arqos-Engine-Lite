/**
 * Contextual Awareness - Módulo M5 do AE2
 * Responsável por monitoramento ambiental, avaliação situacional e análise de contexto
 */

import type {
  DecisionContext,
  EnvironmentalContext,
  CognitiveContext,
  ModuleStatus,
  Agent
} from '../../types';

// ========== Configurações ==========

interface ContextualAwarenessConfig {
  /** Intervalo de monitoramento em ms */
  monitoringInterval: number;
  /** Número de sinais a manter no histórico */
  signalHistorySize: number;
  /** Threshold para detectar anomalia de carga */
  loadAnomalyThreshold: number;
  /** Threshold para detectar alta utilização */
  highUtilizationThreshold: number;
  /** Janela de tempo para análise de tendência (ms) */
  trendWindowMs: number;
  /** Número de avaliações a manter no cache */
  assessmentCacheSize: number;
}

const DEFAULT_CONFIG: ContextualAwarenessConfig = {
  monitoringInterval: 5000,
  signalHistorySize: 100,
  loadAnomalyThreshold: 0.8,
  highUtilizationThreshold: 0.75,
  trendWindowMs: 60000,
  assessmentCacheSize: 50
};

// ========== Tipos Internos ==========

interface EnvironmentSnapshot {
  timestamp: number;
  systemLoad: number;
  memoryUsage: number;
  activeAgents: number;
  totalAgents: number;
  activeProcesses: number;
  queuedTasks: number;
  resourceUtilization: number;
  signals: EnvironmentSignal[];
}

interface EnvironmentSignal {
  type: SignalType;
  source: string;
  value: number | string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
}

type SignalType =
  | 'load_spike'
  | 'memory_pressure'
  | 'agent_offline'
  | 'agent_overloaded'
  | 'queue_overflow'
  | 'slow_response'
  | 'error_rate_high'
  | 'resource_contention'
  | 'pattern_detected'
  | 'anomaly'
  | 'recovery';

interface SituationAssessment {
  id: string;
  timestamp: number;
  overallStatus: 'healthy' | 'degraded' | 'critical' | 'unknown';
  complexity: 'low' | 'medium' | 'high';
  risk: 'low' | 'medium' | 'high';
  urgency: 'low' | 'normal' | 'high' | 'critical';
  factors: AssessmentFactor[];
  recommendations: string[];
  confidence: number;
}

interface AssessmentFactor {
  name: string;
  value: number;
  weight: number;
  impact: 'positive' | 'neutral' | 'negative';
  description: string;
}

interface ContextTrend {
  metric: string;
  direction: 'increasing' | 'stable' | 'decreasing';
  rate: number;
  samples: number;
  confidence: number;
}

interface AwarenessState {
  currentSnapshot: EnvironmentSnapshot | null;
  situationAssessment: SituationAssessment | null;
  trends: ContextTrend[];
  alertLevel: 'normal' | 'elevated' | 'high' | 'critical';
}

// ========== Classe Principal ==========

export class ContextualAwareness {
  private config: ContextualAwarenessConfig;
  private initialized = false;
  private lastActivity?: number;

  // Estado interno
  private signalHistory: EnvironmentSignal[] = [];
  private snapshotHistory: EnvironmentSnapshot[] = [];
  private assessmentCache: SituationAssessment[] = [];
  private state: AwarenessState = {
    currentSnapshot: null,
    situationAssessment: null,
    trends: [],
    alertLevel: 'normal'
  };

  // Métricas
  private totalSnapshots = 0;
  private totalAssessments = 0;
  private anomaliesDetected = 0;

  constructor(config: Partial<ContextualAwarenessConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    console.log('[AE2:M5] Contextual Awareness initializing...');
    this.initialized = true;
    this.lastActivity = Date.now();
    console.log('[AE2:M5] Contextual Awareness initialized ✓');
  }

  getStatus(): ModuleStatus {
    return {
      name: 'ContextualAwareness',
      initialized: this.initialized,
      healthy: this.initialized,
      lastActivity: this.lastActivity,
      stats: {
        totalSnapshots: this.totalSnapshots,
        totalAssessments: this.totalAssessments,
        anomaliesDetected: this.anomaliesDetected,
        signalHistorySize: this.signalHistory.length,
        currentAlertLevel: this.state.alertLevel,
        activeTrends: this.state.trends.length
      }
    };
  }

  // ========== Monitoramento de Ambiente ==========

  /**
   * Captura snapshot do ambiente atual
   */
  captureSnapshot(metrics?: Partial<EnvironmentSnapshot>): EnvironmentSnapshot {
    this.lastActivity = Date.now();
    this.totalSnapshots++;

    const snapshot: EnvironmentSnapshot = {
      timestamp: Date.now(),
      systemLoad: metrics?.systemLoad ?? this.measureSystemLoad(),
      memoryUsage: metrics?.memoryUsage ?? this.measureMemoryUsage(),
      activeAgents: metrics?.activeAgents ?? 0,
      totalAgents: metrics?.totalAgents ?? 0,
      activeProcesses: metrics?.activeProcesses ?? 0,
      queuedTasks: metrics?.queuedTasks ?? 0,
      resourceUtilization: metrics?.resourceUtilization ?? 0,
      signals: this.collectSignals(metrics)
    };

    // Atualizar histórico
    this.snapshotHistory.push(snapshot);
    if (this.snapshotHistory.length > this.config.signalHistorySize) {
      this.snapshotHistory.shift();
    }

    // Atualizar estado
    this.state.currentSnapshot = snapshot;

    // Detectar anomalias
    this.detectAnomalies(snapshot);

    // Atualizar tendências
    this.updateTrends();

    return snapshot;
  }

  /**
   * Monitora ambiente de forma contínua (retorna sinais)
   */
  monitorEnvironment(signals: string[] = []): { signals: string[]; environment: EnvironmentSnapshot } {
    const snapshot = this.captureSnapshot();

    // Converter sinais para formato esperado
    const formattedSignals = signals.length > 0
      ? signals
      : snapshot.signals.map(s => `${s.type}:${s.source}`);

    return {
      signals: formattedSignals.length > 0 ? formattedSignals : ['no_signals'],
      environment: snapshot
    };
  }

  // ========== Avaliação Situacional ==========

  /**
   * Avalia a situação atual do sistema
   */
  assessSituation(signals: string[] = []): SituationAssessment {
    this.lastActivity = Date.now();
    this.totalAssessments++;

    const snapshot = this.state.currentSnapshot || this.captureSnapshot();
    const factors = this.evaluateFactors(snapshot, signals);
    const overallStatus = this.determineOverallStatus(factors);
    const complexity = this.calculateComplexity(snapshot, signals);
    const risk = this.calculateRisk(factors, this.state.trends);
    const urgency = this.calculateUrgency(overallStatus, risk, factors);
    const recommendations = this.generateRecommendations(factors, overallStatus);
    const confidence = this.calculateAssessmentConfidence(factors);

    const assessment: SituationAssessment = {
      id: `assess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: Date.now(),
      overallStatus,
      complexity,
      risk,
      urgency,
      factors,
      recommendations,
      confidence
    };

    // Atualizar cache
    this.assessmentCache.push(assessment);
    if (this.assessmentCache.length > this.config.assessmentCacheSize) {
      this.assessmentCache.shift();
    }

    // Atualizar estado
    this.state.situationAssessment = assessment;
    this.state.alertLevel = this.mapStatusToAlertLevel(overallStatus);

    return assessment;
  }

  /**
   * Análise completa do contexto
   */
  async analyze(signals: string[] = []): Promise<{
    signals: string[];
    environment: EnvironmentSnapshot;
    situation: SituationAssessment;
    trends: ContextTrend[];
    alertLevel: string;
  }> {
    const envResult = this.monitorEnvironment(signals);
    const situation = this.assessSituation(envResult.signals);

    return {
      signals: envResult.signals,
      environment: envResult.environment,
      situation,
      trends: this.state.trends,
      alertLevel: this.state.alertLevel
    };
  }

  // ========== Contexto para Decisões ==========

  /**
   * Obtém contexto ambiental para decisões
   */
  getEnvironmentalContext(): EnvironmentalContext {
    const snapshot = this.state.currentSnapshot || this.captureSnapshot();

    return {
      systemLoad: snapshot.systemLoad,
      availableAgents: snapshot.activeAgents,
      activeProcesses: snapshot.activeProcesses,
      resourceUtilization: snapshot.resourceUtilization
    };
  }

  /**
   * Obtém contexto cognitivo (integrando com AE1)
   */
  getCognitiveContext(patterns: string[] = [], preferences: Record<string, unknown> = {}): CognitiveContext {
    // Extrair padrões recentes dos sinais
    const recentPatterns = this.extractRecentPatterns();

    return {
      recentPatterns: [...patterns, ...recentPatterns],
      userPreferences: preferences,
      learningInsights: this.generateLearningInsights()
    };
  }

  /**
   * Enriquece um contexto de decisão com awareness
   */
  enrichDecisionContext(context: DecisionContext): DecisionContext {
    const assessment = this.state.situationAssessment || this.assessSituation();
    const environmental = this.getEnvironmentalContext();

    // Ajustar urgência baseado na avaliação
    let adjustedUrgency = context.urgency ?? 50;
    if (assessment.urgency === 'critical') {
      adjustedUrgency = Math.max(adjustedUrgency, 90);
    } else if (assessment.urgency === 'high') {
      adjustedUrgency = Math.max(adjustedUrgency, 70);
    }

    // Ajustar complexidade baseado no ambiente
    let adjustedComplexity = context.complexity ?? 50;
    if (assessment.complexity === 'high') {
      adjustedComplexity = Math.min(100, adjustedComplexity + 20);
    }

    return {
      ...context,
      urgency: adjustedUrgency,
      complexity: adjustedComplexity,
      metadata: {
        ...context.metadata,
        environmentalContext: environmental,
        situationAssessment: {
          status: assessment.overallStatus,
          risk: assessment.risk,
          confidence: assessment.confidence
        }
      }
    };
  }

  // ========== Registro de Sinais ==========

  /**
   * Registra um sinal manualmente
   */
  registerSignal(signal: Omit<EnvironmentSignal, 'timestamp'>): void {
    const fullSignal: EnvironmentSignal = {
      ...signal,
      timestamp: Date.now()
    };

    this.signalHistory.push(fullSignal);

    // Manter tamanho do histórico
    if (this.signalHistory.length > this.config.signalHistorySize) {
      this.signalHistory.shift();
    }

    // Verificar se é anomalia
    if (signal.severity === 'critical' || signal.type === 'anomaly') {
      this.anomaliesDetected++;
    }
  }

  /**
   * Obtém sinais recentes
   */
  getRecentSignals(count: number = 10): EnvironmentSignal[] {
    return this.signalHistory.slice(-count);
  }

  // ========== Análise de Tendências ==========

  /**
   * Obtém tendências atuais
   */
  getTrends(): ContextTrend[] {
    return this.state.trends;
  }

  /**
   * Obtém estado atual de awareness
   */
  getAwarenessState(): AwarenessState {
    return { ...this.state };
  }

  // ========== Métodos Privados ==========

  private measureSystemLoad(): number {
    // Simular medição de carga do sistema
    const baseLoad = 0.3;
    const variance = Math.random() * 0.4;
    return Math.min(1, baseLoad + variance);
  }

  private measureMemoryUsage(): number {
    // Simular medição de memória
    const baseUsage = 0.4;
    const variance = Math.random() * 0.3;
    return Math.min(1, baseUsage + variance);
  }

  private collectSignals(metrics?: Partial<EnvironmentSnapshot>): EnvironmentSignal[] {
    const signals: EnvironmentSignal[] = [];
    const now = Date.now();

    // Verificar carga do sistema
    const systemLoad = metrics?.systemLoad ?? this.measureSystemLoad();
    if (systemLoad > this.config.highUtilizationThreshold) {
      signals.push({
        type: 'load_spike',
        source: 'system',
        value: systemLoad,
        severity: systemLoad > 0.9 ? 'critical' : 'warning',
        timestamp: now
      });
    }

    // Verificar memória
    const memoryUsage = metrics?.memoryUsage ?? this.measureMemoryUsage();
    if (memoryUsage > 0.85) {
      signals.push({
        type: 'memory_pressure',
        source: 'system',
        value: memoryUsage,
        severity: memoryUsage > 0.95 ? 'critical' : 'warning',
        timestamp: now
      });
    }

    // Verificar fila de tarefas
    const queuedTasks = metrics?.queuedTasks ?? 0;
    if (queuedTasks > 50) {
      signals.push({
        type: 'queue_overflow',
        source: 'task_queue',
        value: queuedTasks,
        severity: queuedTasks > 100 ? 'critical' : 'warning',
        timestamp: now
      });
    }

    // Adicionar sinais ao histórico
    for (const signal of signals) {
      this.signalHistory.push(signal);
    }

    // Manter tamanho do histórico
    while (this.signalHistory.length > this.config.signalHistorySize) {
      this.signalHistory.shift();
    }

    return signals;
  }

  private detectAnomalies(snapshot: EnvironmentSnapshot): void {
    // Detectar anomalias comparando com histórico
    if (this.snapshotHistory.length < 5) return;

    const recentSnapshots = this.snapshotHistory.slice(-10);
    const avgLoad = recentSnapshots.reduce((sum, s) => sum + s.systemLoad, 0) / recentSnapshots.length;

    // Detectar spike de carga
    if (snapshot.systemLoad > avgLoad * 1.5 && snapshot.systemLoad > this.config.loadAnomalyThreshold) {
      this.anomaliesDetected++;
      this.registerSignal({
        type: 'anomaly',
        source: 'load_detector',
        value: snapshot.systemLoad,
        severity: 'warning'
      });
    }
  }

  private updateTrends(): void {
    if (this.snapshotHistory.length < 3) return;

    const windowStart = Date.now() - this.config.trendWindowMs;
    const relevantSnapshots = this.snapshotHistory.filter(s => s.timestamp >= windowStart);

    if (relevantSnapshots.length < 3) return;

    // Calcular tendência de carga
    const loadTrend = this.calculateTrend(
      relevantSnapshots.map(s => ({ value: s.systemLoad, timestamp: s.timestamp })),
      'systemLoad'
    );

    // Calcular tendência de memória
    const memoryTrend = this.calculateTrend(
      relevantSnapshots.map(s => ({ value: s.memoryUsage, timestamp: s.timestamp })),
      'memoryUsage'
    );

    // Calcular tendência de utilização
    const utilizationTrend = this.calculateTrend(
      relevantSnapshots.map(s => ({ value: s.resourceUtilization, timestamp: s.timestamp })),
      'resourceUtilization'
    );

    this.state.trends = [loadTrend, memoryTrend, utilizationTrend].filter(t => t.confidence > 0.5);
  }

  private calculateTrend(
    data: { value: number; timestamp: number }[],
    metric: string
  ): ContextTrend {
    if (data.length < 2) {
      return { metric, direction: 'stable', rate: 0, samples: 0, confidence: 0 };
    }

    // Regressão linear simples
    const n = data.length;
    const sumX = data.reduce((sum, d, i) => sum + i, 0);
    const sumY = data.reduce((sum, d) => sum + d.value, 0);
    const sumXY = data.reduce((sum, d, i) => sum + i * d.value, 0);
    const sumX2 = data.reduce((sum, d, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    let direction: ContextTrend['direction'];
    if (Math.abs(slope) < 0.01) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    // Calcular confiança baseado na variância
    const avgY = sumY / n;
    const variance = data.reduce((sum, d) => sum + Math.pow(d.value - avgY, 2), 0) / n;
    const confidence = Math.max(0, 1 - Math.sqrt(variance));

    return {
      metric,
      direction,
      rate: Math.abs(slope),
      samples: n,
      confidence
    };
  }

  private evaluateFactors(snapshot: EnvironmentSnapshot, signals: string[]): AssessmentFactor[] {
    const factors: AssessmentFactor[] = [];

    // Fator: Carga do Sistema
    factors.push({
      name: 'system_load',
      value: snapshot.systemLoad,
      weight: 0.3,
      impact: snapshot.systemLoad > 0.8 ? 'negative' : snapshot.systemLoad > 0.6 ? 'neutral' : 'positive',
      description: `System load at ${(snapshot.systemLoad * 100).toFixed(1)}%`
    });

    // Fator: Uso de Memória
    factors.push({
      name: 'memory_usage',
      value: snapshot.memoryUsage,
      weight: 0.25,
      impact: snapshot.memoryUsage > 0.85 ? 'negative' : snapshot.memoryUsage > 0.7 ? 'neutral' : 'positive',
      description: `Memory usage at ${(snapshot.memoryUsage * 100).toFixed(1)}%`
    });

    // Fator: Disponibilidade de Agentes
    const agentAvailability = snapshot.totalAgents > 0
      ? snapshot.activeAgents / snapshot.totalAgents
      : 0;
    factors.push({
      name: 'agent_availability',
      value: agentAvailability,
      weight: 0.2,
      impact: agentAvailability < 0.3 ? 'negative' : agentAvailability < 0.6 ? 'neutral' : 'positive',
      description: `${snapshot.activeAgents}/${snapshot.totalAgents} agents available`
    });

    // Fator: Utilização de Recursos
    factors.push({
      name: 'resource_utilization',
      value: snapshot.resourceUtilization,
      weight: 0.15,
      impact: snapshot.resourceUtilization > 0.9 ? 'negative' : snapshot.resourceUtilization > 0.7 ? 'neutral' : 'positive',
      description: `Resource utilization at ${(snapshot.resourceUtilization * 100).toFixed(1)}%`
    });

    // Fator: Sinais de Alerta
    const criticalSignals = snapshot.signals.filter(s => s.severity === 'critical').length;
    const warningSignals = snapshot.signals.filter(s => s.severity === 'warning').length;
    const signalScore = Math.max(0, 1 - (criticalSignals * 0.3 + warningSignals * 0.1));
    factors.push({
      name: 'signal_health',
      value: signalScore,
      weight: 0.1,
      impact: criticalSignals > 0 ? 'negative' : warningSignals > 2 ? 'neutral' : 'positive',
      description: `${criticalSignals} critical, ${warningSignals} warning signals`
    });

    return factors;
  }

  private determineOverallStatus(factors: AssessmentFactor[]): SituationAssessment['overallStatus'] {
    const negativeFactors = factors.filter(f => f.impact === 'negative');
    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const negativeWeight = negativeFactors.reduce((sum, f) => sum + f.weight, 0);

    const negativeRatio = negativeWeight / totalWeight;

    if (negativeRatio > 0.5) return 'critical';
    if (negativeRatio > 0.25) return 'degraded';
    if (negativeRatio > 0) return 'healthy';
    return 'healthy';
  }

  private calculateComplexity(
    snapshot: EnvironmentSnapshot,
    signals: string[]
  ): SituationAssessment['complexity'] {
    const signalCount = signals.length + snapshot.signals.length;
    const processCount = snapshot.activeProcesses;

    const complexityScore = (signalCount / 10) + (processCount / 20) + snapshot.systemLoad;

    if (complexityScore > 1.5) return 'high';
    if (complexityScore > 0.8) return 'medium';
    return 'low';
  }

  private calculateRisk(
    factors: AssessmentFactor[],
    trends: ContextTrend[]
  ): SituationAssessment['risk'] {
    // Risco base dos fatores
    const negativeFactors = factors.filter(f => f.impact === 'negative');
    let riskScore = negativeFactors.length * 0.2;

    // Ajustar por tendências
    for (const trend of trends) {
      if (trend.direction === 'increasing' && trend.metric.includes('load')) {
        riskScore += trend.rate * trend.confidence;
      }
    }

    if (riskScore > 0.6) return 'high';
    if (riskScore > 0.3) return 'medium';
    return 'low';
  }

  private calculateUrgency(
    status: SituationAssessment['overallStatus'],
    risk: SituationAssessment['risk'],
    factors: AssessmentFactor[]
  ): SituationAssessment['urgency'] {
    if (status === 'critical') return 'critical';
    if (status === 'degraded' && risk === 'high') return 'high';
    if (risk === 'high') return 'high';
    if (status === 'degraded' || risk === 'medium') return 'normal';
    return 'low';
  }

  private generateRecommendations(
    factors: AssessmentFactor[],
    status: SituationAssessment['overallStatus']
  ): string[] {
    const recommendations: string[] = [];

    for (const factor of factors) {
      if (factor.impact === 'negative') {
        switch (factor.name) {
          case 'system_load':
            recommendations.push('Consider scaling resources or reducing parallel operations');
            break;
          case 'memory_usage':
            recommendations.push('Review memory-intensive operations and consider cleanup');
            break;
          case 'agent_availability':
            recommendations.push('Check agent health and consider starting backup agents');
            break;
          case 'resource_utilization':
            recommendations.push('Optimize resource allocation or queue non-critical tasks');
            break;
          case 'signal_health':
            recommendations.push('Investigate and address active alerts');
            break;
        }
      }
    }

    if (status === 'critical') {
      recommendations.unshift('CRITICAL: Immediate attention required');
    }

    return recommendations;
  }

  private calculateAssessmentConfidence(factors: AssessmentFactor[]): number {
    // Confiança baseada na quantidade de dados disponíveis
    const dataPoints = this.snapshotHistory.length;
    const dataConfidence = Math.min(1, dataPoints / 10);

    // Confiança baseada na consistência dos fatores
    const impacts = factors.map(f => f.impact);
    const consistency = 1 - (new Set(impacts).size - 1) / 2;

    return (dataConfidence * 0.6 + consistency * 0.4);
  }

  private mapStatusToAlertLevel(
    status: SituationAssessment['overallStatus']
  ): AwarenessState['alertLevel'] {
    switch (status) {
      case 'critical': return 'critical';
      case 'degraded': return 'elevated';
      case 'unknown': return 'high';
      default: return 'normal';
    }
  }

  private extractRecentPatterns(): string[] {
    const patterns: string[] = [];
    const recentSignals = this.signalHistory.slice(-20);

    // Agrupar sinais por tipo
    const signalCounts = new Map<string, number>();
    for (const signal of recentSignals) {
      signalCounts.set(signal.type, (signalCounts.get(signal.type) || 0) + 1);
    }

    // Identificar padrões recorrentes
    for (const [type, count] of signalCounts) {
      if (count >= 3) {
        patterns.push(`recurring_${type}`);
      }
    }

    // Identificar tendências
    for (const trend of this.state.trends) {
      if (trend.confidence > 0.7) {
        patterns.push(`${trend.metric}_${trend.direction}`);
      }
    }

    return patterns;
  }

  private generateLearningInsights(): string[] {
    const insights: string[] = [];

    // Insights de tendências
    for (const trend of this.state.trends) {
      if (trend.direction !== 'stable' && trend.confidence > 0.6) {
        insights.push(
          `${trend.metric} is ${trend.direction} at rate ${trend.rate.toFixed(3)}`
        );
      }
    }

    // Insights de anomalias
    if (this.anomaliesDetected > 0) {
      insights.push(`${this.anomaliesDetected} anomalies detected in session`);
    }

    // Insights do status atual
    const assessment = this.state.situationAssessment;
    if (assessment) {
      if (assessment.overallStatus !== 'healthy') {
        insights.push(`System status: ${assessment.overallStatus}`);
      }
    }

    return insights;
  }
}

// ========== Funções Exportadas (Compatibilidade) ==========

export function monitorEnvironment(signals: string[]): { timestamp: string; signals: string[] } {
  return {
    timestamp: new Date().toISOString(),
    signals: signals.length ? signals : ['no_signals']
  };
}

export function assessSituation(signals: string[]): { complexity: string; risk: string } {
  const complexity = signals.length > 4 ? 'high' : signals.length > 2 ? 'medium' : 'low';
  const risk = signals.includes('anomaly') ? 'high' : signals.length ? 'medium' : 'low';

  return { complexity, risk };
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE2:M5] Testando Contextual Awareness...\n');

  async function runTests() {
    const awareness = new ContextualAwareness();
    await awareness.initialize();

    // Teste 1: Capturar Snapshot
    console.log('=== Teste 1: Capturar Snapshot ===');
    const snapshot = awareness.captureSnapshot({
      systemLoad: 0.65,
      memoryUsage: 0.55,
      activeAgents: 3,
      totalAgents: 5,
      activeProcesses: 12,
      queuedTasks: 8,
      resourceUtilization: 0.6
    });
    console.log('Snapshot capturado:', {
      timestamp: new Date(snapshot.timestamp).toISOString(),
      systemLoad: snapshot.systemLoad,
      signals: snapshot.signals.length
    });

    // Teste 2: Avaliar Situação
    console.log('\n=== Teste 2: Avaliar Situação ===');
    const assessment = awareness.assessSituation(['user_request', 'data_fetch']);
    console.log('Avaliação:', {
      status: assessment.overallStatus,
      complexity: assessment.complexity,
      risk: assessment.risk,
      urgency: assessment.urgency,
      confidence: assessment.confidence.toFixed(2)
    });
    console.log('Recomendações:', assessment.recommendations);

    // Teste 3: Simular carga alta
    console.log('\n=== Teste 3: Simular Carga Alta ===');
    for (let i = 0; i < 5; i++) {
      awareness.captureSnapshot({
        systemLoad: 0.7 + i * 0.05,
        memoryUsage: 0.75,
        activeAgents: 2,
        totalAgents: 5,
        activeProcesses: 20,
        queuedTasks: 30 + i * 10,
        resourceUtilization: 0.85
      });
    }

    const criticalAssessment = awareness.assessSituation(['anomaly', 'load_spike']);
    console.log('Avaliação crítica:', {
      status: criticalAssessment.overallStatus,
      risk: criticalAssessment.risk,
      urgency: criticalAssessment.urgency
    });

    // Teste 4: Análise completa
    console.log('\n=== Teste 4: Análise Completa ===');
    const analysis = await awareness.analyze(['pattern_detected', 'optimization_needed']);
    console.log('Análise:', {
      alertLevel: analysis.alertLevel,
      trends: analysis.trends.length,
      signalCount: analysis.signals.length
    });

    // Teste 5: Obter contextos
    console.log('\n=== Teste 5: Contextos ===');
    const envContext = awareness.getEnvironmentalContext();
    console.log('Contexto Ambiental:', envContext);

    const cogContext = awareness.getCognitiveContext(['pattern_a'], { theme: 'dark' });
    console.log('Contexto Cognitivo:', cogContext);

    console.log('\n[AE2:M5] Status:', awareness.getStatus());
    console.log('\n[AE2:M5] ✓ Contextual Awareness testado com sucesso');
  }

  runTests().catch(console.error);
}
