/**
 * Performance Tracker - AE1 Learning
 *
 * Rastreia e analisa metricas de performance das execucoes:
 * - Taxa de sucesso
 * - Duracao media
 * - Percentis (p50, p90, p99)
 * - Metricas por tipo
 * - Analise com janela de tempo
 */

import type { ExecutionLog } from "../state/state-types";
import type { TimeWindowedMetrics, Trend } from "./learning-types";

// ============================================================================
// Tipos
// ============================================================================

export type PerformanceSnapshot = {
  total: number;
  success_rate: number;
  avg_duration_ms: number;
};

export interface PerformanceByType {
  type: string;
  snapshot: PerformanceSnapshot;
  count: number;
}

export interface DurationPercentiles {
  p50: number;
  p90: number;
  p99: number;
  min: number;
  max: number;
}

// ============================================================================
// Constantes
// ============================================================================

const SUCCESS_OUTCOMES = new Set(["success", "ok", "completed", "done", "finished"]);

// ============================================================================
// Funcoes Principais
// ============================================================================

/**
 * Calcula metricas de performance basicas
 */
export function trackPerformance(logs: ExecutionLog[]): PerformanceSnapshot {
  if (!logs.length) {
    return { total: 0, success_rate: 0, avg_duration_ms: 0 };
  }

  const total = logs.length;
  const successes = logs.filter((log) =>
    log.outcome ? SUCCESS_OUTCOMES.has(log.outcome.toLowerCase()) : false
  ).length;
  const durations = logs.map((log) => log.duration_ms ?? 0);
  const avgDuration = durations.reduce((acc, value) => acc + value, 0) / total;

  return {
    total,
    success_rate: Number((successes / total).toFixed(2)),
    avg_duration_ms: Number(avgDuration.toFixed(2)),
  };
}

/**
 * Calcula metricas de performance agrupadas por tipo
 */
export function trackPerformanceByType(logs: ExecutionLog[]): PerformanceByType[] {
  if (!logs.length) {
    return [];
  }

  // Agrupa logs por tipo
  const byType = new Map<string, ExecutionLog[]>();
  for (const log of logs) {
    const type = log.type.toLowerCase();
    const existing = byType.get(type) || [];
    existing.push(log);
    byType.set(type, existing);
  }

  // Calcula metricas para cada tipo
  const results: PerformanceByType[] = [];
  for (const [type, typeLogs] of byType) {
    results.push({
      type,
      snapshot: trackPerformance(typeLogs),
      count: typeLogs.length,
    });
  }

  // Ordena por contagem decrescente
  return results.sort((a, b) => b.count - a.count);
}

/**
 * Calcula metricas dentro de uma janela de tempo
 */
export function trackPerformanceWindowed(
  logs: ExecutionLog[],
  windowMs: number,
  referenceTime?: Date
): TimeWindowedMetrics[] {
  if (!logs.length) {
    return [];
  }

  const now = referenceTime || new Date();
  const results: TimeWindowedMetrics[] = [];

  // Ordena logs por timestamp
  const sortedLogs = [...logs].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Encontra o range de tempo
  const firstTimestamp = new Date(sortedLogs[0].timestamp).getTime();
  const lastTimestamp = new Date(sortedLogs[sortedLogs.length - 1].timestamp).getTime();

  // Divide em janelas
  let windowStart = firstTimestamp;
  let previousMetrics: TimeWindowedMetrics | null = null;

  while (windowStart <= lastTimestamp) {
    const windowEnd = windowStart + windowMs;

    // Filtra logs na janela
    const windowLogs = sortedLogs.filter((log) => {
      const ts = new Date(log.timestamp).getTime();
      return ts >= windowStart && ts < windowEnd;
    });

    if (windowLogs.length > 0) {
      const snapshot = trackPerformance(windowLogs);
      const percentiles = calculateDurationPercentiles(windowLogs);

      // Determina tendencia comparando com janela anterior
      let trend: Trend = 'stable';
      if (previousMetrics) {
        const rateDiff = snapshot.success_rate - previousMetrics.success_rate;
        const durationDiff = snapshot.avg_duration_ms - previousMetrics.avg_duration_ms;

        if (rateDiff > 0.05 || durationDiff < -500) {
          trend = 'improving';
        } else if (rateDiff < -0.05 || durationDiff > 500) {
          trend = 'degrading';
        }
      }

      const metrics: TimeWindowedMetrics = {
        window_start: new Date(windowStart),
        window_end: new Date(windowEnd),
        success_rate: snapshot.success_rate,
        avg_duration_ms: snapshot.avg_duration_ms,
        total_executions: snapshot.total,
        trend,
        percentiles: {
          p50: percentiles.p50,
          p90: percentiles.p90,
          p99: percentiles.p99,
        },
      };

      results.push(metrics);
      previousMetrics = metrics;
    }

    windowStart = windowEnd;
  }

  return results;
}

