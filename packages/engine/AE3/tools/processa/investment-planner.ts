import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

/**
 * Perfil de risco do investidor
 */
type RiskProfile = "conservative" | "moderate_conservative" | "moderate" | "moderate_aggressive" | "aggressive";

/**
 * Classe de ativo
 */
type AssetClass =
  | "domestic_equities"
  | "international_equities"
  | "emerging_markets"
  | "government_bonds"
  | "corporate_bonds"
  | "high_yield_bonds"
  | "real_estate"
  | "commodities"
  | "gold"
  | "alternatives"
  | "crypto"
  | "cash";

/**
 * Horizonte de investimento
 */
type InvestmentHorizon = "short" | "medium" | "long" | "very_long";

/**
 * Objetivo de investimento
 */
type InvestmentGoal = "preservation" | "income" | "balanced" | "growth" | "aggressive_growth";

/**
 * Alocação de ativo
 */
type AssetAllocation = {
  assetClass: AssetClass;
  name: string;
  weight: number;
  expectedReturn: number;
  volatility: number;
  category: "equity" | "fixed_income" | "alternative" | "cash";
};

/**
 * Configuração do planejamento
 */
type PlannerConfig = {
  initialInvestment: number;
  monthlyContribution?: number;
  riskProfile?: RiskProfile;
  investmentHorizon?: InvestmentHorizon;
  goal?: InvestmentGoal;
  age?: number;
  retirementAge?: number;
  targetAmount?: number;
  excludeAssets?: AssetClass[];
  maxSingleAsset?: number;
  includeESG?: boolean;
  includeCrypto?: boolean;
  rebalanceFrequency?: "monthly" | "quarterly" | "annually";
};

/**
 * Resultado do planejamento
 */
type PlannerResult = {
  portfolio: {
    allocations: AssetAllocation[];
    totalWeight: number;
    expectedAnnualReturn: number;
    expectedVolatility: number;
    sharpeRatio: number;
    maxDrawdown: number;
  };
  projections: {
    years: number[];
    expectedValues: number[];
    optimisticValues: number[];
    pessimisticValues: number[];
  };
  analysis: {
    riskProfile: RiskProfile;
    investmentHorizon: InvestmentHorizon;
    goal: InvestmentGoal;
    equityRatio: number;
    fixedIncomeRatio: number;
    alternativeRatio: number;
    cashRatio: number;
    diversificationScore: number;
  };
  recommendations: string[];
  rebalancing: {
    frequency: string;
    nextDate: Date;
    thresholdPercent: number;
  };
  warnings: string[];
};

/**
 * Dados de ativos com retornos e volatilidades históricas simuladas
 */
const ASSET_DATA: Record<AssetClass, { name: string; expectedReturn: number; volatility: number; category: "equity" | "fixed_income" | "alternative" | "cash" }> = {
  domestic_equities: { name: "Ações Domésticas", expectedReturn: 0.10, volatility: 0.18, category: "equity" },
  international_equities: { name: "Ações Internacionais", expectedReturn: 0.09, volatility: 0.16, category: "equity" },
  emerging_markets: { name: "Mercados Emergentes", expectedReturn: 0.12, volatility: 0.25, category: "equity" },
  government_bonds: { name: "Títulos Públicos", expectedReturn: 0.04, volatility: 0.05, category: "fixed_income" },
  corporate_bonds: { name: "Debêntures", expectedReturn: 0.06, volatility: 0.08, category: "fixed_income" },
  high_yield_bonds: { name: "High Yield", expectedReturn: 0.08, volatility: 0.12, category: "fixed_income" },
  real_estate: { name: "Fundos Imobiliários", expectedReturn: 0.08, volatility: 0.14, category: "alternative" },
  commodities: { name: "Commodities", expectedReturn: 0.05, volatility: 0.20, category: "alternative" },
  gold: { name: "Ouro", expectedReturn: 0.04, volatility: 0.15, category: "alternative" },
  alternatives: { name: "Alternativos", expectedReturn: 0.09, volatility: 0.12, category: "alternative" },
  crypto: { name: "Criptomoedas", expectedReturn: 0.20, volatility: 0.80, category: "alternative" },
  cash: { name: "Caixa/CDI", expectedReturn: 0.03, volatility: 0.01, category: "cash" },
};

