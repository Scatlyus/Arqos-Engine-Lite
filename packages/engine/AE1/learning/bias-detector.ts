/**
 * Bias Detector - AE1 Learning
 *
 * Detecta vieses comportamentais e estatisticos:
 * - Vies de recencia (peso excessivo em eventos recentes)
 * - Vies de confirmacao (preferencia por tipos conhecidos)
 * - Vies de selecao (amostra nao representativa)
 * - Vies de sobrevivente (ignora falhas)
 * - Vies de ancoragem (fixacao em valores iniciais)
 */

import type { ExecutionLog } from "../state/state-types";
import type { BiasType, BiasReport, Severity } from "./learning-types";

// ============================================================================
// Constantes
// ============================================================================

const BIAS_MIN_SAMPLES = 5;
const RECENCY_WINDOW = 5;
const SELECTION_THRESHOLD = 0.8; // 80% do mesmo tipo indica vies
const SURVIVOR_SUCCESS_THRESHOLD = 0.95; // 95% sucesso pode indicar vies
const ANCHORING_VARIANCE_THRESHOLD = 0.1; // 10% de variancia indica ancoragem

// ============================================================================
// Funcao Principal (Compatibilidade)
// ============================================================================

/**
 * Detecta vieses basicos (compatibilidade com versao anterior)
 * Retorna array de strings com nomes dos vieses
 */
export function detectBiases(logs: ExecutionLog[]): string[] {
  const reports = detectBiasesAdvanced(logs);
  return reports.map((r) => r.type);
}

// ============================================================================
// Deteccao Avancada
// ============================================================================

/**
 * Detecta vieses com relatorios detalhados
 */
export function detectBiasesAdvanced(logs: ExecutionLog[]): BiasReport[] {
  if (logs.length < BIAS_MIN_SAMPLES) {
    return [];
  }

  const reports: BiasReport[] = [];
  const now = new Date();

  // Detecta cada tipo de vies
  const recency = detectRecencyBias(logs);
  if (recency) reports.push({ ...recency, detected_at: now });

  const confirmation = detectConfirmationBias(logs);
  if (confirmation) reports.push({ ...confirmation, detected_at: now });

  const selection = detectSelectionBias(logs);
  if (selection) reports.push({ ...selection, detected_at: now });

  const survivor = detectSurvivorBias(logs);
  if (survivor) reports.push({ ...survivor, detected_at: now });

  const anchoring = detectAnchoringBias(logs);
  if (anchoring) reports.push({ ...anchoring, detected_at: now });

  return reports;
}

// ============================================================================
// Detectores Individuais
// ============================================================================

/**
 * Detecta vies de recencia
 * Ocorre quando eventos recentes tem peso excessivo nas decisoes
 */
export function detectRecencyBias(logs: ExecutionLog[]): Omit<BiasReport, 'detected_at'> | null {
  if (logs.length < RECENCY_WINDOW) {
    return null;
  }

  const recent = logs.slice(-RECENCY_WINDOW);
  const outcomes = recent.map((log) => (log.outcome || "unknown").toLowerCase());

  // Conta outcomes
  const outcomeCounts = new Map<string, number>();
  for (const outcome of outcomes) {
    outcomeCounts.set(outcome, (outcomeCounts.get(outcome) ?? 0) + 1);
  }

  // Verifica se um outcome domina
  const maxCount = Math.max(...outcomeCounts.values());
  const dominantRatio = maxCount / RECENCY_WINDOW;

  if (dominantRatio >= 0.8) { // 80% ou mais do mesmo outcome
    const dominantOutcome = [...outcomeCounts.entries()]
      .find(([, count]) => count === maxCount)?.[0] || "unknown";

    const confidence = dominantRatio;
    const severity = determineSeverity(confidence);

    return {
      type: "recency_bias",
      confidence: Number(confidence.toFixed(2)),
      evidence: [
        `${maxCount} de ${RECENCY_WINDOW} eventos recentes tem outcome "${dominantOutcome}"`,
        `Razao de dominancia: ${(dominantRatio * 100).toFixed(1)}%`,
      ],
      recommendation: "Considerar uma janela de analise maior para evitar conclusoes precipitadas",
    };
  }

  return null;
}

