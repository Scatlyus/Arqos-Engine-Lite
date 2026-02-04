/**
 * Predictive Optimization - Módulo M6 do AE2
 * Responsável por simulação de cenários, predição de resultados e análise de Monte Carlo
 */

import type {
  StrategicAnalysis,
  SimulationResult,
  ScenarioOutcome,
  ModuleStatus,
  DecisionContext,
  OrchestrationPlan
} from '../../types';

// ========== Configurações ==========

interface PredictiveOptimizationConfig {
  /** Número de iterações para Monte Carlo */
  monteCarloIterations: number;
  /** Nível de confiança para intervalos (0-1) */
  confidenceLevel: number;
  /** Número máximo de cenários a simular */
  maxScenarios: number;
  /** Seed para reprodutibilidade (opcional) */
  randomSeed?: number;
  /** Habilitar análise de sensibilidade */
  enableSensitivityAnalysis: boolean;
  /** Peso de histórico na predição */
  historicalWeight: number;
}

const DEFAULT_CONFIG: PredictiveOptimizationConfig = {
  monteCarloIterations: 1000,
  confidenceLevel: 0.95,
  maxScenarios: 10,
  enableSensitivityAnalysis: true,
  historicalWeight: 0.3
};

// ========== Tipos Internos ==========

interface Scenario {
  id: string;
  name: string;
  description: string;
  parameters: ScenarioParameters;
  probability: number;
  impact: number;
  riskLevel: 'high' | 'medium' | 'low';
}

interface ScenarioParameters {
  successRate: number;
  resourceUsage: number;
  timeMultiplier: number;
  errorProbability: number;
  parallelismFactor: number;
}

interface PredictionResult {
  scenarioId: string;
  outcome: 'success' | 'partial' | 'failure';
  confidence: number;
  expectedDuration: number;
  resourceCost: number;
  riskScore: number;
  factors: PredictionFactor[];
}

interface PredictionFactor {
  name: string;
  value: number;
  impact: number;
  description: string;
}

interface MonteCarloResult {
  iterations: number;
  mean: number;
  median: number;
  stdDev: number;
  percentile5: number;
  percentile95: number;
  successProbability: number;
  distribution: number[];
}

interface SensitivityResult {
  parameter: string;
  baseValue: number;
  sensitivity: number;
  impact: 'high' | 'medium' | 'low';
  recommendation: string;
}

interface OptimizationRecommendation {
  type: 'resource' | 'timing' | 'approach' | 'risk_mitigation';
  priority: 'high' | 'medium' | 'low';
  description: string;
  expectedImprovement: number;
  tradeoffs: string[];
}

// ========== Classe Principal ==========

export class PredictiveOptimization {
  private config: PredictiveOptimizationConfig;
  private initialized = false;
  private lastActivity?: number;

  // Cache e histórico
  private scenarioCache: Map<string, Scenario[]> = new Map();
  private predictionHistory: PredictionResult[] = [];

  // Métricas
  private totalSimulations = 0;
  private totalPredictions = 0;
  private accuratePredictons = 0;

