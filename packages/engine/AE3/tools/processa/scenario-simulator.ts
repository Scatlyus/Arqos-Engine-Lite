import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

/**
 * Representa um cenário a ser simulado
 */
type Scenario = {
  name: string;
  description: string;
  variables: Record<string, number>;
  constraints?: Record<string, { min?: number; max?: number }>;
};

/**
 * Resultado de uma simulação individual
 */
type SimulationResult = {
  scenarioName: string;
  iteration: number;
  variables: Record<string, number>;
  computedMetrics: Record<string, number>;
  impactScore: number;
  feasible: boolean;
  violations: string[];
};

/**
 * Análise agregada de múltiplas simulações
 */
type SimulationAnalysis = {
  totalIterations: number;
  feasibleCount: number;
  feasibilityRate: number;
  averageImpact: number;
  bestCase: SimulationResult;
  worstCase: SimulationResult;
  metrics: {
    mean: Record<string, number>;
    stdDev: Record<string, number>;
    min: Record<string, number>;
    max: Record<string, number>;
  };
};

/**
 * Opções de simulação
 */
type SimulationOptions = {
  iterations?: number;
  method?: "montecarlo" | "deterministic" | "sensitivity";
  variancePercentage?: number;
  seed?: number;
};

/**
 * AE3 Tool: ScenarioSimulator
 *
 * **Fase**: PROCESSA (Transformation & Analysis)
 * **Propósito**: Simulação de cenários preditivos com análise de impacto
 *
 * **Funcionalidades**:
 * - Simulação Monte Carlo para análise de incerteza
 * - Análise de sensibilidade de variáveis
 * - Simulações determinísticas
 * - Validação de constraints e viabilidade
 * - Cálculo de métricas estatísticas (média, desvio padrão, min, max)
 * - Identificação de melhor e pior cenário
 */
export class ScenarioSimulator implements Tool {
  id = "T14";
  name = "ScenarioSimulator";
  phase = "processa" as const;
  version = "2.0.0";

  private executionCount = 0;
  private totalDuration = 0;
  private successCount = 0;
  private simulationHistory: Map<string, SimulationAnalysis> = new Map();

  constructor() {}

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      const scenario = this.extractScenario(input);
      const options = this.extractOptions(input);

      // Executar simulação
      const results = this.runSimulation(scenario, options);

      // Analisar resultados
      const analysis = this.analyzeResults(results);

      const duration = Date.now() - startTime;
      this.totalDuration += duration;
      this.successCount++;

