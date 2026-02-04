/**
 * Tipos para o Sistema de Aprendizado AE1
 *
 * Define interfaces e tipos para:
 * - Configuracao do motor de aprendizado
 * - Metricas com janela de tempo
 * - Historico de aprendizado
 * - Relatorios de anomalias e vieses
 */

import type { PerformanceSnapshot } from "./performance-tracker";
import type { FeedbackResult } from "./feedback-loop";

// ============================================================================
// Configuracao
// ============================================================================

/**
 * Configuracao do motor de aprendizado
 */
export interface LearningConfig {
  /** Janela de tempo para metricas recentes (ms) - default: 1 hora */
  recentWindowMs: number;
  /** Numero minimo de amostras para analise - default: 10 */
  minSampleSize: number;
  /** Limiar de taxa de sucesso para alerta - default: 0.7 */
  successRateThreshold: number;
  /** Limiar de duracao lenta (ms) - default: 5000 */
  slowDurationThresholdMs: number;
  /** Intervalo de persistencia (ms) - default: 5 minutos */
  persistenceIntervalMs: number;
  /** Habilitar deteccao de anomalias - default: true */
  enableAnomalyDetection: boolean;
  /** Tamanho maximo do historico - default: 100 */
  maxHistorySize: number;
}

/**
 * Configuracao padrao
 */
export const DEFAULT_LEARNING_CONFIG: LearningConfig = {
  recentWindowMs: 3600000,        // 1 hora
  minSampleSize: 10,
  successRateThreshold: 0.7,
  slowDurationThresholdMs: 5000,
  persistenceIntervalMs: 300000,  // 5 minutos
  enableAnomalyDetection: true,
  maxHistorySize: 100,
};

// ============================================================================
// Metricas com Janela de Tempo
// ============================================================================

/**
 * Tendencia de metricas
 */
export type Trend = 'improving' | 'stable' | 'degrading';

/**
 * Metricas calculadas dentro de uma janela de tempo
 */
export interface TimeWindowedMetrics {
  /** Inicio da janela */
  window_start: Date;
  /** Fim da janela */
  window_end: Date;
  /** Taxa de sucesso na janela */
  success_rate: number;
  /** Duracao media na janela */
  avg_duration_ms: number;
  /** Total de execucoes na janela */
  total_executions: number;
  /** Tendencia comparada com janela anterior */
  trend: Trend;
  /** Percentis de duracao */
  percentiles?: {
    p50: number;
    p90: number;
    p99: number;
  };
}

// ============================================================================
// Historico de Aprendizado
// ============================================================================

/**
 * Entrada no historico de aprendizado
 */
export interface LearningHistoryEntry {
  /** ID unico da entrada */
  id: string;
  /** Timestamp da criacao */
  timestamp: Date;
  /** Relatorio de aprendizado */
  report: LearningReport;
  /** Metricas com janela de tempo */
  metrics: TimeWindowedMetrics;
  /** Anomalias detectadas */
  anomalies: AnomalyReport[];
  /** Vieses detectados */
  biases: BiasReport[];
}

// ============================================================================
// Relatorios de Anomalias
// ============================================================================

/**
 * Tipos de anomalias detectaveis
 */
export type AnomalyType =
  | 'duration_spike'    // Pico de duracao
  | 'failure_burst'     // Rajada de falhas
  | 'pattern_shift'     // Mudanca de padrao
  | 'volume_anomaly';   // Volume anormal

/**
 * Severidade de anomalia
 */
export type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Relatorio de anomalia detectada
 */
export interface AnomalyReport {
  /** Tipo de anomalia */
  type: AnomalyType;
  /** Severidade */
  severity: Severity;
  /** Descricao legivel */
  description: string;
  /** Quando foi detectada */
  detected_at: Date;
  /** Periodo afetado */
  affected_period: {
    start: Date;
    end: Date;
  };
  /** Valor observado */
  observed_value?: number;
  /** Valor esperado/baseline */
  expected_value?: number;
  /** Desvio percentual */
  deviation_percent?: number;
}

// ============================================================================
// Relatorios de Vieses
// ============================================================================

/**
 * Tipos de vieses detectaveis
 */
export type BiasType =
  | 'recency_bias'        // Vies de recencia - peso excessivo em eventos recentes
  | 'confirmation_bias'   // Vies de confirmacao - preferencia por tipos conhecidos
  | 'selection_bias'      // Vies de selecao - amostra nao representativa
  | 'survivor_bias'       // Vies de sobrevivente - ignora falhas
  | 'anchoring_bias';     // Vies de ancoragem - fixacao em valores iniciais

/**
 * Relatorio de vies detectado
 */
export interface BiasReport {
  /** Tipo de vies */
  type: BiasType;
  /** Confianca na deteccao (0-1) */
  confidence: number;
  /** Evidencias que suportam a deteccao */
  evidence: string[];
  /** Recomendacao para mitigar */
  recommendation: string;
  /** Quando foi detectado */
  detected_at: Date;
}

// ============================================================================
// Relatorio Principal de Aprendizado
// ============================================================================

/**
 * Relatorio completo de aprendizado
 */
export interface LearningReport {
  /** Metricas de performance */
  performance: PerformanceSnapshot;
  /** Resultado do loop de feedback */
  feedback: FeedbackResult;
  /** Lista de vieses detectados (compatibilidade) */
  biases: string[];
  /** Relatorios detalhados de vieses */
  biasReports?: BiasReport[];
  /** Anomalias detectadas */
  anomalies?: AnomalyReport[];
  /** Metricas com janela de tempo */
  windowedMetrics?: TimeWindowedMetrics;
  /** Tendencia geral */
  trend?: Trend;
  /** Timestamp do relatorio */
  timestamp: Date;
}

// ============================================================================
// Acoes Priorizadas
// ============================================================================

/**
 * Prioridade de acao
 */
export type ActionPriority = 'critical' | 'high' | 'medium' | 'low';

/**
 * Acao priorizada com contexto
 */
export interface PrioritizedAction {
  /** Nome da acao */
  action: string;
  /** Prioridade */
  priority: ActionPriority;
  /** Razao para a acao */
  reason: string;
  /** Impacto estimado */
  estimated_impact?: string;
}

// ============================================================================
// Configuracao de Feedback
// ============================================================================

/**
 * Configuracao para o loop de feedback
 */
export interface FeedbackConfig {
  /** Limiar de duracao lenta (ms) */
  slowThresholdMs: number;
  /** Limiar de taxa de sucesso baixa */
  lowSuccessRateThreshold: number;
  /** Limiar de taxa de sucesso alta (excelente) */
  highSuccessRateThreshold: number;
}

/**
 * Configuracao padrao de feedback
 */
export const DEFAULT_FEEDBACK_CONFIG: FeedbackConfig = {
  slowThresholdMs: 5000,
  lowSuccessRateThreshold: 0.7,
  highSuccessRateThreshold: 0.95,
};
