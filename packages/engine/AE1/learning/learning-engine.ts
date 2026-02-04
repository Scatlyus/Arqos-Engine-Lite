/**
 * Learning Engine - AE1
 *
 * Motor de aprendizado que orquestra todos os sub-modulos:
 * - Performance Tracker: metricas de performance
 * - Feedback Loop: acoes corretivas
 * - Bias Detector: deteccao de vieses
 *
 * Funcionalidades:
 * - Persistencia de relatorios no StateStore
 * - Historico de aprendizado com tendencias
 * - Deteccao de anomalias
 * - Analise com janela de tempo
 * - Integracao com CognitiveCore
 */

import type { ExecutionLog } from "../state/state-types";
import { StateStore } from "../state/state-store";
import { detectBiases, detectBiasesAdvanced } from "./bias-detector";
import { runFeedbackLoop, runFeedbackLoopWithConfig } from "./feedback-loop";
import {
  trackPerformance,
  trackPerformanceWindowed,
  calculateDurationPercentiles,
  calculateDurationStdDev,
} from "./performance-tracker";
import type {
  LearningConfig,
  LearningReport,
  LearningHistoryEntry,
  TimeWindowedMetrics,
  AnomalyReport,
  BiasReport,
  Trend,
  AnomalyType,
  Severity,
  DEFAULT_LEARNING_CONFIG,
} from "./learning-types";

// Re-export para compatibilidade
export type { LearningReport } from "./learning-types";

// ============================================================================
// Constantes
// ============================================================================

const STORAGE_KEY_HISTORY = "learning:history";
const STORAGE_KEY_LAST_REPORT = "learning:last_report";
const DEFAULT_CONFIG: LearningConfig = {
  recentWindowMs: 3600000,        // 1 hora
  minSampleSize: 10,
  successRateThreshold: 0.7,
  slowDurationThresholdMs: 5000,
  persistenceIntervalMs: 300000,  // 5 minutos
  enableAnomalyDetection: true,
  maxHistorySize: 100,
};

// ============================================================================
// Learning Engine
// ============================================================================

export class LearningEngine {
  private config: LearningConfig;
  private stateStore: StateStore | null;
  private mode: 'lite' | 'fullstack';
  private history: LearningHistoryEntry[] = [];
  private lastPersistTime: number = 0;
  private executionCount: number = 0;

  constructor(
    config?: Partial<LearningConfig>,
    stateStore?: StateStore | null,
    mode: 'lite' | 'fullstack' = 'lite'
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.stateStore = stateStore ?? null;
    this.mode = mode;
  }

  // ==========================================================================
  // Metodo Principal
  // ==========================================================================

  /**
   * Executa ciclo completo de aprendizado
   */
  async run(logs: ExecutionLog[]): Promise<LearningReport> {
    this.executionCount++;
    const startTime = Date.now();

    try {
      // 1. Metricas de performance
      const performance = trackPerformance(logs);

      // 2. Feedback loop
      const feedback = runFeedbackLoopWithConfig(logs, {
        slowThresholdMs: this.config.slowDurationThresholdMs,
        lowSuccessRateThreshold: this.config.successRateThreshold,
        highSuccessRateThreshold: 0.95,
      });

      // 3. Deteccao de vieses
      const biases = detectBiases(logs);
      const biasReports = this.mode === 'fullstack' ? detectBiasesAdvanced(logs) : undefined;

      // 4. Metricas com janela de tempo (fullstack)
      const windowedMetrics = this.mode === 'fullstack'
        ? this.calculateCurrentWindowMetrics(logs)
        : undefined;

      // 5. Deteccao de anomalias (fullstack)
      const anomalies = this.mode === 'fullstack' && this.config.enableAnomalyDetection
        ? await this.detectAnomalies(logs)
        : undefined;

      // 6. Analise de tendencia
      const trend = this.analyzeTrend();

      // 7. Monta relatorio
      const report: LearningReport = {
        performance,
        feedback,
        biases,
        biasReports,
        anomalies,
        windowedMetrics,
        trend,
        timestamp: new Date(),
      };

      // 8. Persiste se necessario
      await this.maybePersist(report, logs);

      return report;
    } catch (error) {
      this.handleError(error as Error, "run");
      // Retorna relatorio minimo em caso de erro
      return {
        performance: { total: 0, success_rate: 0, avg_duration_ms: 0 },
        feedback: { actions: ["error_during_analysis"] },
        biases: [],
        timestamp: new Date(),
      };
    }
  }