      // Armazenar histórico
      this.simulationHistory.set(`${scenario.name}_${Date.now()}`, analysis);

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: {
          scenario: scenario.name,
          analysis,
          results: results.slice(0, 10), // Retornar primeiras 10 iterações para evitar payload grande
          metadata: {
            method: options.method || "montecarlo",
            iterations: options.iterations || 100,
            feasibilityRate: analysis.feasibilityRate,
            avgImpact: analysis.averageImpact
          }
        },
        duration_ms: duration,
        timestamp: new Date()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.totalDuration += duration;
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        error: message,
        duration_ms: duration,
        timestamp: new Date()
      };
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount > 0 ? this.totalDuration / this.executionCount : 0;
    const successRate = this.executionCount > 0 ? this.successCount / this.executionCount : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.95 ? "healthy" : successRate > 0.8 ? "degraded" : "unhealthy",
      last_check: new Date(),
      avg_latency_ms: Math.round(avgLatency),
      success_rate: Number(successRate.toFixed(2))
    };
  }

  /**
   * Retorna histórico de simulações
   */
  getSimulationHistory(): Map<string, SimulationAnalysis> {
    return this.simulationHistory;
  }

  private extractScenario(input: ToolInput): Scenario {
    const scenario = input.scenario as Scenario | undefined;

    if (!scenario) {
      throw new Error("Invalid input: scenario object is required");
    }

    if (!scenario.name || !scenario.variables || Object.keys(scenario.variables).length === 0) {
      throw new Error("Invalid scenario: name and variables are required");
    }

    return {
      name: scenario.name,
      description: scenario.description || "",
      variables: scenario.variables,
      constraints: scenario.constraints
    };
  }

  private extractOptions(input: ToolInput): SimulationOptions {
    const opts = (input.options as SimulationOptions | undefined) || {};

    return {
      iterations: opts.iterations ?? 100,
      method: opts.method ?? "montecarlo",
      variancePercentage: opts.variancePercentage ?? 10,
      seed: opts.seed
    };
  }

  private runSimulation(scenario: Scenario, options: SimulationOptions): SimulationResult[] {
    const results: SimulationResult[] = [];
    const iterations = options.iterations || 100;

    // Seed para RNG (se especificado)
    let rngState = options.seed ?? Date.now();

    for (let i = 0; i < iterations; i++) {
      const vars = this.generateVariables(scenario, options, rngState);
      rngState = (rngState * 1103515245 + 12345) & 0x7fffffff; // Linear Congruential Generator

      const metrics = this.computeMetrics(vars, scenario);
      const impact = this.calculateImpact(metrics);
      const { feasible, violations } = this.checkConstraints(vars, scenario);

      results.push({
        scenarioName: scenario.name,
        iteration: i + 1,
        variables: vars,
        computedMetrics: metrics,
        impactScore: impact,
        feasible,
        violations
      });
    }

    return results;
  }

  private generateVariables(
    scenario: Scenario,
    options: SimulationOptions,
    seed: number
  ): Record<string, number> {
    const vars: Record<string, number> = {};
    const variance = (options.variancePercentage || 10) / 100;

    // Função de random baseada em seed (LCG)
    const random = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };

    Object.entries(scenario.variables).forEach(([key, baseValue]) => {
      if (options.method === "deterministic") {
        vars[key] = baseValue;
      } else if (options.method === "montecarlo") {
        // Distribuição normal simulada (Box-Muller transform)
        const u1 = random();
        const u2 = random();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        vars[key] = baseValue + baseValue * variance * z;
      } else if (options.method === "sensitivity") {
        // Variação linear entre -variance e +variance
        const factor = -variance + 2 * variance * random();
        vars[key] = baseValue * (1 + factor);
      }
    });

    return vars;
  }

  private computeMetrics(variables: Record<string, number>, scenario: Scenario): Record<string, number> {
    const metrics: Record<string, number> = {};

    // Métricas básicas
    metrics.sum = Object.values(variables).reduce((acc, val) => acc + val, 0);
    metrics.average = metrics.sum / Object.keys(variables).length;
    metrics.max = Math.max(...Object.values(variables));
    metrics.min = Math.min(...Object.values(variables));
    metrics.range = metrics.max - metrics.min;

    // Métricas específicas do domínio (exemplos)
    if (variables.revenue && variables.cost) {
      metrics.profit = variables.revenue - variables.cost;
      metrics.margin = variables.revenue > 0 ? (metrics.profit / variables.revenue) * 100 : 0;
    }

    if (variables.demand && variables.supply) {
      metrics.balance = variables.supply - variables.demand;
      metrics.utilizationRate = variables.supply > 0 ? (variables.demand / variables.supply) * 100 : 0;
    }

    if (variables.investment && variables.returns) {
      metrics.roi = variables.investment > 0 ? ((variables.returns - variables.investment) / variables.investment) * 100 : 0;
    }

    return metrics;
  }

  private calculateImpact(metrics: Record<string, number>): number {
    // Heurística de impacto baseada em métricas calculadas
    let impact = 0;

    if (metrics.profit !== undefined) {
      impact += metrics.profit * 0.4;
    }

    if (metrics.roi !== undefined) {
      impact += metrics.roi * 0.3;
    }

    if (metrics.balance !== undefined) {
      impact += metrics.balance * 0.2;
    }

    if (metrics.average !== undefined) {
      impact += metrics.average * 0.1;
    }

    return Number(impact.toFixed(2));
  }

  private checkConstraints(
    variables: Record<string, number>,
    scenario: Scenario
  ): { feasible: boolean; violations: string[] } {
    const violations: string[] = [];

    if (!scenario.constraints) {
      return { feasible: true, violations };
    }

    Object.entries(scenario.constraints).forEach(([varName, constraint]) => {
      const value = variables[varName];

      if (value === undefined) {
        return;
      }

      if (constraint.min !== undefined && value < constraint.min) {
        violations.push(`${varName} (${value.toFixed(2)}) abaixo do mínimo (${constraint.min})`);
      }

      if (constraint.max !== undefined && value > constraint.max) {
        violations.push(`${varName} (${value.toFixed(2)}) acima do máximo (${constraint.max})`);
      }
    });

    return {
      feasible: violations.length === 0,
      violations
    };
  }

  private analyzeResults(results: SimulationResult[]): SimulationAnalysis {
    const feasibleResults = results.filter((r) => r.feasible);
    const totalIterations = results.length;
    const feasibleCount = feasibleResults.length;
    const feasibilityRate = totalIterations > 0 ? feasibleCount / totalIterations : 0;

    // Impacto médio
    const impacts = results.map((r) => r.impactScore);
    const averageImpact = impacts.reduce((sum, val) => sum + val, 0) / impacts.length;

    // Melhor e pior caso
    const bestCase = results.reduce((best, current) =>
      current.impactScore > best.impactScore ? current : best
    );
    const worstCase = results.reduce((worst, current) =>
      current.impactScore < worst.impactScore ? current : worst
    );

    // Métricas estatísticas
    const metrics = this.calculateStatistics(results);

    return {
      totalIterations,
      feasibleCount,
      feasibilityRate: Number(feasibilityRate.toFixed(2)),
      averageImpact: Number(averageImpact.toFixed(2)),
      bestCase,
      worstCase,
      metrics
    };
  }

  private calculateStatistics(results: SimulationResult[]): {
    mean: Record<string, number>;
    stdDev: Record<string, number>;
    min: Record<string, number>;
    max: Record<string, number>;
  } {
    const mean: Record<string, number> = {};
    const stdDev: Record<string, number> = {};
    const min: Record<string, number> = {};
    const max: Record<string, number> = {};

    if (results.length === 0) {
      return { mean, stdDev, min, max };
    }

    // Coletar todas as métricas disponíveis
    const metricKeys = new Set<string>();
    results.forEach((r) => {
      Object.keys(r.computedMetrics).forEach((key) => metricKeys.add(key));
    });

    // Calcular estatísticas para cada métrica
    metricKeys.forEach((key) => {
      const values = results.map((r) => r.computedMetrics[key]).filter((v) => v !== undefined);

      if (values.length === 0) {
        return;
      }

      // Média
      mean[key] = values.reduce((sum, val) => sum + val, 0) / values.length;

      // Min/Max
      min[key] = Math.min(...values);
      max[key] = Math.max(...values);

      // Desvio padrão
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean[key], 2), 0) / values.length;
      stdDev[key] = Math.sqrt(variance);

      // Arredondar
      mean[key] = Number(mean[key].toFixed(2));
      stdDev[key] = Number(stdDev[key].toFixed(2));
      min[key] = Number(min[key].toFixed(2));
      max[key] = Number(max[key].toFixed(2));
    });

    return { mean, stdDev, min, max };
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE3:ScenarioSimulator] Testando ScenarioSimulator...\n");

  async function runTests() {
    const simulator = new ScenarioSimulator();

    // Teste 1: Simulação Monte Carlo - Cenário Financeiro
    console.log("=== Teste 1: Simulação Monte Carlo - Cenário Financeiro ===");
    const result1 = await simulator.execute({
      scenario: {
        name: "Projeção de Receita Q1",
        description: "Simulação de receita e custo para Q1 2026",
        variables: {
          revenue: 100000,
          cost: 65000
        },
        constraints: {
          revenue: { min: 80000 },
          cost: { max: 70000 }
        }
      },
      options: {
        iterations: 50,
        method: "montecarlo",
        variancePercentage: 15
      }
    });

    if (result1.success) {
      console.log("Cenário:", result1.output.scenario);
      console.log("Iterações:", result1.output.metadata.iterations);
      console.log("Taxa de viabilidade:", (result1.output.metadata.feasibilityRate * 100).toFixed(1), "%");
      console.log("Impacto médio:", result1.output.metadata.avgImpact);
      console.log("Melhor caso - impacto:", result1.output.analysis.bestCase.impactScore);
      console.log("Pior caso - impacto:", result1.output.analysis.worstCase.impactScore);
      console.log("Estatísticas:");
      console.log("  - Lucro médio:", result1.output.analysis.metrics.mean.profit);
      console.log("  - Margem média:", result1.output.analysis.metrics.mean.margin?.toFixed(2), "%");
    }

    // Teste 2: Simulação Determinística
    console.log("\n=== Teste 2: Simulação Determinística ===");
    const result2 = await simulator.execute({
      scenario: {
        name: "Baseline Operations",
        description: "Cenário base sem variação",
        variables: {
          demand: 1000,
          supply: 1200,
          inventory: 500
        }
      },
      options: {
        iterations: 1,
        method: "deterministic"
      }
    });

    if (result2.success) {
      console.log("Cenário:", result2.output.scenario);
      console.log("Método:", result2.output.metadata.method);
      console.log("Métricas calculadas:");
      console.log(JSON.stringify(result2.output.results[0].computedMetrics, null, 2));
    }

    // Teste 3: Análise de Sensibilidade - Investimento
    console.log("\n=== Teste 3: Análise de Sensibilidade - ROI ===");
    const result3 = await simulator.execute({
      scenario: {
        name: "Investimento em Marketing",
        description: "Análise de sensibilidade para investimento",
        variables: {
          investment: 50000,
          returns: 75000
        },
        constraints: {
          investment: { min: 30000, max: 100000 },
          returns: { min: 60000 }
        }
      },
      options: {
        iterations: 30,
        method: "sensitivity",
        variancePercentage: 20
      }
    });

    if (result3.success) {
      console.log("Cenário:", result3.output.scenario);
      console.log("Iterações viáveis:", result3.output.analysis.feasibleCount, "/", result3.output.metadata.iterations);
      console.log("Taxa de viabilidade:", (result3.output.metadata.feasibilityRate * 100).toFixed(1), "%");
      console.log("ROI médio:", result3.output.analysis.metrics.mean.roi?.toFixed(2), "%");
      console.log("ROI (desvio padrão):", result3.output.analysis.metrics.stdDev.roi?.toFixed(2));
      console.log("ROI (min/max):", result3.output.analysis.metrics.min.roi?.toFixed(2), "/", result3.output.analysis.metrics.max.roi?.toFixed(2));
    }

    // Teste 4: Cenário com Violações de Constraints
    console.log("\n=== Teste 4: Cenário com Constraints Rigorosas ===");
    const result4 = await simulator.execute({
      scenario: {
        name: "Operação Restrita",
        description: "Cenário com constraints muito apertadas",
        variables: {
          production: 100,
          quality: 95
        },
        constraints: {
          production: { min: 95, max: 105 },
          quality: { min: 98 }
        }
      },
      options: {
        iterations: 40,
        method: "montecarlo",
        variancePercentage: 5
      }
    });

    if (result4.success) {
      console.log("Cenário:", result4.output.scenario);
      console.log("Iterações viáveis:", result4.output.analysis.feasibleCount, "/", result4.output.metadata.iterations);
      console.log("Taxa de viabilidade:", (result4.output.metadata.feasibilityRate * 100).toFixed(1), "%");
      if (result4.output.analysis.feasibleCount < result4.output.metadata.iterations) {
        console.log("Exemplo de violação:", result4.output.results.find((r: { feasible: boolean }) => !r.feasible)?.violations[0]);
      }
    }

    // Teste 5: Health check
    console.log("\n=== Teste 5: Health Check ===");
    const health = await simulator.healthCheck();
    console.log("Status:", health.status);
    console.log("Latência média:", health.avg_latency_ms, "ms");
    console.log("Taxa de sucesso:", (health.success_rate * 100).toFixed(0), "%");

    console.log("\n[AE3:ScenarioSimulator] ✓ Testes concluídos");
  }

  runTests().catch(console.error);
}
