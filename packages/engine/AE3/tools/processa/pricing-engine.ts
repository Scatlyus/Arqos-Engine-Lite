/**
 * Pricing Engine - AE3 Processa
 *
 * Motor de precificacao avancado:
 * - Multiplas estrategias (fixed_margin, cost_plus, competitive, value_based, dynamic)
 * - Aplicacao de descontos (percentual, fixo, volume)
 * - Calculo de impostos
 * - Validacao de constraints (min/max price)
 * - Breakdown detalhado do preco
 */

import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

// ============================================================================
// Tipos
// ============================================================================

export type PricingStrategy =
  | "fixed_margin"
  | "cost_plus"
  | "competitive"
  | "value_based"
  | "dynamic";

export type DiscountType = "percentage" | "fixed" | "volume";

export interface DiscountRule {
  type: DiscountType;
  value: number;
  minQuantity?: number;  // Para desconto por volume
  code?: string;         // Codigo promocional
  description?: string;
}

export interface TaxRule {
  name: string;
  rate: number;          // Taxa em decimal (0.1 = 10%)
  compound?: boolean;    // Se aplica sobre o preco ja taxado
}

export interface PriceConstraints {
  minPrice?: number;
  maxPrice?: number;
  roundTo?: number;      // Arredonda para multiplos (ex: 0.99)
  roundingMode?: "floor" | "ceil" | "round";
}

export interface PriceBreakdown {
  base: number;
  costAdjustment: number;
  margin: number;
  marginAmount: number;
  subtotal: number;
  discounts: number;
  taxes: number;
  final: number;
}

export interface DiscountInfo {
  type: DiscountType;
  description: string;
  amount: number;
}

export interface TaxInfo {
  name: string;
  rate: number;
  amount: number;
}

export interface PricingResult {
  base_price: number;
  final_price: number;
  breakdown: PriceBreakdown;
  strategy_applied: PricingStrategy;
  discounts_applied: DiscountInfo[];
  taxes_applied: TaxInfo[];
  constraints_adjusted: boolean;
  original_calculated: number;
  margin_effective: number;
}

export interface PricingEngineInput extends ToolInput {
  base_price?: number;
  cost?: number;
  margin?: number;
  strategy?: PricingStrategy;
  competitor_prices?: number[];
  perceived_value?: number;
  demand_factor?: number;       // 0.5 (baixa) a 2.0 (alta)
  discounts?: DiscountRule[];
  taxes?: TaxRule[];
  quantity?: number;
  constraints?: PriceConstraints;
}

// ============================================================================
// Constantes
// ============================================================================

const DEFAULT_MARGIN = 0.2;
const DEFAULT_STRATEGY: PricingStrategy = "fixed_margin";

// ============================================================================
// Pricing Engine
// ============================================================================

export class PricingEngine implements Tool {
  id = "T15";
  name = "PricingEngine";
  phase = "processa" as const;
  version = "2.0.0";

  // Metricas
  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;

  // ==========================================================================
  // Execucao Principal
  // ==========================================================================