/**
 * Alocações modelo por perfil de risco
 */
const MODEL_PORTFOLIOS: Record<RiskProfile, Partial<Record<AssetClass, number>>> = {
  conservative: {
    government_bonds: 0.40,
    corporate_bonds: 0.20,
    domestic_equities: 0.10,
    international_equities: 0.05,
    real_estate: 0.10,
    gold: 0.05,
    cash: 0.10,
  },
  moderate_conservative: {
    government_bonds: 0.30,
    corporate_bonds: 0.15,
    domestic_equities: 0.20,
    international_equities: 0.10,
    real_estate: 0.10,
    gold: 0.05,
    cash: 0.10,
  },
  moderate: {
    domestic_equities: 0.30,
    international_equities: 0.15,
    emerging_markets: 0.05,
    government_bonds: 0.20,
    corporate_bonds: 0.10,
    real_estate: 0.10,
    gold: 0.05,
    cash: 0.05,
  },
  moderate_aggressive: {
    domestic_equities: 0.35,
    international_equities: 0.20,
    emerging_markets: 0.10,
    government_bonds: 0.10,
    corporate_bonds: 0.05,
    real_estate: 0.10,
    alternatives: 0.05,
    cash: 0.05,
  },
  aggressive: {
    domestic_equities: 0.40,
    international_equities: 0.25,
    emerging_markets: 0.15,
    high_yield_bonds: 0.05,
    real_estate: 0.05,
    alternatives: 0.05,
    crypto: 0.03,
    cash: 0.02,
  },
};

/**
 * Horizonte em anos
 */
const HORIZON_YEARS: Record<InvestmentHorizon, number> = {
  short: 3,
  medium: 7,
  long: 15,
  very_long: 30,
};

/**
 * Risk-free rate para cálculo do Sharpe Ratio
 */
const RISK_FREE_RATE = 0.03;

export class InvestmentPlanner implements Tool {
  id = "T16";
  name = "InvestmentPlanner";
  phase = "processa" as const;
  version = "1.0.0";

  private metrics = {
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    totalDuration: 0,
    totalInvestmentPlanned: 0,
    byRiskProfile: {
      conservative: 0,
      moderate_conservative: 0,
      moderate: 0,
      moderate_aggressive: 0,
      aggressive: 0,
    },
    byHorizon: { short: 0, medium: 0, long: 0, very_long: 0 },
  };

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.metrics.executionCount++;