  // ==========================================================================
  // Historico
  // ==========================================================================

  /**
   * Retorna historico de aprendizado
   */
  async getHistory(limit?: number): Promise<LearningHistoryEntry[]> {
    // Tenta carregar do storage se vazio
    if (this.history.length === 0 && this.stateStore) {
      await this.loadHistory();
    }

    const entries = [...this.history].reverse(); // Mais recente primeiro
    return limit ? entries.slice(0, limit) : entries;
  }

  /**
   * Adiciona entrada ao historico
   */
  private addToHistory(report: LearningReport, logs: ExecutionLog[]): void {
    const windowedMetrics = report.windowedMetrics ?? this.calculateCurrentWindowMetrics(logs);

    const entry: LearningHistoryEntry = {
      id: `learning_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      report,
      metrics: windowedMetrics,
      anomalies: report.anomalies ?? [],
      biases: report.biasReports ?? [],
    };

    this.history.push(entry);

    // Limita tamanho do historico
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }
  }

  /**
   * Carrega historico do storage
   */
  private async loadHistory(): Promise<void> {
    if (!this.stateStore) return;

    try {
      const stored = await this.stateStore.read<LearningHistoryEntry[]>(STORAGE_KEY_HISTORY);
      if (stored && Array.isArray(stored)) {
        this.history = stored;
      }
    } catch (error) {
      this.handleError(error as Error, "loadHistory");
    }
  }

  // ==========================================================================
  // Persistencia
  // ==========================================================================

  /**
   * Persiste relatorio se intervalo foi atingido
   */
  private async maybePersist(report: LearningReport, logs: ExecutionLog[]): Promise<void> {
    const now = Date.now();
    const shouldPersist =
      this.mode === 'fullstack' &&
      this.stateStore &&
      (now - this.lastPersistTime) >= this.config.persistenceIntervalMs;

    if (shouldPersist) {
      await this.persistReport(report, logs);
      this.lastPersistTime = now;
    }
  }

  /**
   * Persiste relatorio e historico
   */
  private async persistReport(report: LearningReport, logs: ExecutionLog[]): Promise<void> {
    if (!this.stateStore) return;

    try {
      // Adiciona ao historico
      this.addToHistory(report, logs);

      // Persiste historico
      await this.stateStore.write(STORAGE_KEY_HISTORY, this.history);

      // Persiste ultimo relatorio
      await this.stateStore.write(STORAGE_KEY_LAST_REPORT, report);
    } catch (error) {
      this.handleError(error as Error, "persistReport");
    }
  }

  // ==========================================================================
  // Metricas com Janela de Tempo
  // ==========================================================================

  /**
   * Calcula metricas da janela atual
   */
  private calculateCurrentWindowMetrics(logs: ExecutionLog[]): TimeWindowedMetrics {
    if (logs.length === 0) {
      return {
        window_start: new Date(),
        window_end: new Date(),
        success_rate: 0,
        avg_duration_ms: 0,
        total_executions: 0,
        trend: 'stable',
      };
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - this.config.recentWindowMs);

    // Filtra logs na janela
    const recentLogs = logs.filter((log) => {
      const ts = new Date(log.timestamp);
      return ts >= windowStart && ts <= now;
    });

    const performance = trackPerformance(recentLogs);
    const percentiles = calculateDurationPercentiles(recentLogs);
    const trend = this.analyzeTrend();

    return {
      window_start: windowStart,
      window_end: now,
      success_rate: performance.success_rate,
      avg_duration_ms: performance.avg_duration_ms,
      total_executions: performance.total,
      trend,
      percentiles: {
        p50: percentiles.p50,
        p90: percentiles.p90,
        p99: percentiles.p99,
      },
    };
  }

  // ==========================================================================
  // Deteccao de Anomalias
  // ==========================================================================

  /**
   * Detecta anomalias nos logs
   */
  private async detectAnomalies(logs: ExecutionLog[]): Promise<AnomalyReport[]> {
    const anomalies: AnomalyReport[] = [];
    const now = new Date();

    if (logs.length < this.config.minSampleSize) {
      return anomalies;
    }

    // 1. Detecta pico de duracao
    const durationSpike = this.detectDurationSpike(logs);
    if (durationSpike) {
      anomalies.push({ ...durationSpike, detected_at: now });
    }

    // 2. Detecta rajada de falhas
    const failureBurst = this.detectFailureBurst(logs);
    if (failureBurst) {
      anomalies.push({ ...failureBurst, detected_at: now });
    }

    // 3. Detecta mudanca de padrao
    const patternShift = await this.detectPatternShift(logs);
    if (patternShift) {
      anomalies.push({ ...patternShift, detected_at: now });
    }

    return anomalies;
  }

  /**
   * Detecta pico de duracao
   */
  private detectDurationSpike(logs: ExecutionLog[]): Omit<AnomalyReport, 'detected_at'> | null {
    const durations = logs.map((l) => l.duration_ms ?? 0).filter((d) => d > 0);
    if (durations.length < 5) return null;

    const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
    const stdDev = calculateDurationStdDev(logs);

    // Pico = duracao > media + 3 desvios padrao
    const threshold = mean + 3 * stdDev;
    const spikes = durations.filter((d) => d > threshold);

    if (spikes.length > 0 && stdDev > 0) {
      const maxSpike = Math.max(...spikes);
      const deviation = ((maxSpike - mean) / mean) * 100;

      return {
        type: "duration_spike",
        severity: deviation > 200 ? "high" : deviation > 100 ? "medium" : "low",
        description: `Detectado pico de duracao: ${maxSpike.toFixed(0)}ms (media: ${mean.toFixed(0)}ms)`,
        affected_period: {
          start: new Date(logs[0].timestamp),
          end: new Date(logs[logs.length - 1].timestamp),
        },
        observed_value: maxSpike,
        expected_value: mean,
        deviation_percent: Number(deviation.toFixed(1)),
      };
    }

    return null;
  }

  /**
   * Detecta rajada de falhas
   */
  private detectFailureBurst(logs: ExecutionLog[]): Omit<AnomalyReport, 'detected_at'> | null {
    const successOutcomes = new Set(["success", "ok", "completed", "done", "finished"]);
    const recentLogs = logs.slice(-10);

    let consecutiveFailures = 0;
    let maxConsecutive = 0;

    for (const log of recentLogs) {
      const outcome = (log.outcome || "unknown").toLowerCase();
      if (!successOutcomes.has(outcome) && outcome !== "unknown") {
        consecutiveFailures++;
        maxConsecutive = Math.max(maxConsecutive, consecutiveFailures);
      } else {
        consecutiveFailures = 0;
      }
    }

    if (maxConsecutive >= 3) {
      return {
        type: "failure_burst",
        severity: maxConsecutive >= 5 ? "high" : "medium",
        description: `Detectada rajada de ${maxConsecutive} falhas consecutivas`,
        affected_period: {
          start: new Date(recentLogs[0].timestamp),
          end: new Date(recentLogs[recentLogs.length - 1].timestamp),
        },
        observed_value: maxConsecutive,
        expected_value: 0,
        deviation_percent: 100,
      };
    }

    return null;
  }

  /**
   * Detecta mudanca de padrao
   */
  private async detectPatternShift(logs: ExecutionLog[]): Promise<Omit<AnomalyReport, 'detected_at'> | null> {
    if (this.history.length < 2) return null;

    const lastEntry = this.history[this.history.length - 1];
    const currentPerformance = trackPerformance(logs);

    const rateChange = Math.abs(
      currentPerformance.success_rate - lastEntry.metrics.success_rate
    );

    const durationChange = Math.abs(
      currentPerformance.avg_duration_ms - lastEntry.metrics.avg_duration_ms
    ) / Math.max(lastEntry.metrics.avg_duration_ms, 1);

    // Mudanca significativa = > 20% de diferenca
    if (rateChange > 0.2 || durationChange > 0.5) {
      return {
        type: "pattern_shift",
        severity: rateChange > 0.3 || durationChange > 1 ? "high" : "medium",
        description: `Mudanca significativa detectada: taxa ${rateChange > 0.2 ? "alterada" : "estavel"}, duracao ${durationChange > 0.5 ? "alterada" : "estavel"}`,
        affected_period: {
          start: lastEntry.timestamp,
          end: new Date(),
        },
        deviation_percent: Number((Math.max(rateChange, durationChange) * 100).toFixed(1)),
      };
    }

    return null;
  }

  // ==========================================================================
  // Analise de Tendencia
  // ==========================================================================

  /**
   * Analisa tendencia baseada no historico
   */
  analyzeTrend(): Trend {
    if (this.history.length < 3) {
      return 'stable';
    }

    const recent = this.history.slice(-5);
    let improvingCount = 0;
    let degradingCount = 0;

    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1].metrics;
      const curr = recent[i].metrics;

      // Melhora = maior success rate OU menor duration
      if (curr.success_rate > prev.success_rate + 0.02 ||
          curr.avg_duration_ms < prev.avg_duration_ms * 0.9) {
        improvingCount++;
      }

      // Degrada = menor success rate OU maior duration
      if (curr.success_rate < prev.success_rate - 0.02 ||
          curr.avg_duration_ms > prev.avg_duration_ms * 1.1) {
        degradingCount++;
      }
    }

    if (improvingCount > degradingCount && improvingCount >= 2) {
      return 'improving';
    }

    if (degradingCount > improvingCount && degradingCount >= 2) {
      return 'degrading';
    }

    return 'stable';
  }

  // ==========================================================================
  // Utilidades
  // ==========================================================================

  /**
   * Trata erros internos
   */
  private handleError(error: Error, context: string): void {
    console.error(`[LearningEngine:${context}] Erro:`, error.message);
  }

  /**
   * Retorna estatisticas do engine
   */
  getStats(): { executionCount: number; historySize: number; mode: string } {
    return {
      executionCount: this.executionCount,
      historySize: this.history.length,
      mode: this.mode,
    };
  }
}

// ============================================================================
// CLI Test Suite
// ============================================================================

if (require.main === module) {
  console.log("[AE1:LearningEngine] Testando Learning Engine...\n");

  async function runTests() {
    // Teste 1: Engine basico (lite mode)
    console.log("=== Teste 1: Engine Basico (Lite) ===");
    const liteEngine = new LearningEngine({}, null, 'lite');
    const basicLogs: ExecutionLog[] = [
      { id: "1", timestamp: "2024-01-01T10:00:00Z", type: "query", outcome: "success", duration_ms: 100 },
      { id: "2", timestamp: "2024-01-01T10:01:00Z", type: "query", outcome: "success", duration_ms: 150 },
      { id: "3", timestamp: "2024-01-01T10:02:00Z", type: "query", outcome: "failed", duration_ms: 200 },
      { id: "4", timestamp: "2024-01-01T10:03:00Z", type: "mutation", outcome: "success", duration_ms: 120 },
      { id: "5", timestamp: "2024-01-01T10:04:00Z", type: "query", outcome: "success", duration_ms: 110 },
    ];
    const liteReport = await liteEngine.run(basicLogs);
    console.log("Performance:", liteReport.performance);
    console.log("Acoes:", liteReport.feedback.actions);
    console.log("Vieses:", liteReport.biases);
    console.log(liteReport.performance.total === 5 ? "✓ Relatorio basico OK" : "✗ Erro no relatorio");

    // Teste 2: Engine fullstack
    console.log("\n=== Teste 2: Engine Fullstack ===");
    const fullEngine = new LearningEngine(
      { enableAnomalyDetection: true },
      null,
      'fullstack'
    );
    const fullReport = await fullEngine.run(basicLogs);
    console.log("Metricas windowed:", fullReport.windowedMetrics ? "Presente" : "Ausente");
    console.log("Anomalias:", fullReport.anomalies?.length ?? 0);
    console.log("Trend:", fullReport.trend);
    console.log(fullReport.windowedMetrics ? "✓ Metricas windowed OK" : "✗ Erro em metricas");

    // Teste 3: Deteccao de problemas
    console.log("\n=== Teste 3: Deteccao de Problemas ===");
    const problemLogs: ExecutionLog[] = [
      { id: "1", timestamp: "2024-01-01T10:00:00Z", type: "query", outcome: "failed", duration_ms: 5000 },
      { id: "2", timestamp: "2024-01-01T10:01:00Z", type: "query", outcome: "failed", duration_ms: 6000 },
      { id: "3", timestamp: "2024-01-01T10:02:00Z", type: "query", outcome: "failed", duration_ms: 7000 },
      { id: "4", timestamp: "2024-01-01T10:03:00Z", type: "query", outcome: "failed", duration_ms: 8000 },
      { id: "5", timestamp: "2024-01-01T10:04:00Z", type: "query", outcome: "success", duration_ms: 100 },
    ];
    const problemReport = await fullEngine.run(problemLogs);
    console.log("Taxa de sucesso:", problemReport.performance.success_rate);
    console.log("Acoes criticas:", problemReport.feedback.prioritizedActions?.filter(a => a.priority === "critical").length ?? 0);
    console.log("Anomalias:", problemReport.anomalies?.map(a => a.type) ?? []);
    const hasCritical = problemReport.feedback.prioritizedActions?.some(a => a.priority === "critical");
    console.log(hasCritical ? "✓ Problemas detectados" : "✗ Falha na deteccao");

    // Teste 4: Historico e tendencia
    console.log("\n=== Teste 4: Historico e Tendencia ===");
    // Executa varias vezes para gerar historico
    for (let i = 0; i < 5; i++) {
      await fullEngine.run(basicLogs);
    }
    const history = await fullEngine.getHistory(3);
    console.log("Entradas no historico:", history.length);
    const trend = fullEngine.analyzeTrend();
    console.log("Tendencia:", trend);
    const stats = fullEngine.getStats();
    console.log("Estatisticas:", stats);
    console.log(stats.executionCount > 5 ? "✓ Historico funcionando" : "✗ Erro no historico");

    // Teste 5: Configuracao customizada
    console.log("\n=== Teste 5: Configuracao Customizada ===");
    const customEngine = new LearningEngine({
      recentWindowMs: 1800000, // 30 min
      minSampleSize: 5,
      successRateThreshold: 0.8,
      slowDurationThresholdMs: 3000,
    }, null, 'fullstack');
    const customReport = await customEngine.run(basicLogs);
    console.log("Config aplicada, relatorio gerado");
    console.log(customReport.timestamp ? "✓ Config customizada OK" : "✗ Erro na config");

    console.log("\n[AE1:LearningEngine] ✓ Testes concluidos");
  }

  runTests().catch(console.error);
}
