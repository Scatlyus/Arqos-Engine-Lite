/**
 * Feedback Loop - AE1 Learning
 *
 * Analisa metricas de performance e gera acoes corretivas:
 * - Acoes baseadas em thresholds configuraveis
 * - Priorizacao de acoes por severidade
 * - Deteccao de situacoes criticas
 */

import type { ExecutionLog } from "../state/state-types";
import { trackPerformance, calculateDurationPercentiles } from "./performance-tracker";
import type {
  FeedbackConfig,
  PrioritizedAction,
  ActionPriority,
  DEFAULT_FEEDBACK_CONFIG,
} from "./learning-types";

// ============================================================================
// Tipos
// ============================================================================

export type FeedbackResult = {
  actions: string[];
  prioritizedActions?: PrioritizedAction[];
  summary?: string;
};

// ============================================================================
// Constantes
// ============================================================================

const DEFAULT_SLOW_THRESHOLD_MS = 5000;
const DEFAULT_LOW_SUCCESS_THRESHOLD = 0.7;
const DEFAULT_HIGH_SUCCESS_THRESHOLD = 0.95;
const CRITICAL_SUCCESS_THRESHOLD = 0.5;
const CRITICAL_DURATION_THRESHOLD_MS = 10000;

// ============================================================================
// Funcoes Principais
// ============================================================================

/**
 * Executa loop de feedback basico (compatibilidade)
 */
export function runFeedbackLoop(logs: ExecutionLog[]): FeedbackResult {
  return runFeedbackLoopWithConfig(logs, {
    slowThresholdMs: DEFAULT_SLOW_THRESHOLD_MS,
    lowSuccessRateThreshold: DEFAULT_LOW_SUCCESS_THRESHOLD,
    highSuccessRateThreshold: DEFAULT_HIGH_SUCCESS_THRESHOLD,
  });
}

/**
 * Executa loop de feedback com configuracao customizada
 */
export function runFeedbackLoopWithConfig(
  logs: ExecutionLog[],
  config: FeedbackConfig
): FeedbackResult {
  const performance = trackPerformance(logs);
  const percentiles = calculateDurationPercentiles(logs);
  const actions: string[] = [];
  const prioritizedActions: PrioritizedAction[] = [];

  // Caso: Sem dados suficientes
  if (performance.total === 0) {
    actions.push("collect_more_samples");
    prioritizedActions.push({
      action: "collect_more_samples",
      priority: "high",
      reason: "Nenhum dado disponivel para analise",
      estimated_impact: "Necessario para qualquer analise",
    });
    return { actions, prioritizedActions, summary: "Dados insuficientes para analise" };
  }

  // Caso Critico: Taxa de sucesso muito baixa
  if (performance.success_rate < CRITICAL_SUCCESS_THRESHOLD) {
    actions.push("emergency_review");
    prioritizedActions.push({
      action: "emergency_review",
      priority: "critical",
      reason: `Taxa de sucesso critica: ${(performance.success_rate * 100).toFixed(1)}%`,
      estimated_impact: "Sistema pode estar inoperante",
    });
  }

  // Caso: Taxa de sucesso baixa
  if (performance.success_rate < config.lowSuccessRateThreshold) {
    actions.push("review_heuristics");
    prioritizedActions.push({
      action: "review_heuristics",
      priority: "high",
      reason: `Taxa de sucesso abaixo do limiar: ${(performance.success_rate * 100).toFixed(1)}% < ${(config.lowSuccessRateThreshold * 100).toFixed(1)}%`,
      estimated_impact: "Melhoria de 10-30% esperada",
    });
  }

  // Caso Critico: Duracao extremamente lenta
  if (performance.avg_duration_ms > CRITICAL_DURATION_THRESHOLD_MS) {
    actions.push("urgent_optimization");
    prioritizedActions.push({
      action: "urgent_optimization",
      priority: "critical",
      reason: `Duracao media critica: ${performance.avg_duration_ms.toFixed(0)}ms`,
      estimated_impact: "Possivel timeout ou degradacao severa",
    });
  }

  // Caso: Duracao lenta
  if (performance.avg_duration_ms > config.slowThresholdMs) {
    actions.push("optimize_pipeline");
    prioritizedActions.push({
      action: "optimize_pipeline",
      priority: "medium",
      reason: `Duracao media acima do limiar: ${performance.avg_duration_ms.toFixed(0)}ms > ${config.slowThresholdMs}ms`,
      estimated_impact: "Reducao de 20-40% em latencia",
    });
  }

  // Caso: P99 muito alto (outliers)
  if (percentiles.p99 > config.slowThresholdMs * 3) {
    actions.push("investigate_outliers");
    prioritizedActions.push({
      action: "investigate_outliers",
      priority: "medium",
      reason: `P99 muito alto: ${percentiles.p99.toFixed(0)}ms (3x o limiar)`,
      estimated_impact: "Identificar casos problematicos",
    });
  }

  // Caso: Alta variancia (P99 >> P50)
  if (percentiles.p99 > percentiles.p50 * 5 && percentiles.p50 > 0) {
    actions.push("reduce_variance");
    prioritizedActions.push({
      action: "reduce_variance",
      priority: "low",
      reason: `Alta variancia: P99=${percentiles.p99}ms vs P50=${percentiles.p50}ms`,
      estimated_impact: "Maior previsibilidade de performance",
    });
  }

  // Caso: Sistema saudavel
  if (performance.success_rate >= config.highSuccessRateThreshold &&
      performance.avg_duration_ms <= config.slowThresholdMs) {
    actions.push("maintain_strategy");
    prioritizedActions.push({
      action: "maintain_strategy",
      priority: "low",
      reason: `Sistema saudavel: ${(performance.success_rate * 100).toFixed(1)}% sucesso, ${performance.avg_duration_ms.toFixed(0)}ms media`,
      estimated_impact: "Nenhuma acao necessaria",
    });
  }

  // Se nenhuma acao foi adicionada
  if (!actions.length) {
    actions.push("maintain_strategy");
    prioritizedActions.push({
      action: "maintain_strategy",
      priority: "low",
      reason: "Nenhum problema detectado",
      estimated_impact: "Continuar monitorando",
    });
  }

  // Gera summary
  const summary = generateSummary(performance, percentiles, actions);

  return { actions, prioritizedActions, summary };
}