/**
 * Calcula percentis de duracao
 */
export function calculateDurationPercentiles(logs: ExecutionLog[]): DurationPercentiles {
  if (!logs.length) {
    return { p50: 0, p90: 0, p99: 0, min: 0, max: 0 };
  }

  const durations = logs
    .map((log) => log.duration_ms ?? 0)
    .filter((d) => d > 0)
    .sort((a, b) => a - b);

  if (!durations.length) {
    return { p50: 0, p90: 0, p99: 0, min: 0, max: 0 };
  }

  const getPercentile = (arr: number[], p: number): number => {
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, Math.min(index, arr.length - 1))];
  };

  return {
    p50: getPercentile(durations, 50),
    p90: getPercentile(durations, 90),
    p99: getPercentile(durations, 99),
    min: durations[0],
    max: durations[durations.length - 1],
  };
}

/**
 * Calcula desvio padrao das duracoes
 */
export function calculateDurationStdDev(logs: ExecutionLog[]): number {
  const durations = logs.map((log) => log.duration_ms ?? 0).filter((d) => d > 0);

  if (durations.length < 2) {
    return 0;
  }

  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
  const squaredDiffs = durations.map((d) => Math.pow(d - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / durations.length;

  return Math.sqrt(variance);
}

// ============================================================================
// CLI Test Suite
// ============================================================================

if (require.main === module) {
  console.log("[AE1:PerformanceTracker] Testando Performance Tracker...\n");

  const testLogs: ExecutionLog[] = [
    { id: "1", timestamp: "2024-01-01T10:00:00Z", type: "query", outcome: "success", duration_ms: 150 },
    { id: "2", timestamp: "2024-01-01T10:01:00Z", type: "query", outcome: "success", duration_ms: 200 },
    { id: "3", timestamp: "2024-01-01T10:02:00Z", type: "mutation", outcome: "failed", duration_ms: 5000 },
    { id: "4", timestamp: "2024-01-01T10:03:00Z", type: "query", outcome: "success", duration_ms: 100 },
    { id: "5", timestamp: "2024-01-01T11:00:00Z", type: "mutation", outcome: "success", duration_ms: 300 },
    { id: "6", timestamp: "2024-01-01T11:01:00Z", type: "query", outcome: "ok", duration_ms: 180 },
    { id: "7", timestamp: "2024-01-01T12:00:00Z", type: "query", outcome: "completed", duration_ms: 120 },
  ];

  // Teste 1: Metricas basicas
  console.log("=== Teste 1: Metricas Basicas ===");
  const basic = trackPerformance(testLogs);
  console.log("Total:", basic.total);
  console.log("Taxa de sucesso:", basic.success_rate);
  console.log("Duracao media:", basic.avg_duration_ms, "ms");
  console.log(basic.success_rate > 0.8 ? "✓ Taxa de sucesso OK" : "✗ Taxa de sucesso baixa");

  // Teste 2: Metricas por tipo
  console.log("\n=== Teste 2: Metricas por Tipo ===");
  const byType = trackPerformanceByType(testLogs);
  for (const item of byType) {
    console.log(`Tipo: ${item.type}, Count: ${item.count}, Success: ${item.snapshot.success_rate}`);
  }
  console.log(byType.length === 2 ? "✓ Tipos corretos" : "✗ Tipos incorretos");

  // Teste 3: Percentis
  console.log("\n=== Teste 3: Percentis de Duracao ===");
  const percentiles = calculateDurationPercentiles(testLogs);
  console.log("P50:", percentiles.p50, "ms");
  console.log("P90:", percentiles.p90, "ms");
  console.log("P99:", percentiles.p99, "ms");
  console.log("Min:", percentiles.min, "ms");
  console.log("Max:", percentiles.max, "ms");
  console.log(percentiles.p50 > 0 ? "✓ Percentis calculados" : "✗ Erro nos percentis");

  // Teste 4: Janela de tempo
  console.log("\n=== Teste 4: Metricas com Janela de Tempo ===");
  const windowed = trackPerformanceWindowed(testLogs, 3600000); // 1 hora
  console.log("Janelas encontradas:", windowed.length);
  for (const w of windowed) {
    console.log(`  ${w.window_start.toISOString()} - Execucoes: ${w.total_executions}, Trend: ${w.trend}`);
  }
  console.log(windowed.length >= 1 ? "✓ Janelas calculadas" : "✗ Erro nas janelas");

  // Teste 5: Desvio padrao
  console.log("\n=== Teste 5: Desvio Padrao ===");
  const stdDev = calculateDurationStdDev(testLogs);
  console.log("Desvio padrao:", stdDev.toFixed(2), "ms");
  console.log(stdDev > 0 ? "✓ StdDev calculado" : "✗ Erro no StdDev");

  console.log("\n[AE1:PerformanceTracker] ✓ Testes concluidos");
}
