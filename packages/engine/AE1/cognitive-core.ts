/**
 * Cognitive Core - AE1
 *
 * Nucleo cognitivo do sistema que orquestra:
 * - Memoria (short-term, long-term, vectorial)
 * - Loop de cognicao (ORAS: Observe, Reflect, Abstract, Suggest)
 * - Deteccao de padroes
 * - Gerenciamento de heuristicas
 * - Motor de aprendizado
 */

import { MemoryManager } from "./memory/memory-manager";
import { CognitionLoop } from "./cognition-loop/loop-orchestrator";
import { PatternDetector } from "./pattern-detection/pattern-detector";
import { HeuristicManager } from "./heuristics/heuristic-manager";
import { StateStore } from "./state/state-store";
import { InMemoryStore } from "./state/in-memory-store";
import { PersistentStore } from "./state/persistent-store";
import { LearningEngine } from "./learning/learning-engine";
import type { LearningReport } from "./learning/learning-types";
import type { ExecutionLog, CognitiveContext } from "./state/state-types";

// ============================================================================
// Tipos Extendidos
// ============================================================================

export interface ExtendedCognitiveContext extends CognitiveContext {
  learning_report?: LearningReport;
  learning_trend?: 'improving' | 'stable' | 'degrading';
}

// ============================================================================
// Cognitive Core
// ============================================================================

export class CognitiveCore {
  private memory!: MemoryManager;
  private cognitionLoop!: CognitionLoop;
  private patternDetector!: PatternDetector;
  private heuristicManager!: HeuristicManager;
  private stateStore!: StateStore;
  private learningEngine!: LearningEngine;
  private mode: "lite" | "fullstack";
  private learningSchedulerId?: ReturnType<typeof setInterval>;
  private lastLearningReport?: LearningReport;

  constructor(mode: "lite" | "fullstack") {
    this.mode = mode;
    console.log(`[AE1] Initializing Cognitive Core in ${mode} mode...`);
  }

  // ==========================================================================
  // Inicializacao
  // ==========================================================================

  async initialize(): Promise<void> {
    await this.waitForAE2();
    this.stateStore = await this.initializeStateStore();
    this.memory = await this.initializeMemory();
    this.patternDetector = new PatternDetector(this.mode);
    this.heuristicManager = new HeuristicManager(this.mode);
    this.cognitionLoop = new CognitionLoop(
      this.memory,
      this.patternDetector,
      this.heuristicManager,
      this.mode
    );

    // Inicializa motor de aprendizado
    this.learningEngine = new LearningEngine(
      {
        recentWindowMs: this.mode === 'lite' ? 1800000 : 3600000, // 30min lite, 1h fullstack
        minSampleSize: this.mode === 'lite' ? 5 : 10,
        enableAnomalyDetection: this.mode === 'fullstack',
      },
      this.stateStore,
      this.mode
    );

    if (this.mode === "fullstack") {
      this.cognitionLoop.start();
      this.startLearningScheduler();
    }

    console.log("[AE1] Cognitive Core initialized ✓");
    console.log(`[AE1] Learning Engine initialized in ${this.mode} mode`);
  }

  private async waitForAE2(): Promise<void> {
    console.log("[AE1] Waiting for AE2 to be ready...");
    // Placeholder: implement wait strategy.
  }

  private async initializeStateStore(): Promise<StateStore> {
    if (this.mode === "lite") {
      return new InMemoryStore();
    }
    return new PersistentStore();
  }

  private async initializeMemory(): Promise<MemoryManager> {
    return new MemoryManager(this.mode, this.stateStore);
  }

  // ==========================================================================
  // Learning Engine
  // ==========================================================================

  /**
   * Inicia scheduler de aprendizado periodico (fullstack mode)
   */
  private startLearningScheduler(): void {
    if (this.mode !== 'fullstack') return;

    const LEARNING_INTERVAL_MS = 300000; // 5 minutos

    console.log(`[AE1] Starting learning scheduler (interval: ${LEARNING_INTERVAL_MS / 1000}s)`);

    this.learningSchedulerId = setInterval(async () => {
      try {
        await this.runLearningCycle();
      } catch (error) {
        console.error("[AE1] Learning cycle error:", error);
      }
    }, LEARNING_INTERVAL_MS);
  }

  /**
   * Para scheduler de aprendizado
   */
  stopLearningScheduler(): void {
    if (this.learningSchedulerId) {
      clearInterval(this.learningSchedulerId);
      this.learningSchedulerId = undefined;
      console.log("[AE1] Learning scheduler stopped");
    }
  }

  /**
   * Executa ciclo de aprendizado
   */
  async runLearningCycle(): Promise<LearningReport> {
    console.log("[AE1] Running learning cycle...");

    // Recupera logs recentes da memoria
    const recentLogs = await this.getRecentExecutionLogs();

    // Executa analise de aprendizado
    const report = await this.learningEngine.run(recentLogs);

    // Armazena ultimo relatorio
    this.lastLearningReport = report;

    // Log resumo
    console.log(`[AE1] Learning cycle complete: ${report.performance.total} logs, ` +
      `${(report.performance.success_rate * 100).toFixed(1)}% success, ` +
      `trend: ${report.trend ?? 'unknown'}`);

    // Aplica feedback se houver acoes criticas
    if (report.feedback.prioritizedActions?.some(a => a.priority === 'critical')) {
      console.log("[AE1] Critical actions detected, triggering heuristic review...");
      await this.applyLearningFeedback(report);
    }

    return report;
  }