  constructor(config: Partial<PredictiveOptimizationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async initialize(): Promise<void> {
    console.log('[AE2:M6] Predictive Optimization initializing...');
    this.initialized = true;
    this.lastActivity = Date.now();
    console.log('[AE2:M6] Predictive Optimization initialized ✓');
  }

  getStatus(): ModuleStatus {
    return {
      name: 'PredictiveOptimization',
      initialized: this.initialized,
      healthy: this.initialized,
      lastActivity: this.lastActivity,
      stats: {
        totalSimulations: this.totalSimulations,
        totalPredictions: this.totalPredictions,
        accuracyRate: this.totalPredictions > 0
          ? (this.accuratePredictons / this.totalPredictions).toFixed(2)
          : 'N/A',
        cachedScenarios: this.scenarioCache.size
      }
    };
  }

  // ========== Simulação de Cenários ==========

  /**
   * Simula cenários baseados na análise estratégica
   */
  async simulate(
    strategic: StrategicAnalysis | { objectives?: string[] },
    environmental: { signals?: string[]; environment?: { signals?: string[] } } | unknown,
    cognitive: { recentPatterns?: string[] } | unknown
  ): Promise<SimulationResult> {
    console.log('[AE2:M6] Starting scenario simulation...');
    this.lastActivity = Date.now();
    this.totalSimulations++;

    // Extrair dados dos inputs
    const objectives = this.extractObjectives(strategic);
    const signals = this.extractSignals(environmental);
    const patterns = this.extractPatterns(cognitive);

    // Gerar cenários
    const scenarios = this.generateScenarios(objectives, signals, patterns);

    // Simular cada cenário
    const simulatedOutcomes: ScenarioOutcome[] = [];
    for (const scenario of scenarios) {
      const outcome = await this.simulateScenario(scenario);
      simulatedOutcomes.push(outcome);
    }

    // Determinar cenário recomendado
    const recommended = this.selectBestScenario(simulatedOutcomes);

    // Calcular confiança geral
    const confidence = this.calculateOverallConfidence(simulatedOutcomes);

    const result: SimulationResult = {
      scenarios: simulatedOutcomes,
      recommended: recommended.id,
      confidence
    };

    console.log(`[AE2:M6] Simulation complete: ${simulatedOutcomes.length} scenarios, recommended: ${recommended.name}`);
    return result;
  }

  /**
   * Gera cenários possíveis
   */
  generateScenarios(
    objectives: string[],
    signals: string[],
    patterns: string[]
  ): Scenario[] {
    const scenarios: Scenario[] = [];
    const baseId = Date.now().toString(36);

    // Cenário 1: Otimista
    scenarios.push({
      id: `${baseId}_optimistic`,
      name: 'Cenário Otimista',
      description: 'Execução com condições favoráveis',
      parameters: {
        successRate: 0.9,
        resourceUsage: 0.6,
        timeMultiplier: 0.8,
        errorProbability: 0.05,
        parallelismFactor: 1.2
      },
      probability: 0.25,
      impact: objectives.length * 0.3,
      riskLevel: 'low'
    });

    // Cenário 2: Realista/Baseline
    scenarios.push({
      id: `${baseId}_baseline`,
      name: 'Cenário Baseline',
      description: 'Execução com condições normais',
      parameters: {
        successRate: 0.75,
        resourceUsage: 0.7,
        timeMultiplier: 1.0,
        errorProbability: 0.1,
        parallelismFactor: 1.0
      },
      probability: 0.5,
      impact: objectives.length * 0.2,
      riskLevel: 'medium'
    });

    // Cenário 3: Pessimista
    scenarios.push({
      id: `${baseId}_pessimistic`,
      name: 'Cenário Pessimista',
      description: 'Execução com condições adversas',
      parameters: {
        successRate: 0.5,
        resourceUsage: 0.9,
        timeMultiplier: 1.5,
        errorProbability: 0.25,
        parallelismFactor: 0.7
      },
      probability: 0.2,
      impact: objectives.length * 0.1,
      riskLevel: 'high'
    });

    // Cenários adicionais baseados em padrões
    if (patterns.includes('high_load') || signals.includes('load_spike')) {
      scenarios.push({
        id: `${baseId}_high_load`,
        name: 'Cenário de Alta Carga',
        description: 'Sistema sob pressão elevada',
        parameters: {
          successRate: 0.6,
          resourceUsage: 0.95,
          timeMultiplier: 1.8,
          errorProbability: 0.2,
          parallelismFactor: 0.5
        },
        probability: 0.15,
        impact: objectives.length * 0.15,
        riskLevel: 'high'
      });
    }

    // Cenário adaptativo
    if (objectives.length > 3) {
      scenarios.push({
        id: `${baseId}_adaptive`,
        name: 'Cenário Adaptativo',
        description: 'Execução com ajustes dinâmicos',
        parameters: {
          successRate: 0.7,
          resourceUsage: 0.75,
          timeMultiplier: 1.2,
          errorProbability: 0.12,
          parallelismFactor: 0.9
        },
        probability: 0.1,
        impact: objectives.length * 0.25,
        riskLevel: 'medium'
      });
    }

    return scenarios.slice(0, this.config.maxScenarios);
  }

  /**
   * Simula um cenário específico
   */
  private async simulateScenario(scenario: Scenario): Promise<ScenarioOutcome> {
    const { parameters } = scenario;

    // Calcular duração esperada
    const baseDuration = 5000; // 5 segundos base
    const expectedDuration = Math.round(baseDuration * parameters.timeMultiplier);

    // Calcular probabilidade
    const probability = scenario.probability * parameters.successRate;

    return {
      id: scenario.id,
      name: scenario.name,
      probability: Number(probability.toFixed(3)),
      expectedDuration,
      riskLevel: scenario.riskLevel
    };
  }

  // ========== Predição de Resultados ==========

  /**
   * Prediz resultados de um plano de execução
   */
  async predictOutcome(plan: OrchestrationPlan): Promise<PredictionResult> {
    console.log(`[AE2:M6] Predicting outcome for plan ${plan.id}...`);
    this.lastActivity = Date.now();
    this.totalPredictions++;

    // Analisar fatores do plano
    const factors = this.analyzePlanFactors(plan);

    // Calcular scores
    const successProbability = this.calculateSuccessProbability(factors);
    const riskScore = this.calculateRiskScore(factors);
    const expectedDuration = this.estimateDuration(plan, factors);
    const resourceCost = this.estimateResourceCost(plan, factors);

    // Determinar outcome esperado
    const outcome = successProbability > 0.7 ? 'success' :
                    successProbability > 0.4 ? 'partial' : 'failure';

    const result: PredictionResult = {
      scenarioId: plan.id,
      outcome,
      confidence: successProbability,
      expectedDuration,
      resourceCost,
      riskScore,
      factors
    };

    // Armazenar no histórico
    this.predictionHistory.push(result);
    if (this.predictionHistory.length > 100) {
      this.predictionHistory.shift();
    }

    console.log(`[AE2:M6] Prediction: ${outcome} (confidence: ${(successProbability * 100).toFixed(1)}%)`);
    return result;
  }

  /**
   * Analisa fatores de um plano
   */
  private analyzePlanFactors(plan: OrchestrationPlan): PredictionFactor[] {
    const factors: PredictionFactor[] = [];

    // Fator: Complexidade do plano
    const stepCount = plan.steps.length;
    const complexityScore = Math.min(1, stepCount / 10);
    factors.push({
      name: 'plan_complexity',
      value: complexityScore,
      impact: -complexityScore * 0.2,
      description: `Plan has ${stepCount} steps`
    });

    // Fator: Disponibilidade de agentes
    const agentCount = plan.agents.length;
    const agentScore = Math.min(1, agentCount / 5);
    factors.push({
      name: 'agent_availability',
      value: agentScore,
      impact: agentScore * 0.3,
      description: `${agentCount} agents available`
    });

    // Fator: Paralelismo
    const parallelism = plan.expectedMetrics.parallelism;
    const parallelismScore = Math.min(1, parallelism / 3);
    factors.push({
      name: 'parallelism',
      value: parallelismScore,
      impact: parallelismScore * 0.2,
      description: `Parallelism factor: ${parallelism}`
    });

    // Fator: Timeout budget
    const timeoutRatio = plan.timeoutBudget / (plan.expectedMetrics.estimatedDuration || 1);
    const timeoutScore = Math.min(1, timeoutRatio);
    factors.push({
      name: 'timeout_margin',
      value: timeoutScore,
      impact: (timeoutScore - 0.5) * 0.3,
      description: `Timeout budget ratio: ${timeoutRatio.toFixed(2)}`
    });

    // Fator: Política de rollback
    const rollbackEnabled = plan.rollbackPolicy.enabled ? 0.8 : 0.5;
    factors.push({
      name: 'rollback_safety',
      value: rollbackEnabled,
      impact: rollbackEnabled * 0.15,
      description: `Rollback ${plan.rollbackPolicy.enabled ? 'enabled' : 'disabled'}`
    });

    // Fator: Restrições
    const constraintCount = plan.constraints.length;
    const constraintScore = Math.max(0, 1 - constraintCount * 0.1);
    factors.push({
      name: 'constraint_load',
      value: constraintScore,
      impact: -constraintCount * 0.05,
      description: `${constraintCount} constraints applied`
    });

    return factors;
  }

  private calculateSuccessProbability(factors: PredictionFactor[]): number {
    let baseProbability = 0.7;

    for (const factor of factors) {
      baseProbability += factor.impact;
    }

    return Math.max(0.1, Math.min(0.99, baseProbability));
  }

  private calculateRiskScore(factors: PredictionFactor[]): number {
    let riskScore = 0;

    for (const factor of factors) {
      if (factor.impact < 0) {
        riskScore += Math.abs(factor.impact);
      }
    }

    return Math.min(1, riskScore);
  }

  private estimateDuration(plan: OrchestrationPlan, factors: PredictionFactor[]): number {
    let baseDuration = plan.expectedMetrics.estimatedDuration;

    // Ajustar por fatores
    const complexityFactor = factors.find(f => f.name === 'plan_complexity');
    if (complexityFactor) {
      baseDuration *= (1 + complexityFactor.value * 0.3);
    }

    const parallelismFactor = factors.find(f => f.name === 'parallelism');
    if (parallelismFactor) {
      baseDuration *= (1 - parallelismFactor.value * 0.2);
    }

    return Math.round(baseDuration);
  }

  private estimateResourceCost(plan: OrchestrationPlan, factors: PredictionFactor[]): number {
    let baseCost = 0.5;

    // Custo por step
    baseCost += plan.steps.length * 0.03;

    // Custo por agente
    baseCost += plan.agents.length * 0.05;

    // Ajustar por paralelismo
    const parallelismFactor = factors.find(f => f.name === 'parallelism');
    if (parallelismFactor) {
      baseCost *= (1 + parallelismFactor.value * 0.1);
    }

    return Math.min(1, baseCost);
  }

  // ========== Análise de Monte Carlo ==========

  /**
   * Executa simulação de Monte Carlo
   */
  runMonteCarlo(
    baseValue: number,
    volatility: number,
    successThreshold: number = 0.7
  ): MonteCarloResult {
    console.log('[AE2:M6] Running Monte Carlo simulation...');
    this.lastActivity = Date.now();

    const results: number[] = [];
    let successCount = 0;

    for (let i = 0; i < this.config.monteCarloIterations; i++) {
      // Gerar valor usando Box-Muller transform
      const u1 = Math.random();
      const u2 = Math.random();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);

      const value = baseValue + z * volatility;
      results.push(value);

      if (value >= successThreshold) {
        successCount++;
      }
    }

    // Calcular estatísticas
    results.sort((a, b) => a - b);
    const mean = results.reduce((sum, v) => sum + v, 0) / results.length;
    const median = results[Math.floor(results.length / 2)];

    const variance = results.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);