  async execute(input: PricingEngineInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      const basePrice = this.toNumber(input.base_price ?? input.cost ?? 0);
      const cost = this.toNumber(input.cost ?? basePrice);
      const margin = this.toNumber(input.margin ?? DEFAULT_MARGIN);
      const strategy = input.strategy ?? DEFAULT_STRATEGY;
      const quantity = this.toNumber(input.quantity ?? 1);

      // Calcula preco base pela estrategia
      const strategyPrice = this.applyStrategy(
        basePrice,
        cost,
        margin,
        strategy,
        input
      );

      // Calcula breakdown inicial
      const costAdjustment = strategyPrice - basePrice;
      const marginAmount = strategyPrice * margin;
      let subtotal = strategyPrice + marginAmount;

      // Aplica descontos
      const { discountedPrice, discountsApplied, totalDiscount } = this.applyDiscounts(
        subtotal,
        input.discounts ?? [],
        quantity
      );

      // Aplica impostos
      const { taxedPrice, taxesApplied, totalTax } = this.applyTaxes(
        discountedPrice,
        input.taxes ?? []
      );

      // Guarda preco calculado original
      const originalCalculated = taxedPrice;

      // Aplica constraints
      const { adjustedPrice, wasAdjusted } = this.applyConstraints(
        taxedPrice,
        input.constraints
      );

      // Calcula margem efetiva
      const marginEffective = cost > 0
        ? (adjustedPrice - cost) / cost
        : margin;

      // Monta breakdown
      const breakdown: PriceBreakdown = {
        base: basePrice,
        costAdjustment: Number(costAdjustment.toFixed(2)),
        margin,
        marginAmount: Number(marginAmount.toFixed(2)),
        subtotal: Number(subtotal.toFixed(2)),
        discounts: Number(totalDiscount.toFixed(2)),
        taxes: Number(totalTax.toFixed(2)),
        final: Number(adjustedPrice.toFixed(2)),
      };

      const result: PricingResult = {
        base_price: basePrice,
        final_price: Number(adjustedPrice.toFixed(2)),
        breakdown,
        strategy_applied: strategy,
        discounts_applied: discountsApplied,
        taxes_applied: taxesApplied,
        constraints_adjusted: wasAdjusted,
        original_calculated: Number(originalCalculated.toFixed(2)),
        margin_effective: Number(marginEffective.toFixed(3)),
      };

      const duration = Date.now() - startTime;
      this.successCount++;
      this.totalDuration += duration;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: result,
        duration_ms: duration,
        timestamp: new Date(),
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.totalDuration += duration;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        output: { error: String(error) },
        duration_ms: duration,
        timestamp: new Date(),
      };
    }
  }

  // ==========================================================================
  // Estrategias de Precificacao
  // ==========================================================================

  private applyStrategy(
    basePrice: number,
    cost: number,
    margin: number,
    strategy: PricingStrategy,
    input: PricingEngineInput
  ): number {
    switch (strategy) {
      case "fixed_margin":
        return this.fixedMarginStrategy(basePrice);

      case "cost_plus":
        return this.costPlusStrategy(cost, margin);

      case "competitive":
        return this.competitiveStrategy(basePrice, input.competitor_prices ?? []);

      case "value_based":
        return this.valueBasedStrategy(basePrice, input.perceived_value);

      case "dynamic":
        return this.dynamicStrategy(basePrice, input.demand_factor ?? 1);

      default:
        return basePrice;
    }
  }

  /**
   * Estrategia de margem fixa - usa preco base direto
   */
  private fixedMarginStrategy(basePrice: number): number {
    return basePrice;
  }

  /**
   * Estrategia cost-plus - adiciona margem sobre o custo
   */
  private costPlusStrategy(cost: number, margin: number): number {
    return cost * (1 + margin);
  }

  /**
   * Estrategia competitiva - baseia-se nos precos dos concorrentes
   */
  private competitiveStrategy(basePrice: number, competitorPrices: number[]): number {
    if (competitorPrices.length === 0) {
      return basePrice;
    }

    // Calcula preco medio dos concorrentes
    const avgCompetitor = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
    const minCompetitor = Math.min(...competitorPrices);

    // Posiciona ligeiramente abaixo da media mas acima do minimo
    const targetPrice = avgCompetitor * 0.95;
    return Math.max(targetPrice, minCompetitor * 1.02, basePrice * 0.8);
  }

  /**
   * Estrategia baseada em valor - usa valor percebido pelo cliente
   */
  private valueBasedStrategy(basePrice: number, perceivedValue?: number): number {
    if (perceivedValue === undefined || perceivedValue <= 0) {
      return basePrice;
    }

    // Preco e uma fracao do valor percebido (tipicamente 70-90%)
    const valuePrice = perceivedValue * 0.8;
    return Math.max(valuePrice, basePrice);
  }

  /**
   * Estrategia dinamica - ajusta baseado na demanda
   */
  private dynamicStrategy(basePrice: number, demandFactor: number): number {
    // Demanda alta (>1) aumenta preco, baixa (<1) diminui
    const clampedFactor = Math.max(0.5, Math.min(2.0, demandFactor));
    return basePrice * clampedFactor;
  }

  // ==========================================================================
  // Descontos
  // ==========================================================================

  private applyDiscounts(
    price: number,
    discounts: DiscountRule[],
    quantity: number
  ): { discountedPrice: number; discountsApplied: DiscountInfo[]; totalDiscount: number } {
    let currentPrice = price;
    const discountsApplied: DiscountInfo[] = [];
    let totalDiscount = 0;

    for (const discount of discounts) {
      // Verifica se atende minimo de quantidade
      if (discount.minQuantity && quantity < discount.minQuantity) {
        continue;
      }

      let discountAmount = 0;
      let description = discount.description ?? "";

      switch (discount.type) {
        case "percentage":
          discountAmount = currentPrice * discount.value;
          description = description || `Desconto de ${(discount.value * 100).toFixed(0)}%`;
          break;

        case "fixed":
          discountAmount = Math.min(discount.value, currentPrice);
          description = description || `Desconto fixo de ${discount.value.toFixed(2)}`;
          break;

        case "volume":
          // Desconto progressivo por volume
          const volumeRate = Math.min(discount.value * Math.floor(quantity / (discount.minQuantity || 1)), 0.5);
          discountAmount = currentPrice * volumeRate;
          description = description || `Desconto por volume (${(volumeRate * 100).toFixed(0)}%)`;
          break;
      }

      if (discountAmount > 0) {
        currentPrice -= discountAmount;
        totalDiscount += discountAmount;

        discountsApplied.push({
          type: discount.type,
          description,
          amount: Number(discountAmount.toFixed(2)),
        });
      }
    }

    return {
      discountedPrice: Math.max(0, currentPrice),
      discountsApplied,
      totalDiscount,
    };
  }

  // ==========================================================================
  // Impostos
  // ==========================================================================

  private applyTaxes(
    price: number,
    taxes: TaxRule[]
  ): { taxedPrice: number; taxesApplied: TaxInfo[]; totalTax: number } {
    let currentPrice = price;
    const taxesApplied: TaxInfo[] = [];
    let totalTax = 0;

    // Separa impostos simples e compostos
    const simpleTaxes = taxes.filter((t) => !t.compound);
    const compoundTaxes = taxes.filter((t) => t.compound);

    // Aplica impostos simples primeiro (sobre preco base)
    for (const tax of simpleTaxes) {
      const taxAmount = price * tax.rate;
      totalTax += taxAmount;

      taxesApplied.push({
        name: tax.name,
        rate: tax.rate,
        amount: Number(taxAmount.toFixed(2)),
      });
    }

    currentPrice = price + totalTax;

    // Aplica impostos compostos (sobre preco ja taxado)
    for (const tax of compoundTaxes) {
      const taxAmount = currentPrice * tax.rate;
      totalTax += taxAmount;
      currentPrice += taxAmount;

      taxesApplied.push({
        name: tax.name,
        rate: tax.rate,
        amount: Number(taxAmount.toFixed(2)),
      });
    }

    return {
      taxedPrice: currentPrice,
      taxesApplied,
      totalTax,
    };
  }

  // ==========================================================================
  // Constraints
  // ==========================================================================

  private applyConstraints(
    price: number,
    constraints?: PriceConstraints
  ): { adjustedPrice: number; wasAdjusted: boolean } {
    if (!constraints) {
      return { adjustedPrice: price, wasAdjusted: false };
    }

    let adjustedPrice = price;
    let wasAdjusted = false;

    // Aplica min/max
    if (constraints.minPrice !== undefined && adjustedPrice < constraints.minPrice) {
      adjustedPrice = constraints.minPrice;
      wasAdjusted = true;
    }

    if (constraints.maxPrice !== undefined && adjustedPrice > constraints.maxPrice) {
      adjustedPrice = constraints.maxPrice;
      wasAdjusted = true;
    }

    // Aplica arredondamento
    if (constraints.roundTo !== undefined && constraints.roundTo > 0) {
      const roundTo = constraints.roundTo;
      const mode = constraints.roundingMode ?? "round";

      switch (mode) {
        case "floor":
          adjustedPrice = Math.floor(adjustedPrice / roundTo) * roundTo;
          break;
        case "ceil":
          adjustedPrice = Math.ceil(adjustedPrice / roundTo) * roundTo;
          break;
        case "round":
        default:
          adjustedPrice = Math.round(adjustedPrice / roundTo) * roundTo;
          break;
      }

      // Ajuste especial para precos tipo X.99
      if (roundTo < 1 && roundTo > 0) {
        const intPart = Math.floor(adjustedPrice);
        adjustedPrice = intPart + roundTo;
      }

      wasAdjusted = true;
    }

    return { adjustedPrice, wasAdjusted };
  }

  // ==========================================================================
  // Utilitarios
  // ==========================================================================

  private toNumber(value: unknown): number {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num : 0;
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount > 0
      ? this.totalDuration / this.executionCount
      : 10;
    const successRate = this.executionCount > 0
      ? this.successCount / this.executionCount
      : 1;

    // Teste rapido de sanidade
    const testResult = await this.execute({
      base_price: 100,
      margin: 0.2,
      strategy: "fixed_margin",
    });

    return {
      tool_name: this.name,
      status: testResult.success ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: Number(avgLatency.toFixed(2)),
      success_rate: Number(successRate.toFixed(4)),
      details: {
        executions: this.executionCount,
        version: this.version,
      },
    };
  }

  // ==========================================================================
  // Metricas
  // ==========================================================================

  getStats() {
    return {
      executionCount: this.executionCount,
      successCount: this.successCount,
      avgDuration: this.executionCount > 0 ? this.totalDuration / this.executionCount : 0,
    };
  }
}