/**
 * Prioriza lista de acoes existente baseado em metricas
 */
export function prioritizeActions(
  actions: string[],
  performance: ReturnType<typeof trackPerformance>
): PrioritizedAction[] {
  return actions.map((action) => {
    let priority: ActionPriority = "low";
    let reason = "";

    switch (action) {
      case "emergency_review":
        priority = "critical";
        reason = "Situacao critica detectada";
        break;
      case "urgent_optimization":
        priority = "critical";
        reason = "Performance severamente degradada";
        break;
      case "review_heuristics":
        priority = performance.success_rate < 0.5 ? "critical" : "high";
        reason = `Taxa de sucesso: ${(performance.success_rate * 100).toFixed(1)}%`;
        break;
      case "optimize_pipeline":
        priority = performance.avg_duration_ms > 10000 ? "high" : "medium";
        reason = `Duracao media: ${performance.avg_duration_ms.toFixed(0)}ms`;
        break;
      case "collect_more_samples":
        priority = "high";
        reason = "Dados insuficientes";
        break;
      case "investigate_outliers":
        priority = "medium";
        reason = "Outliers detectados";
        break;
      case "reduce_variance":
        priority = "low";
        reason = "Variancia alta mas nao critica";
        break;
      case "maintain_strategy":
        priority = "low";
        reason = "Sistema funcionando normalmente";
        break;
      default:
        priority = "medium";
        reason = "Acao generica";
    }

    return { action, priority, reason };
  });
}

/**
 * Gera resumo legivel das acoes
 */
function generateSummary(
  performance: ReturnType<typeof trackPerformance>,
  percentiles: ReturnType<typeof calculateDurationPercentiles>,
  actions: string[]
): string {
  const parts: string[] = [];

  parts.push(`Analisados ${performance.total} logs.`);
  parts.push(`Taxa de sucesso: ${(performance.success_rate * 100).toFixed(1)}%.`);
  parts.push(`Duracao media: ${performance.avg_duration_ms.toFixed(0)}ms (P50: ${percentiles.p50}ms, P99: ${percentiles.p99}ms).`);

  if (actions.includes("emergency_review") || actions.includes("urgent_optimization")) {
    parts.push("ATENCAO: Situacao critica detectada!");
  } else if (actions.includes("review_heuristics") || actions.includes("optimize_pipeline")) {
    parts.push("Acoes corretivas recomendadas.");
  } else {
    parts.push("Sistema operando dentro dos parametros.");
  }

  return parts.join(" ");
}

// ============================================================================
// CLI Test Suite
// ============================================================================