    const p5Index = Math.floor(results.length * 0.05);
    const p95Index = Math.floor(results.length * 0.95);

    const result: MonteCarloResult = {
      iterations: this.config.monteCarloIterations,
      mean: Number(mean.toFixed(4)),
      median: Number(median.toFixed(4)),
      stdDev: Number(stdDev.toFixed(4)),
      percentile5: Number(results[p5Index].toFixed(4)),
      percentile95: Number(results[p95Index].toFixed(4)),
      successProbability: successCount / this.config.monteCarloIterations,
      distribution: results.slice(0, 100) // Amostra da distribuição
    };

    console.log(`[AE2:M6] Monte Carlo complete: mean=${result.mean}, P(success)=${(result.successProbability * 100).toFixed(1)}%`);
    return result;
  }

  // ========== Análise de Sensibilidade ==========

  /**
   * Executa análise de sensibilidade
   */
  runSensitivityAnalysis(
    parameters: Record<string, number>,
    perturbation: number = 0.1
  ): SensitivityResult[] {
    if (!this.config.enableSensitivityAnalysis) {
      return [];
    }

    console.log('[AE2:M6] Running sensitivity analysis...');
    this.lastActivity = Date.now();

    const results: SensitivityResult[] = [];

    for (const [param, baseValue] of Object.entries(parameters)) {
      // Calcular output com valor base
      const baseOutput = this.calculateOutputValue(parameters);

      // Perturbar para cima
      const upperParams = { ...parameters, [param]: baseValue * (1 + perturbation) };
      const upperOutput = this.calculateOutputValue(upperParams);

      // Perturbar para baixo
      const lowerParams = { ...parameters, [param]: baseValue * (1 - perturbation) };
      const lowerOutput = this.calculateOutputValue(lowerParams);

      // Calcular sensibilidade
      const sensitivity = (upperOutput - lowerOutput) / (2 * perturbation * baseValue);
      const normalizedSensitivity = Math.abs(sensitivity);

      // Determinar impacto
      let impact: SensitivityResult['impact'];
      if (normalizedSensitivity > 0.5) {
        impact = 'high';
      } else if (normalizedSensitivity > 0.2) {
        impact = 'medium';
      } else {
        impact = 'low';
      }

      // Gerar recomendação
      const recommendation = this.generateSensitivityRecommendation(param, impact, sensitivity > 0);

      results.push({
        parameter: param,
        baseValue,
        sensitivity: Number(normalizedSensitivity.toFixed(4)),
        impact,
        recommendation
      });
    }

    // Ordenar por sensibilidade
    results.sort((a, b) => b.sensitivity - a.sensitivity);

    return results;
  }

  private calculateOutputValue(params: Record<string, number>): number {
    // Função de avaliação simplificada
    let value = 0.5;
    for (const [key, val] of Object.entries(params)) {
      if (key.includes('success') || key.includes('availability')) {
        value += val * 0.2;
      } else if (key.includes('error') || key.includes('risk')) {
        value -= val * 0.15;
      } else {
        value += (val - 0.5) * 0.1;
      }
    }
    return value;
  }

  private generateSensitivityRecommendation(
    param: string,
    impact: string,
    isPositive: boolean
  ): string {
    if (impact === 'high') {
      return isPositive
        ? `Increase ${param} for significant improvement`
        : `Decrease ${param} to reduce negative impact`;
    } else if (impact === 'medium') {
      return `Monitor ${param} - moderate sensitivity detected`;
    }
    return `${param} has low sensitivity - less critical for optimization`;
  }

  // ========== Recomendações de Otimização ==========

  /**
   * Gera recomendações de otimização
   */
  generateOptimizationRecommendations(
    prediction: PredictionResult,
    monteCarlo?: MonteCarloResult
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];

    // Analisar fatores de predição
    for (const factor of prediction.factors) {
      if (factor.impact < -0.1) {
        recommendations.push(this.factorToRecommendation(factor));
      }
    }

    // Adicionar recomendações de Monte Carlo se disponível
    if (monteCarlo) {
      if (monteCarlo.successProbability < 0.7) {
        recommendations.push({
          type: 'risk_mitigation',
          priority: 'high',
          description: 'Success probability below acceptable threshold - consider risk mitigation',
          expectedImprovement: 0.15,
          tradeoffs: ['May increase execution time', 'Additional resource overhead']
        });
      }

      if (monteCarlo.stdDev > 0.2) {
        recommendations.push({
          type: 'approach',
          priority: 'medium',
          description: 'High variability detected - consider more conservative approach',
          expectedImprovement: 0.1,
          tradeoffs: ['Reduced potential upside', 'More predictable outcomes']
        });
      }
    }

    // Recomendações baseadas em risco
    if (prediction.riskScore > 0.5) {
      recommendations.push({
        type: 'risk_mitigation',
        priority: 'high',
        description: 'Implement additional checkpoints and fallback strategies',
        expectedImprovement: 0.2,
        tradeoffs: ['Additional complexity', 'Slightly longer execution']
      });
    }

    // Ordenar por prioridade
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return recommendations;
  }

  private factorToRecommendation(factor: PredictionFactor): OptimizationRecommendation {
    const typeMap: Record<string, OptimizationRecommendation['type']> = {
      plan_complexity: 'approach',
      agent_availability: 'resource',
      parallelism: 'timing',
      timeout_margin: 'timing',
      rollback_safety: 'risk_mitigation',
      constraint_load: 'approach'
    };

    const recommendations: Record<string, string> = {
      plan_complexity: 'Consider breaking down plan into smaller, manageable phases',
      agent_availability: 'Ensure adequate agent pool before execution',
      parallelism: 'Optimize task dependencies to increase parallelism',
      timeout_margin: 'Increase timeout budget for safety margin',
      rollback_safety: 'Enable rollback capabilities for critical steps',
      constraint_load: 'Review constraints for potential simplification'
    };

    return {
      type: typeMap[factor.name] || 'approach',
      priority: Math.abs(factor.impact) > 0.2 ? 'high' : 'medium',
      description: recommendations[factor.name] || `Address ${factor.name} issue`,
      expectedImprovement: Math.abs(factor.impact),
      tradeoffs: this.getTradeoffs(factor.name)
    };
  }

  private getTradeoffs(factorName: string): string[] {
    const tradeoffMap: Record<string, string[]> = {
      plan_complexity: ['May require more coordination', 'Potential data consistency issues'],
      agent_availability: ['Resource cost increase', 'Potential underutilization'],
      parallelism: ['Increased complexity', 'Higher resource peaks'],
      timeout_margin: ['Longer total execution time', 'Resource reservation'],
      rollback_safety: ['Storage overhead', 'Complexity increase'],
      constraint_load: ['May reduce safety', 'Potential compliance issues']
    };

    return tradeoffMap[factorName] || ['Requires further analysis'];
  }

  // ========== Métodos Auxiliares ==========

  private extractObjectives(strategic: unknown): string[] {
    if (typeof strategic === 'object' && strategic !== null) {
      if ('objectives' in strategic && Array.isArray((strategic as any).objectives)) {
        return (strategic as any).objectives;
      }
    }
    return [];
  }

  private extractSignals(environmental: unknown): string[] {
    if (typeof environmental === 'object' && environmental !== null) {
      if ('signals' in environmental && Array.isArray((environmental as any).signals)) {
        return (environmental as any).signals;
      }
      if ('environment' in environmental) {
        const env = (environmental as any).environment;
        if (env && 'signals' in env && Array.isArray(env.signals)) {
          return env.signals;
        }
      }
    }
    return [];
  }

  private extractPatterns(cognitive: unknown): string[] {
    if (typeof cognitive === 'object' && cognitive !== null) {
      if ('recentPatterns' in cognitive && Array.isArray((cognitive as any).recentPatterns)) {
        return (cognitive as any).recentPatterns;
      }
    }
    return [];
  }

  private selectBestScenario(outcomes: ScenarioOutcome[]): ScenarioOutcome {
    // Selecionar cenário com melhor balanço de probabilidade e risco
    return outcomes.reduce((best, current) => {
      const currentScore = current.probability * (current.riskLevel === 'low' ? 1.2 : current.riskLevel === 'medium' ? 1.0 : 0.8);
      const bestScore = best.probability * (best.riskLevel === 'low' ? 1.2 : best.riskLevel === 'medium' ? 1.0 : 0.8);
      return currentScore > bestScore ? current : best;
    });
  }

  private calculateOverallConfidence(outcomes: ScenarioOutcome[]): number {
    // Média ponderada das probabilidades
    const totalProbability = outcomes.reduce((sum, o) => sum + o.probability, 0);
    return Math.min(1, totalProbability / outcomes.length);
  }
}