  /**
   * Recupera logs recentes da memoria
   */
  private async getRecentExecutionLogs(): Promise<ExecutionLog[]> {
    try {
      // Tenta recuperar da memoria
      const events = await this.memory.retrieve({
        timeframe: 'recent',
        limit: 1000,
      });

      // Converte MemoryEvent para ExecutionLog
      return events.map((event) => ({
        id: event.id,
        timestamp: event.timestamp,
        type: event.type,
        outcome: event.outcome,
        duration_ms: event.duration_ms,
      }));
    } catch {
      // Fallback: retorna lista vazia
      return [];
    }
  }

  /**
   * Aplica feedback de aprendizado ao sistema
   */
  private async applyLearningFeedback(report: LearningReport): Promise<void> {
    const criticalActions = report.feedback.prioritizedActions?.filter(
      (a) => a.priority === 'critical' || a.priority === 'high'
    ) ?? [];

    for (const action of criticalActions) {
      switch (action.action) {
        case "emergency_review":
          console.log("[AE1] Emergency review triggered:", action.reason);
          // Futuro: notificar AE2 ou acionar alertas
          break;

        case "review_heuristics":
          console.log("[AE1] Triggering heuristic review:", action.reason);
          await this.heuristicManager.triggerReview?.();
          break;

        case "urgent_optimization":
          console.log("[AE1] Urgent optimization needed:", action.reason);
          // Futuro: notificar sistema de otimizacao
          break;

        default:
          console.log(`[AE1] Action: ${action.action} - ${action.reason}`);
      }
    }
  }

  /**
   * Obtem ultimo relatorio de aprendizado
   */
  getLastLearningReport(): LearningReport | undefined {
    return this.lastLearningReport;
  }

  /**
   * Obtem historico de aprendizado
   */
  async getLearningHistory(limit?: number) {
    return this.learningEngine.getHistory(limit);
  }

  // ==========================================================================
  // Operacoes Principais
  // ==========================================================================

  async recordExecution(executionLog: ExecutionLog): Promise<void> {
    await this.memory.store(executionLog);
    await this.cognitionLoop.trigger();

    // Em modo lite, executa learning a cada N execucoes
    if (this.mode === 'lite') {
      const stats = this.learningEngine.getStats();
      if (stats.executionCount % 10 === 0) {
        // A cada 10 execucoes em lite mode
        void this.runLearningCycle();
      }
    }
  }

  async getCognitiveContext(): Promise<ExtendedCognitiveContext> {
    const baseContext: CognitiveContext = {
      recent_patterns: await this.patternDetector.getRecentPatterns(),
      heuristic_suggestions: await this.heuristicManager.getSuggestions(),
      memory_insights: await this.memory.getInsights(),
      risk_indicators: await this.patternDetector.getRiskIndicators(),
    };

    // Adiciona dados de aprendizado
    return {
      ...baseContext,
      learning_report: this.lastLearningReport,
      learning_trend: this.lastLearningReport?.trend,
    };
  }

  // ==========================================================================
  // Ciclo de Vida
  // ==========================================================================

  /**
   * Para todos os processos do CognitiveCore
   */
  async shutdown(): Promise<void> {
    console.log("[AE1] Shutting down Cognitive Core...");

    // Para scheduler de aprendizado
    this.stopLearningScheduler();

    // Para loop de cognicao
    if (this.mode === 'fullstack') {
      this.cognitionLoop.stop?.();
    }

    console.log("[AE1] Cognitive Core shutdown complete");
  }
}

// ============================================================================
// CLI Test Suite
// ============================================================================

if (require.main === module) {
  console.log("[AE1:CognitiveCore] Testando Cognitive Core...\n");

  async function runTests() {
    // Teste 1: Inicializacao lite
    console.log("=== Teste 1: Inicializacao Lite ===");
    const liteCore = new CognitiveCore('lite');
    try {
      await liteCore.initialize();
      console.log("✓ Lite mode inicializado");
    } catch (error) {
      console.log("✗ Erro na inicializacao:", error);
    }

    // Teste 2: Gravar execucao
    console.log("\n=== Teste 2: Gravar Execucao ===");
    const testLog: ExecutionLog = {
      id: "test_1",
      timestamp: new Date().toISOString(),
      type: "query",
      outcome: "success",
      duration_ms: 150,
    };
    try {
      await liteCore.recordExecution(testLog);
      console.log("✓ Execucao gravada");
    } catch (error) {
      console.log("✗ Erro ao gravar:", error);
    }

    // Teste 3: Learning cycle
    console.log("\n=== Teste 3: Learning Cycle ===");
    try {
      const report = await liteCore.runLearningCycle();
      console.log("Performance:", report.performance);
      console.log("✓ Learning cycle executado");
    } catch (error) {
      console.log("✗ Erro no learning:", error);
    }

    // Teste 4: Contexto cognitivo
    console.log("\n=== Teste 4: Contexto Cognitivo ===");
    try {
      const context = await liteCore.getCognitiveContext();
      console.log("Has learning_report:", !!context.learning_report);
      console.log("Trend:", context.learning_trend ?? "N/A");
      console.log("✓ Contexto obtido");
    } catch (error) {
      console.log("✗ Erro no contexto:", error);
    }

    // Teste 5: Shutdown
    console.log("\n=== Teste 5: Shutdown ===");
    try {
      await liteCore.shutdown();
      console.log("✓ Shutdown completo");
    } catch (error) {
      console.log("✗ Erro no shutdown:", error);
    }

    console.log("\n[AE1:CognitiveCore] ✓ Testes concluidos");
  }

  runTests().catch(console.error);
}