if (require.main === module) {
  console.log("[AE1:FeedbackLoop] Testando Feedback Loop...\n");

  // Teste 1: Logs saudaveis
  console.log("=== Teste 1: Sistema Saudavel ===");
  const healthyLogs: ExecutionLog[] = [
    { id: "1", timestamp: "2024-01-01T10:00:00Z", type: "query", outcome: "success", duration_ms: 100 },
    { id: "2", timestamp: "2024-01-01T10:01:00Z", type: "query", outcome: "success", duration_ms: 150 },
    { id: "3", timestamp: "2024-01-01T10:02:00Z", type: "query", outcome: "success", duration_ms: 120 },
    { id: "4", timestamp: "2024-01-01T10:03:00Z", type: "query", outcome: "success", duration_ms: 130 },
    { id: "5", timestamp: "2024-01-01T10:04:00Z", type: "query", outcome: "success", duration_ms: 110 },
  ];
  const healthy = runFeedbackLoop(healthyLogs);
  console.log("Acoes:", healthy.actions);
  console.log("Summary:", healthy.summary);
  console.log(healthy.actions.includes("maintain_strategy") ? "✓ Sistema saudavel detectado" : "✗ Erro");

  // Teste 2: Taxa de sucesso baixa
  console.log("\n=== Teste 2: Taxa de Sucesso Baixa ===");
  const lowSuccessLogs: ExecutionLog[] = [
    { id: "1", timestamp: "2024-01-01T10:00:00Z", type: "query", outcome: "failed", duration_ms: 100 },
    { id: "2", timestamp: "2024-01-01T10:01:00Z", type: "query", outcome: "failed", duration_ms: 150 },
    { id: "3", timestamp: "2024-01-01T10:02:00Z", type: "query", outcome: "success", duration_ms: 120 },
    { id: "4", timestamp: "2024-01-01T10:03:00Z", type: "query", outcome: "failed", duration_ms: 130 },
    { id: "5", timestamp: "2024-01-01T10:04:00Z", type: "query", outcome: "failed", duration_ms: 110 },
  ];
  const lowSuccess = runFeedbackLoop(lowSuccessLogs);
  console.log("Acoes:", lowSuccess.actions);
  console.log(lowSuccess.actions.includes("review_heuristics") ? "✓ Review detectado" : "✗ Erro");

  // Teste 3: Duracao lenta
  console.log("\n=== Teste 3: Duracao Lenta ===");
  const slowLogs: ExecutionLog[] = [
    { id: "1", timestamp: "2024-01-01T10:00:00Z", type: "query", outcome: "success", duration_ms: 6000 },
    { id: "2", timestamp: "2024-01-01T10:01:00Z", type: "query", outcome: "success", duration_ms: 7000 },
    { id: "3", timestamp: "2024-01-01T10:02:00Z", type: "query", outcome: "success", duration_ms: 8000 },
  ];
  const slow = runFeedbackLoop(slowLogs);
  console.log("Acoes:", slow.actions);
  console.log(slow.actions.includes("optimize_pipeline") ? "✓ Otimizacao detectada" : "✗ Erro");

  // Teste 4: Situacao critica
  console.log("\n=== Teste 4: Situacao Critica ===");
  const criticalLogs: ExecutionLog[] = [
    { id: "1", timestamp: "2024-01-01T10:00:00Z", type: "query", outcome: "failed", duration_ms: 15000 },
    { id: "2", timestamp: "2024-01-01T10:01:00Z", type: "query", outcome: "failed", duration_ms: 12000 },
    { id: "3", timestamp: "2024-01-01T10:02:00Z", type: "query", outcome: "failed", duration_ms: 14000 },
    { id: "4", timestamp: "2024-01-01T10:03:00Z", type: "query", outcome: "failed", duration_ms: 11000 },
  ];
  const critical = runFeedbackLoop(criticalLogs);
  console.log("Acoes:", critical.actions);
  console.log("Prioridades:", critical.prioritizedActions?.map(a => `${a.action}(${a.priority})`));
  const hasCritical = critical.prioritizedActions?.some(a => a.priority === "critical");
  console.log(hasCritical ? "✓ Critico detectado" : "✗ Erro");

  // Teste 5: Sem dados
  console.log("\n=== Teste 5: Sem Dados ===");
  const empty = runFeedbackLoop([]);
  console.log("Acoes:", empty.actions);
  console.log(empty.actions.includes("collect_more_samples") ? "✓ Coleta detectada" : "✗ Erro");

  console.log("\n[AE1:FeedbackLoop] ✓ Testes concluidos");
}