// ========== Funções Exportadas (Compatibilidade) ==========

export function simulateScenarios(objectives: string[]): { name: string; impact: number }[] {
  if (!objectives.length) {
    return [{ name: 'baseline', impact: 0 }];
  }

  return objectives.map((objective, index) => ({
    name: `scenario_${index + 1}_${objective.replace(/\s+/g, '_')}`,
    impact: Number((0.2 + index * 0.1).toFixed(2))
  }));
}

export function predictOutcomes(scenarios: { name: string; impact: number }[]): Record<string, number> {
  const predictions: Record<string, number> = {};

  for (const scenario of scenarios) {
    predictions[scenario.name] = Number((scenario.impact * 100).toFixed(1));
  }

  return predictions;
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE2:M6] Testando Predictive Optimization...\n');

  async function runTests() {
    const optimizer = new PredictiveOptimization();
    await optimizer.initialize();

    // Teste 1: Simular cenários
    console.log('=== Teste 1: Simular Cenários ===');
    const strategic = {
      objectives: ['Analisar dados', 'Gerar relatório', 'Enviar notificação'],
      goalAlignment: 0.8,
      feasibility: 0.7
    };
    const environmental = {
      signals: ['load_spike', 'memory_pressure'],
      environment: { signals: [] }
    };
    const cognitive = {
      recentPatterns: ['high_load']
    };

    const simulation = await optimizer.simulate(strategic, environmental, cognitive);
    console.log('Cenários simulados:', simulation.scenarios.length);
    console.log('Recomendado:', simulation.recommended);
    console.log('Confiança:', (simulation.confidence * 100).toFixed(1) + '%');

    // Teste 2: Predição de plano
    console.log('\n=== Teste 2: Predição de Plano ===');
    const testPlan: OrchestrationPlan = {
      id: 'plan_test',
      decisionId: 'decision_1',
      steps: [
        { id: 's1', type: 'validation', target: 'input', timeout: 2000, retries: 1, onFailure: 'abort' },
        { id: 's2', type: 'tool_call', target: 'processor', timeout: 5000, retries: 2, onFailure: 'retry' },
        { id: 's3', type: 'tool_call', target: 'output', timeout: 3000, retries: 1, onFailure: 'skip' }
      ],
      dependencies: [],
      agents: [{ id: 'a1' }, { id: 'a2' }],
      timeoutBudget: 15000,
      rollbackPolicy: { enabled: true, strategy: 'partial', checkpoints: ['s2'] },
      priority: 'high',
      createdAt: Date.now(),
      constraints: [],
      expectedMetrics: { estimatedDuration: 10000, parallelism: 2, criticalPath: ['s1', 's2', 's3'] }
    };

    const prediction = await optimizer.predictOutcome(testPlan);
    console.log('Predição:', prediction.outcome);
    console.log('Confiança:', (prediction.confidence * 100).toFixed(1) + '%');
    console.log('Duração esperada:', prediction.expectedDuration + 'ms');
    console.log('Risco:', (prediction.riskScore * 100).toFixed(1) + '%');

    // Teste 3: Monte Carlo
    console.log('\n=== Teste 3: Monte Carlo ===');
    const monteCarlo = optimizer.runMonteCarlo(0.7, 0.15, 0.6);
    console.log('Média:', monteCarlo.mean);
    console.log('Desvio padrão:', monteCarlo.stdDev);
    console.log('P(sucesso):', (monteCarlo.successProbability * 100).toFixed(1) + '%');
    console.log('Intervalo 90%:', `[${monteCarlo.percentile5}, ${monteCarlo.percentile95}]`);

    // Teste 4: Análise de Sensibilidade
    console.log('\n=== Teste 4: Análise de Sensibilidade ===');
    const sensitivity = optimizer.runSensitivityAnalysis({
      successRate: 0.75,
      resourceUsage: 0.6,
      errorProbability: 0.1,
      parallelism: 0.8
    });
    console.log('Parâmetros mais sensíveis:');
    for (const result of sensitivity.slice(0, 3)) {
      console.log(`  ${result.parameter}: ${result.sensitivity.toFixed(3)} (${result.impact})`);
    }

    // Teste 5: Recomendações
    console.log('\n=== Teste 5: Recomendações ===');
    const recommendations = optimizer.generateOptimizationRecommendations(prediction, monteCarlo);
    console.log('Recomendações:');
    for (const rec of recommendations.slice(0, 3)) {
      console.log(`  [${rec.priority}] ${rec.type}: ${rec.description}`);
    }

    console.log('\n[AE2:M6] Status:', optimizer.getStatus());
    console.log('\n[AE2:M6] ✓ Predictive Optimization testado com sucesso');
  }

  runTests().catch(console.error);
}