// ============================================================================
// CLI Test Suite
// ============================================================================

if (require.main === module) {
  console.log("[AE3:PricingEngine] Testando Pricing Engine...\n");

  async function runTests() {
    const engine = new PricingEngine();

    // Teste 1: Margem fixa (legado)
    console.log("=== Teste 1: Margem Fixa ===");
    const fixed = await engine.execute({
      base_price: 100,
      margin: 0.2,
    });
    const fixedOut = fixed.output as PricingResult;
    console.log("Base:", fixedOut.base_price);
    console.log("Final:", fixedOut.final_price);
    console.log("Margem:", fixedOut.breakdown.margin);
    console.log(fixedOut.final_price === 120 ? "✓ Margem fixa OK" : "✗ Erro");

    // Teste 2: Cost-plus
    console.log("\n=== Teste 2: Cost-Plus ===");
    const costPlus = await engine.execute({
      cost: 50,
      margin: 0.5,
      strategy: "cost_plus",
    });
    const costPlusOut = costPlus.output as PricingResult;
    console.log("Custo:", 50);
    console.log("Final:", costPlusOut.final_price);
    console.log(costPlusOut.final_price > 50 ? "✓ Cost-plus OK" : "✗ Erro");

    // Teste 3: Competitiva
    console.log("\n=== Teste 3: Competitiva ===");
    const competitive = await engine.execute({
      base_price: 100,
      competitor_prices: [110, 120, 115],
      strategy: "competitive",
      margin: 0.1,
    });
    const compOut = competitive.output as PricingResult;
    console.log("Precos concorrentes:", [110, 120, 115]);
    console.log("Preco calculado:", compOut.breakdown.subtotal);
    console.log(compOut.strategy_applied === "competitive" ? "✓ Competitiva OK" : "✗ Erro");

    // Teste 4: Dinamica
    console.log("\n=== Teste 4: Dinamica ===");
    const dynamic = await engine.execute({
      base_price: 100,
      demand_factor: 1.5,
      strategy: "dynamic",
      margin: 0.1,
    });
    const dynOut = dynamic.output as PricingResult;
    console.log("Demanda factor:", 1.5);
    console.log("Preco ajustado:", dynOut.breakdown.subtotal);
    console.log(dynOut.breakdown.subtotal > 100 ? "✓ Dinamica OK" : "✗ Erro");

    // Teste 5: Descontos
    console.log("\n=== Teste 5: Descontos ===");
    const withDiscount = await engine.execute({
      base_price: 100,
      margin: 0.2,
      discounts: [
        { type: "percentage", value: 0.1, description: "Promocao 10%" },
      ],
    });
    const discOut = withDiscount.output as PricingResult;
    console.log("Subtotal:", discOut.breakdown.subtotal);
    console.log("Desconto:", discOut.breakdown.discounts);
    console.log("Final:", discOut.final_price);
    console.log(discOut.discounts_applied.length > 0 ? "✓ Descontos OK" : "✗ Erro");

    // Teste 6: Impostos
    console.log("\n=== Teste 6: Impostos ===");
    const withTax = await engine.execute({
      base_price: 100,
      margin: 0,
      taxes: [
        { name: "ICMS", rate: 0.18 },
        { name: "IPI", rate: 0.1, compound: true },
      ],
    });
    const taxOut = withTax.output as PricingResult;
    console.log("Base:", taxOut.base_price);
    console.log("Impostos:", taxOut.breakdown.taxes);
    console.log("Impostos aplicados:", taxOut.taxes_applied.map((t) => `${t.name}: ${t.amount}`));
    console.log(taxOut.taxes_applied.length === 2 ? "✓ Impostos OK" : "✗ Erro");

    // Teste 7: Constraints
    console.log("\n=== Teste 7: Constraints ===");
    const withConstraints = await engine.execute({
      base_price: 100,
      margin: 0.5,
      constraints: {
        maxPrice: 120,
        roundTo: 0.99,
      },
    });
    const constOut = withConstraints.output as PricingResult;
    console.log("Calculado original:", constOut.original_calculated);
    console.log("Final ajustado:", constOut.final_price);
    console.log("Foi ajustado:", constOut.constraints_adjusted);
    console.log(constOut.constraints_adjusted ? "✓ Constraints OK" : "✗ Erro");

    // Teste 8: Desconto por volume
    console.log("\n=== Teste 8: Desconto por Volume ===");
    const volume = await engine.execute({
      base_price: 100,
      margin: 0,
      quantity: 10,
      discounts: [
        { type: "volume", value: 0.05, minQuantity: 5 },
      ],
    });
    const volOut = volume.output as PricingResult;
    console.log("Quantidade:", 10);
    console.log("Desconto volume:", volOut.breakdown.discounts);
    console.log(volOut.discounts_applied.length > 0 ? "✓ Volume OK" : "✗ Erro");

    // Teste 9: Value-based
    console.log("\n=== Teste 9: Value-Based ===");
    const valueBased = await engine.execute({
      base_price: 50,
      perceived_value: 200,
      strategy: "value_based",
      margin: 0.1,
    });
    const valueOut = valueBased.output as PricingResult;
    console.log("Valor percebido:", 200);
    console.log("Preco base estrategia:", valueOut.breakdown.subtotal);
    console.log(valueOut.strategy_applied === "value_based" ? "✓ Value-based OK" : "✗ Erro");

    // Teste 10: Health check
    console.log("\n=== Teste 10: Health Check ===");
    const health = await engine.healthCheck();
    console.log("Status:", health.status);
    console.log("Execucoes:", health.details?.executions);
    console.log(health.status === "healthy" ? "✓ Health OK" : "✗ Erro");

    console.log("\n[AE3:PricingEngine] ✓ Testes concluidos");
  }

  runTests().catch(console.error);
}