    try {
      const config = this.parseConfig(input);
      const result = this.createInvestmentPlan(config);

      this.metrics.successCount++;
      this.metrics.totalDuration += Date.now() - startTime;
      this.metrics.totalInvestmentPlanned += config.initialInvestment;
      this.metrics.byRiskProfile[result.analysis.riskProfile]++;
      this.metrics.byHorizon[result.analysis.investmentHorizon]++;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: result,
        duration_ms: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      this.metrics.failureCount++;
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        error: message,
        duration_ms: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Parseia e valida a configuração
   */
  private parseConfig(input: ToolInput): PlannerConfig {
    const initialInvestment = Number(input.initialInvestment || input.initial_investment || input.amount || 0);

    if (initialInvestment <= 0) {
      throw new Error("Initial investment must be greater than zero");
    }

    const riskProfile = this.normalizeRiskProfile(input.riskProfile || input.risk_profile || input.risk);
    const horizon = this.normalizeHorizon(input.investmentHorizon || input.horizon);
    const goal = this.normalizeGoal(input.goal);

    return {
      initialInvestment,
      monthlyContribution: Number(input.monthlyContribution || input.monthly || 0),
      riskProfile,
      investmentHorizon: horizon,
      goal,
      age: input.age ? Number(input.age) : undefined,
      retirementAge: input.retirementAge ? Number(input.retirementAge) : undefined,
      targetAmount: input.targetAmount ? Number(input.targetAmount) : undefined,
      excludeAssets: input.excludeAssets as AssetClass[] | undefined,
      maxSingleAsset: input.maxSingleAsset ? Number(input.maxSingleAsset) : 0.40,
      includeESG: Boolean(input.includeESG),
      includeCrypto: input.includeCrypto !== false && riskProfile === "aggressive",
      rebalanceFrequency: (input.rebalanceFrequency as "monthly" | "quarterly" | "annually") || "quarterly",
    };
  }

  /**
   * Normaliza perfil de risco
   */
  private normalizeRiskProfile(input: unknown): RiskProfile {
    if (!input) return "moderate";

    const str = String(input).toLowerCase().replace(/[_\s-]/g, "");

    if (str.includes("conserv") && !str.includes("moderate")) return "conservative";
    if (str.includes("moderateconserv") || str.includes("conservmod")) return "moderate_conservative";
    if (str.includes("moderateagg") || str.includes("aggmod")) return "moderate_aggressive";
    if (str.includes("aggress") || str === "high") return "aggressive";
    if (str === "low") return "conservative";

    return "moderate";
  }

  /**
   * Normaliza horizonte de investimento
   */
  private normalizeHorizon(input: unknown): InvestmentHorizon {
    if (!input) return "medium";

    const str = String(input).toLowerCase();

    if (str.includes("short") || str === "1" || str === "2" || str === "3") return "short";
    if (str.includes("very") || str.includes("30") || str === "retirement") return "very_long";
    if (str.includes("long") || Number(str) >= 10) return "long";

    return "medium";
  }

  /**
   * Normaliza objetivo
   */
  private normalizeGoal(input: unknown): InvestmentGoal {
    if (!input) return "balanced";

    const str = String(input).toLowerCase();

    if (str.includes("preserv") || str.includes("safe")) return "preservation";
    if (str.includes("income") || str.includes("dividend")) return "income";
    if (str.includes("aggress")) return "aggressive_growth";
    if (str.includes("growth")) return "growth";

    return "balanced";
  }

  /**
   * Cria o plano de investimento
   */
  private createInvestmentPlan(config: PlannerConfig): PlannerResult {
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Ajustar perfil baseado em idade se fornecida
    let effectiveRiskProfile = config.riskProfile || "moderate";
    if (config.age) {
      const suggestedProfile = this.suggestRiskProfileByAge(config.age);
      if (suggestedProfile !== effectiveRiskProfile) {
        recommendations.push(`Baseado na sua idade (${config.age}), considere o perfil "${suggestedProfile}"`);
      }
    }

    // Obter alocações base
    const baseAllocations = MODEL_PORTFOLIOS[effectiveRiskProfile];
    const allocations: AssetAllocation[] = [];

    // Construir portfólio
    for (const [assetClass, weight] of Object.entries(baseAllocations)) {
      const asset = assetClass as AssetClass;

      // Verificar exclusões
      if (config.excludeAssets?.includes(asset)) {
        continue;
      }

      // Verificar crypto
      if (asset === "crypto" && !config.includeCrypto) {
        continue;
      }

      const assetData = ASSET_DATA[asset];
      allocations.push({
        assetClass: asset,
        name: assetData.name,
        weight: weight as number,
        expectedReturn: assetData.expectedReturn,
        volatility: assetData.volatility,
        category: assetData.category,
      });
    }

    // Normalizar pesos para somar 100%
    const totalWeight = allocations.reduce((sum, a) => sum + a.weight, 0);
    if (Math.abs(totalWeight - 1) > 0.001) {
      for (const alloc of allocations) {
        alloc.weight = alloc.weight / totalWeight;
      }
    }

    // Verificar limite máximo por ativo
    for (const alloc of allocations) {
      if (alloc.weight > (config.maxSingleAsset || 0.40)) {
        warnings.push(`${alloc.name} excede ${(config.maxSingleAsset || 0.40) * 100}% da carteira`);
      }
    }

    // Calcular métricas do portfólio
    const expectedAnnualReturn = allocations.reduce((sum, a) => sum + a.weight * a.expectedReturn, 0);
    const expectedVolatility = this.calculatePortfolioVolatility(allocations);
    const sharpeRatio = (expectedAnnualReturn - RISK_FREE_RATE) / expectedVolatility;
    const maxDrawdown = this.estimateMaxDrawdown(expectedVolatility);

    // Calcular ratios por categoria
    const equityRatio = allocations.filter((a) => a.category === "equity").reduce((sum, a) => sum + a.weight, 0);
    const fixedIncomeRatio = allocations.filter((a) => a.category === "fixed_income").reduce((sum, a) => sum + a.weight, 0);
    const alternativeRatio = allocations.filter((a) => a.category === "alternative").reduce((sum, a) => sum + a.weight, 0);
    const cashRatio = allocations.filter((a) => a.category === "cash").reduce((sum, a) => sum + a.weight, 0);

    // Score de diversificação (0-100)
    const diversificationScore = this.calculateDiversificationScore(allocations);

    // Gerar projeções
    const horizon = config.investmentHorizon || "medium";
    const years = HORIZON_YEARS[horizon];
    const projections = this.generateProjections(
      config.initialInvestment,
      config.monthlyContribution || 0,
      expectedAnnualReturn,
      expectedVolatility,
      years
    );

    // Gerar recomendações
    if (diversificationScore < 60) {
      recommendations.push("Considere diversificar mais sua carteira para reduzir riscos");
    }
    if (equityRatio > 0.7) {
      recommendations.push("Alta exposição a renda variável - adequado apenas para longo prazo");
    }
    if (cashRatio > 0.15) {
      recommendations.push("Alto percentual em caixa pode reduzir retornos no longo prazo");
    }
    if (config.monthlyContribution && config.monthlyContribution > 0) {
      recommendations.push("Aportes mensais regulares ajudam a reduzir o risco de timing");
    }
    if (config.targetAmount) {
      const yearsToGoal = this.estimateYearsToGoal(
        config.initialInvestment,
        config.monthlyContribution || 0,
        expectedAnnualReturn,
        config.targetAmount
      );
      recommendations.push(`Estimativa para atingir R$ ${config.targetAmount.toLocaleString()}: ${yearsToGoal.toFixed(1)} anos`);
    }

    // Calcular próxima data de rebalanceamento
    const nextRebalance = this.calculateNextRebalanceDate(config.rebalanceFrequency || "quarterly");

    return {
      portfolio: {
        allocations: allocations.sort((a, b) => b.weight - a.weight),
        totalWeight: 1,
        expectedAnnualReturn,
        expectedVolatility,
        sharpeRatio,
        maxDrawdown,
      },
      projections,
      analysis: {
        riskProfile: effectiveRiskProfile,
        investmentHorizon: horizon,
        goal: config.goal || "balanced",
        equityRatio,
        fixedIncomeRatio,
        alternativeRatio,
        cashRatio,
        diversificationScore,
      },
      recommendations,
      rebalancing: {
        frequency: config.rebalanceFrequency || "quarterly",
        nextDate: nextRebalance,
        thresholdPercent: 5,
      },
      warnings,
    };
  }

  /**
   * Sugere perfil de risco baseado na idade
   */
  private suggestRiskProfileByAge(age: number): RiskProfile {
    if (age < 30) return "aggressive";
    if (age < 40) return "moderate_aggressive";
    if (age < 50) return "moderate";
    if (age < 60) return "moderate_conservative";
    return "conservative";
  }

  /**
   * Calcula volatilidade do portfólio (simplificado)
   */
  private calculatePortfolioVolatility(allocations: AssetAllocation[]): number {
    // Simplificação: média ponderada com fator de correlação
    const correlationFactor = 0.7; // Assume correlação média entre ativos
    const weightedVolSum = allocations.reduce((sum, a) => sum + a.weight * a.volatility, 0);
    const weightedVolSqSum = allocations.reduce((sum, a) => sum + a.weight * a.weight * a.volatility * a.volatility, 0);

    // Diversification benefit
    const diversificationBenefit = Math.sqrt(weightedVolSqSum + correlationFactor * (weightedVolSum * weightedVolSum - weightedVolSqSum));

    return diversificationBenefit;
  }

  /**
   * Estima drawdown máximo baseado na volatilidade
   */
  private estimateMaxDrawdown(volatility: number): number {
    // Regra empírica: max drawdown ~ 2-3x volatilidade anual
    return Math.min(volatility * 2.5, 0.60);
  }

  /**
   * Calcula score de diversificação
   */
  private calculateDiversificationScore(allocations: AssetAllocation[]): number {
    // Baseado no número de ativos e distribuição de pesos
    const n = allocations.length;
    if (n === 0) return 0;

    // Herfindahl-Hirschman Index invertido
    const hhi = allocations.reduce((sum, a) => sum + a.weight * a.weight, 0);
    const normalizedHHI = (1 - hhi) / (1 - 1 / n);

    // Bonus por ter ativos de diferentes categorias
    const categories = new Set(allocations.map((a) => a.category));
    const categoryBonus = (categories.size / 4) * 20;

    return Math.min(100, normalizedHHI * 80 + categoryBonus);
  }

  /**
   * Gera projeções de crescimento
   */
  private generateProjections(
    initial: number,
    monthly: number,
    annualReturn: number,
    volatility: number,
    years: number
  ): PlannerResult["projections"] {
    const yearsList: number[] = [];
    const expectedValues: number[] = [];
    const optimisticValues: number[] = [];
    const pessimisticValues: number[] = [];

    const monthlyReturn = annualReturn / 12;
    const optimisticReturn = (annualReturn + volatility) / 12;
    const pessimisticReturn = Math.max(0, annualReturn - volatility) / 12;

    for (let y = 0; y <= years; y++) {
      yearsList.push(y);

      const months = y * 12;

      // Fórmula de valor futuro com aportes
      const fvExpected = this.futureValue(initial, monthly, monthlyReturn, months);
      const fvOptimistic = this.futureValue(initial, monthly, optimisticReturn, months);
      const fvPessimistic = this.futureValue(initial, monthly, pessimisticReturn, months);

      expectedValues.push(Math.round(fvExpected));
      optimisticValues.push(Math.round(fvOptimistic));
      pessimisticValues.push(Math.round(fvPessimistic));
    }

    return { years: yearsList, expectedValues, optimisticValues, pessimisticValues };
  }

  /**
   * Calcula valor futuro com aportes mensais
   */
  private futureValue(initial: number, monthly: number, monthlyRate: number, months: number): number {
    if (monthlyRate === 0) {
      return initial + monthly * months;
    }

    const fvInitial = initial * Math.pow(1 + monthlyRate, months);
    const fvAnnuity = monthly * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

    return fvInitial + fvAnnuity;
  }

  /**
   * Estima anos para atingir objetivo
   */
  private estimateYearsToGoal(initial: number, monthly: number, annualReturn: number, target: number): number {
    if (initial >= target) return 0;

    const monthlyRate = annualReturn / 12;
    let current = initial;
    let months = 0;

    while (current < target && months < 600) {
      current = current * (1 + monthlyRate) + monthly;
      months++;
    }

    return months / 12;
  }

  /**
   * Calcula próxima data de rebalanceamento
   */
  private calculateNextRebalanceDate(frequency: "monthly" | "quarterly" | "annually"): Date {
    const now = new Date();
    const next = new Date(now);

    switch (frequency) {
      case "monthly":
        next.setMonth(next.getMonth() + 1);
        next.setDate(1);
        break;
      case "quarterly":
        const currentQuarter = Math.floor(now.getMonth() / 3);
        next.setMonth((currentQuarter + 1) * 3);
        next.setDate(1);
        break;
      case "annually":
        next.setFullYear(next.getFullYear() + 1);
        next.setMonth(0);
        next.setDate(1);
        break;
    }

    return next;
  }

  // ========== Health Check & Metrics ==========

  async healthCheck(): Promise<ToolHealth> {
    try {
      const testResult = await this.execute({
        initialInvestment: 10000,
        riskProfile: "moderate",
      });

      const avgLatency =
        this.metrics.successCount > 0 ? this.metrics.totalDuration / this.metrics.successCount : 0;

      const successRate =
        this.metrics.executionCount > 0 ? this.metrics.successCount / this.metrics.executionCount : 1;

      return {
        tool_name: this.name,
        status: testResult.success ? "healthy" : "down",
        last_check: new Date(),
        avg_latency_ms: avgLatency,
        success_rate: successRate,
      };
    } catch {
      return {
        tool_name: this.name,
        status: "down",
        last_check: new Date(),
        avg_latency_ms: 0,
        success_rate: 0,
      };
    }
  }

  getMetrics() {
    return {
      executionCount: this.metrics.executionCount,
      successCount: this.metrics.successCount,
      failureCount: this.metrics.failureCount,
      totalInvestmentPlanned: this.metrics.totalInvestmentPlanned,
      averageDuration:
        this.metrics.successCount > 0 ? this.metrics.totalDuration / this.metrics.successCount : 0,
      successRate:
        this.metrics.executionCount > 0 ? this.metrics.successCount / this.metrics.executionCount : 0,
      byRiskProfile: { ...this.metrics.byRiskProfile },
      byHorizon: { ...this.metrics.byHorizon },
    };
  }

  resetMetrics(): void {
    this.metrics = {
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      totalInvestmentPlanned: 0,
      byRiskProfile: {
        conservative: 0,
        moderate_conservative: 0,
        moderate: 0,
        moderate_aggressive: 0,
        aggressive: 0,
      },
      byHorizon: { short: 0, medium: 0, long: 0, very_long: 0 },
    };
  }

  /**
   * Lista perfis de risco disponíveis
   */
  getRiskProfiles(): RiskProfile[] {
    return ["conservative", "moderate_conservative", "moderate", "moderate_aggressive", "aggressive"];
  }

  /**
   * Lista classes de ativos disponíveis
   */
  getAssetClasses(): Array<{ code: AssetClass; name: string; category: string }> {
    return Object.entries(ASSET_DATA).map(([code, data]) => ({
      code: code as AssetClass,
      name: data.name,
      category: data.category,
    }));
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE3:InvestmentPlanner] Testing Investment Planner Tool...\n");

  async function runTests() {
    const tool = new InvestmentPlanner();
    let passed = 0;
    let failed = 0;

    // Teste 1: Plano básico moderado
    console.log("=== Teste 1: Plano Básico Moderado ===");
    try {
      const result1 = await tool.execute({
        initialInvestment: 100000,
        riskProfile: "moderate",
      });

      if (result1.success && result1.output) {
        const out = result1.output as PlannerResult;
        console.log("✓ Plano criado");
        console.log(`  Perfil: ${out.analysis.riskProfile}`);
        console.log(`  Retorno esperado: ${(out.portfolio.expectedAnnualReturn * 100).toFixed(2)}%`);
        console.log(`  Volatilidade: ${(out.portfolio.expectedVolatility * 100).toFixed(2)}%`);
        console.log(`  Sharpe Ratio: ${out.portfolio.sharpeRatio.toFixed(2)}`);
        console.log(`  Alocações: ${out.portfolio.allocations.length} ativos`);
        passed++;
      } else {
        console.log("✗ Falha:", result1.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 2: Plano agressivo com aportes
    console.log("\n=== Teste 2: Plano Agressivo com Aportes ===");
    try {
      const result2 = await tool.execute({
        initialInvestment: 50000,
        monthlyContribution: 2000,
        riskProfile: "aggressive",
        investmentHorizon: "long",
        includeCrypto: true,
      });

      if (result2.success && result2.output) {
        const out = result2.output as PlannerResult;
        console.log("✓ Plano agressivo criado");
        console.log(`  Equity Ratio: ${(out.analysis.equityRatio * 100).toFixed(1)}%`);
        console.log(`  Diversification Score: ${out.analysis.diversificationScore.toFixed(1)}`);
        console.log(`  Projeção 15 anos: R$ ${out.projections.expectedValues[15]?.toLocaleString()}`);
        passed++;
      } else {
        console.log("✗ Falha:", result2.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 3: Plano conservador para aposentadoria
    console.log("\n=== Teste 3: Plano Conservador com Idade ===");
    try {
      const result3 = await tool.execute({
        initialInvestment: 500000,
        riskProfile: "conservative",
        age: 55,
        retirementAge: 65,
        investmentHorizon: "medium",
      });

      if (result3.success && result3.output) {
        const out = result3.output as PlannerResult;
        console.log("✓ Plano conservador criado");
        console.log(`  Fixed Income Ratio: ${(out.analysis.fixedIncomeRatio * 100).toFixed(1)}%`);
        console.log(`  Cash Ratio: ${(out.analysis.cashRatio * 100).toFixed(1)}%`);
        console.log(`  Max Drawdown estimado: ${(out.portfolio.maxDrawdown * 100).toFixed(1)}%`);
        console.log(`  Recomendações: ${out.recommendations.length}`);
        passed++;
      } else {
        console.log("✗ Falha:", result3.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 4: Plano com objetivo financeiro
    console.log("\n=== Teste 4: Plano com Objetivo ===");
    try {
      const result4 = await tool.execute({
        initialInvestment: 30000,
        monthlyContribution: 1500,
        riskProfile: "moderate_aggressive",
        targetAmount: 500000,
        goal: "growth",
      });

      if (result4.success && result4.output) {
        const out = result4.output as PlannerResult;
        console.log("✓ Plano com objetivo criado");
        console.log(`  Goal: ${out.analysis.goal}`);
        const targetRec = out.recommendations.find((r) => r.includes("Estimativa"));
        if (targetRec) console.log(`  ${targetRec}`);
        passed++;
      } else {
        console.log("✗ Falha:", result4.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 5: Detalhes de alocação
    console.log("\n=== Teste 5: Detalhes de Alocação ===");
    try {
      const result5 = await tool.execute({
        initialInvestment: 100000,
        riskProfile: "moderate",
      });

      if (result5.success && result5.output) {
        const out = result5.output as PlannerResult;
        console.log("✓ Alocações detalhadas:");
        for (const alloc of out.portfolio.allocations.slice(0, 5)) {
          console.log(`  ${alloc.name}: ${(alloc.weight * 100).toFixed(1)}% (ret: ${(alloc.expectedReturn * 100).toFixed(1)}%)`);
        }
        passed++;
      } else {
        console.log("✗ Falha:", result5.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 6: Validação de erros
    console.log("\n=== Teste 6: Validação - Investimento Zero ===");
    try {
      const result6 = await tool.execute({
        initialInvestment: 0,
      });

      if (!result6.success) {
        console.log("✓ Erro capturado:", result6.error);
        passed++;
      } else {
        console.log("✗ Deveria ter falhado");
        failed++;
      }
    } catch (e) {
      console.log("✓ Exceção capturada");
      passed++;
    }

    // Teste 7: Health Check
    console.log("\n=== Teste 7: Health Check ===");
    try {
      const health = await tool.healthCheck();
      console.log(health.status === "healthy" ? "✓" : "✗", "Status:", health.status);
      console.log(`  Success Rate: ${(health.success_rate * 100).toFixed(1)}%`);
      console.log(`  Avg Latency: ${health.avg_latency_ms.toFixed(2)}ms`);
      if (health.status === "healthy") passed++;
      else failed++;
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 8: Métricas e Info
    console.log("\n=== Teste 8: Métricas e Informações ===");
    const metrics = tool.getMetrics();
    const profiles = tool.getRiskProfiles();
    const assets = tool.getAssetClasses();

    console.log(`  Planos criados: ${metrics.executionCount}`);
    console.log(`  Total planejado: R$ ${metrics.totalInvestmentPlanned.toLocaleString()}`);
    console.log(`  Perfis: ${profiles.join(", ")}`);
    console.log(`  Classes de ativos: ${assets.length}`);
    console.log(`  Por perfil: moderate=${metrics.byRiskProfile.moderate}, aggressive=${metrics.byRiskProfile.aggressive}`);
    passed++;

    // Resumo
    console.log("\n" + "=".repeat(50));
    console.log(`[AE3:InvestmentPlanner] Testes: ${passed} passed, ${failed} failed`);
    console.log("=".repeat(50));

    if (failed === 0) {
      console.log("✓ Todos os testes passaram!");
    }
  }

  runTests().catch(console.error);
}