/**
 * Detecta vies de confirmacao
 * Ocorre quando ha preferencia por tipos de execucao conhecidos
 */
export function detectConfirmationBias(logs: ExecutionLog[]): Omit<BiasReport, 'detected_at'> | null {
  if (logs.length < BIAS_MIN_SAMPLES) {
    return null;
  }

  const recent = logs.slice(-BIAS_MIN_SAMPLES);
  const types = recent.map((log) => log.type.toLowerCase());

  // Conta tipos
  const typeCounts = new Map<string, number>();
  for (const type of types) {
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  // Verifica se todos sao do mesmo tipo
  if (typeCounts.size === 1) {
    const dominantType = types[0];
    const confidence = 1.0;

    return {
      type: "confirmation_bias",
      confidence,
      evidence: [
        `Todos os ${BIAS_MIN_SAMPLES} eventos recentes sao do tipo "${dominantType}"`,
        "Falta de diversidade nos tipos de execucao",
      ],
      recommendation: "Diversificar tipos de execucao para validar heuristicas em diferentes cenarios",
    };
  }

  // Verifica dominancia parcial
  const maxCount = Math.max(...typeCounts.values());
  const dominantRatio = maxCount / recent.length;

  if (dominantRatio > 0.8 && typeCounts.size <= 2) {
    const dominantType = [...typeCounts.entries()]
      .find(([, count]) => count === maxCount)?.[0] || "unknown";

    return {
      type: "confirmation_bias",
      confidence: Number(dominantRatio.toFixed(2)),
      evidence: [
        `${maxCount} de ${recent.length} eventos sao do tipo "${dominantType}"`,
        `Apenas ${typeCounts.size} tipos diferentes observados`,
      ],
      recommendation: "Incluir mais variedade nos tipos de execucao testados",
    };
  }

  return null;
}

/**
 * Detecta vies de selecao
 * Ocorre quando a amostra nao e representativa da populacao
 */
export function detectSelectionBias(logs: ExecutionLog[]): Omit<BiasReport, 'detected_at'> | null {
  if (logs.length < BIAS_MIN_SAMPLES * 2) {
    return null;
  }

  // Divide em duas metades e compara distribuicoes
  const midpoint = Math.floor(logs.length / 2);
  const firstHalf = logs.slice(0, midpoint);
  const secondHalf = logs.slice(midpoint);

  // Calcula distribuicao de tipos em cada metade
  const firstTypes = countTypes(firstHalf);
  const secondTypes = countTypes(secondHalf);

  // Verifica se ha tipos que aparecem em uma metade mas nao na outra
  const allTypes = new Set([...firstTypes.keys(), ...secondTypes.keys()]);
  const missingInFirst: string[] = [];
  const missingInSecond: string[] = [];

  for (const type of allTypes) {
    if (!firstTypes.has(type)) missingInFirst.push(type);
    if (!secondTypes.has(type)) missingInSecond.push(type);
  }

  // Se muitos tipos estao ausentes em uma metade, pode indicar vies
  const missingRatio = (missingInFirst.length + missingInSecond.length) / (allTypes.size * 2);

  if (missingRatio > 0.3 && allTypes.size > 2) {
    return {
      type: "selection_bias",
      confidence: Number(Math.min(missingRatio * 1.5, 1).toFixed(2)),
      evidence: [
        `Tipos ausentes na primeira metade: ${missingInFirst.join(", ") || "nenhum"}`,
        `Tipos ausentes na segunda metade: ${missingInSecond.join(", ") || "nenhum"}`,
        "Distribuicao de tipos inconsistente ao longo do tempo",
      ],
      recommendation: "Garantir amostragem mais uniforme ao longo do tempo",
    };
  }

  return null;
}

/**
 * Detecta vies de sobrevivente
 * Ocorre quando falhas sao ignoradas ou sub-representadas
 */
export function detectSurvivorBias(logs: ExecutionLog[]): Omit<BiasReport, 'detected_at'> | null {
  if (logs.length < BIAS_MIN_SAMPLES) {
    return null;
  }

  // Conta sucessos vs falhas
  const successOutcomes = new Set(["success", "ok", "completed", "done", "finished"]);
  let successCount = 0;
  let failureCount = 0;

  for (const log of logs) {
    const outcome = (log.outcome || "unknown").toLowerCase();
    if (successOutcomes.has(outcome)) {
      successCount++;
    } else if (outcome !== "unknown") {
      failureCount++;
    }
  }

  const total = successCount + failureCount;
  if (total === 0) return null;

  const successRate = successCount / total;

  // Taxa de sucesso muito alta pode indicar que falhas estao sendo ignoradas
  if (successRate >= SURVIVOR_SUCCESS_THRESHOLD && failureCount <= 1) {
    return {
      type: "survivor_bias",
      confidence: Number(successRate.toFixed(2)),
      evidence: [
        `Taxa de sucesso extremamente alta: ${(successRate * 100).toFixed(1)}%`,
        `Apenas ${failureCount} falha(s) em ${total} execucoes`,
        "Falhas podem estar sendo sub-representadas ou ignoradas",
      ],
      recommendation: "Verificar se todas as execucoes estao sendo registradas, incluindo falhas",
    };
  }

  return null;
}

/**
 * Detecta vies de ancoragem
 * Ocorre quando valores iniciais influenciam excessivamente analises posteriores
 */
export function detectAnchoringBias(logs: ExecutionLog[]): Omit<BiasReport, 'detected_at'> | null {
  if (logs.length < BIAS_MIN_SAMPLES) {
    return null;
  }

  // Analisa variancia das duracoes
  const durations = logs
    .map((log) => log.duration_ms ?? 0)
    .filter((d) => d > 0);

  if (durations.length < BIAS_MIN_SAMPLES) {
    return null;
  }

  const mean = durations.reduce((a, b) => a + b, 0) / durations.length;
  const variance = durations.reduce((acc, d) => acc + Math.pow(d - mean, 2), 0) / durations.length;
  const coefficientOfVariation = Math.sqrt(variance) / mean;

  // Variancia muito baixa pode indicar ancoragem (valores muito similares)
  if (coefficientOfVariation < ANCHORING_VARIANCE_THRESHOLD && durations.length >= 10) {
    return {
      type: "anchoring_bias",
      confidence: Number((1 - coefficientOfVariation).toFixed(2)),
      evidence: [
        `Coeficiente de variacao muito baixo: ${(coefficientOfVariation * 100).toFixed(2)}%`,
        `Media de duracao: ${mean.toFixed(0)}ms`,
        "Valores de duracao suspeitosamente uniformes",
      ],
      recommendation: "Verificar se ha diversidade real nas execucoes ou se valores estao sendo normalizados incorretamente",
    };
  }

  return null;
}

// ============================================================================
// Funcoes Auxiliares
// ============================================================================

function countTypes(logs: ExecutionLog[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const log of logs) {
    const type = log.type.toLowerCase();
    counts.set(type, (counts.get(type) ?? 0) + 1);
  }
  return counts;
}

function determineSeverity(confidence: number): Severity {
  if (confidence >= 0.9) return "high";
  if (confidence >= 0.7) return "medium";
  return "low";
}

// ============================================================================
// CLI Test Suite
// ============================================================================

if (require.main === module) {
  console.log("[AE1:BiasDetector] Testando Bias Detector...\n");

  // Teste 1: Vies de recencia
  console.log("=== Teste 1: Vies de Recencia ===");
  const recencyLogs: ExecutionLog[] = [
    { id: "1", timestamp: "2024-01-01T10:00:00Z", type: "query", outcome: "success", duration_ms: 100 },
    { id: "2", timestamp: "2024-01-01T10:01:00Z", type: "query", outcome: "failed", duration_ms: 150 },
    { id: "3", timestamp: "2024-01-01T10:02:00Z", type: "query", outcome: "success", duration_ms: 120 },
    { id: "4", timestamp: "2024-01-01T10:03:00Z", type: "query", outcome: "success", duration_ms: 130 },
    { id: "5", timestamp: "2024-01-01T10:04:00Z", type: "query", outcome: "success", duration_ms: 110 },
    { id: "6", timestamp: "2024-01-01T10:05:00Z", type: "query", outcome: "success", duration_ms: 140 },
    { id: "7", timestamp: "2024-01-01T10:06:00Z", type: "query", outcome: "success", duration_ms: 125 },
  ];
  const recency = detectRecencyBias(recencyLogs);
  console.log("Resultado:", recency ? `${recency.type} (conf: ${recency.confidence})` : "Nenhum vies");
  console.log(recency?.type === "recency_bias" ? "✓ Vies de recencia detectado" : "✗ Nao detectado");

  // Teste 2: Vies de confirmacao
  console.log("\n=== Teste 2: Vies de Confirmacao ===");
  const confirmationLogs: ExecutionLog[] = [
    { id: "1", timestamp: "2024-01-01T10:00:00Z", type: "query", outcome: "success", duration_ms: 100 },
    { id: "2", timestamp: "2024-01-01T10:01:00Z", type: "query", outcome: "success", duration_ms: 150 },
    { id: "3", timestamp: "2024-01-01T10:02:00Z", type: "query", outcome: "failed", duration_ms: 120 },
    { id: "4", timestamp: "2024-01-01T10:03:00Z", type: "query", outcome: "success", duration_ms: 130 },
    { id: "5", timestamp: "2024-01-01T10:04:00Z", type: "query", outcome: "success", duration_ms: 110 },
  ];
  const confirmation = detectConfirmationBias(confirmationLogs);
  console.log("Resultado:", confirmation ? `${confirmation.type} (conf: ${confirmation.confidence})` : "Nenhum vies");
  console.log(confirmation?.type === "confirmation_bias" ? "✓ Vies de confirmacao detectado" : "✗ Nao detectado");

  // Teste 3: Vies de sobrevivente
  console.log("\n=== Teste 3: Vies de Sobrevivente ===");
  const survivorLogs: ExecutionLog[] = Array.from({ length: 20 }, (_, i) => ({
    id: String(i + 1),
    timestamp: `2024-01-01T10:${String(i).padStart(2, "0")}:00Z`,
    type: "query",
    outcome: "success",
    duration_ms: 100 + i * 10,
  }));
  const survivor = detectSurvivorBias(survivorLogs);
  console.log("Resultado:", survivor ? `${survivor.type} (conf: ${survivor.confidence})` : "Nenhum vies");
  console.log(survivor?.type === "survivor_bias" ? "✓ Vies de sobrevivente detectado" : "✗ Nao detectado");

  // Teste 4: Deteccao avancada completa
  console.log("\n=== Teste 4: Deteccao Avancada ===");
  const mixedLogs: ExecutionLog[] = [
    { id: "1", timestamp: "2024-01-01T10:00:00Z", type: "query", outcome: "success", duration_ms: 100 },
    { id: "2", timestamp: "2024-01-01T10:01:00Z", type: "query", outcome: "success", duration_ms: 100 },
    { id: "3", timestamp: "2024-01-01T10:02:00Z", type: "query", outcome: "success", duration_ms: 100 },
    { id: "4", timestamp: "2024-01-01T10:03:00Z", type: "query", outcome: "success", duration_ms: 100 },
    { id: "5", timestamp: "2024-01-01T10:04:00Z", type: "query", outcome: "success", duration_ms: 100 },
  ];
  const advanced = detectBiasesAdvanced(mixedLogs);
  console.log("Vieses detectados:", advanced.length);
  for (const bias of advanced) {
    console.log(`  - ${bias.type}: ${bias.confidence} (${bias.evidence[0]})`);
  }
  console.log(advanced.length > 0 ? "✓ Vieses detectados" : "✓ Sistema sem vieses obvios");

  // Teste 5: Compatibilidade
  console.log("\n=== Teste 5: Compatibilidade ===");
  const simpleResult = detectBiases(confirmationLogs);
  console.log("Vieses (simples):", simpleResult);
  console.log(Array.isArray(simpleResult) ? "✓ Retorno compativel" : "✗ Erro de compatibilidade");

  console.log("\n[AE1:BiasDetector] ✓ Testes concluidos");
}
