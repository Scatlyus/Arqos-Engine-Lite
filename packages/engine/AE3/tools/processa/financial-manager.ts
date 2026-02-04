/**
 * Financial Manager - AE3 Processa
 *
 * Ferramenta avancada de gestao financeira:
 * - Analise de receitas e despesas por categoria
 * - Calculo de ratios financeiros
 * - Deteccao de anomalias
 * - Analise de tendencias
 * - Recomendacoes automaticas
 */

import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

// ============================================================================
// Tipos
// ============================================================================

export type TransactionType = "income" | "expense";

export interface Transaction {
  id?: string;
  type: TransactionType;
  amount: number;
  category: string;
  date?: string;
  description?: string;
}

export interface CategoryAnalysis {
  category: string;
  total: number;
  count: number;
  average: number;
  percentage: number;
  trend?: "increasing" | "stable" | "decreasing";
}

export interface FinancialRatios {
  savingsRate: number;           // (income - expense) / income
  expenseToIncomeRatio: number;  // expense / income
  runwayMonths: number;          // balance / avgMonthlyExpense
  averageTransactionSize: number;
}

export interface TrendAnalysis {
  incomesTrend: "increasing" | "stable" | "decreasing";
  expensesTrend: "increasing" | "stable" | "decreasing";
  balanceTrend: "improving" | "stable" | "worsening";
  monthlyGrowthRate: number;
}

export interface FinancialAnomaly {
  type: "unusual_expense" | "unusual_income" | "pattern_break" | "threshold_exceeded";
  severity: "low" | "medium" | "high";
  transaction?: Transaction;
  message: string;
  value?: number;
  threshold?: number;
}

export interface FinanceSummary {
  total_income: number;
  total_expense: number;
  balance: number;
  transactionCount: number;
  period?: {
    start: string;
    end: string;
  };
}

export interface FinancialReport {
  summary: FinanceSummary;
  categories: {
    income: CategoryAnalysis[];
    expense: CategoryAnalysis[];
  };
  ratios: FinancialRatios;
  trends: TrendAnalysis;
  anomalies: FinancialAnomaly[];
  recommendations: string[];
}

export interface FinancialManagerInput extends ToolInput {
  transactions?: Transaction[];
  income?: number | number[];
  expense?: number | number[];
  anomalyThreshold?: number; // Multiplicador do desvio padrao (default 2)
  generateRecommendations?: boolean;
}

// ============================================================================
// Constantes
// ============================================================================

const DEFAULT_ANOMALY_THRESHOLD = 2;
const MIN_TRANSACTIONS_FOR_TREND = 3;

// Categorias conhecidas para recomendacoes
const ESSENTIAL_CATEGORIES = ["moradia", "alimentacao", "saude", "transporte", "educacao", "housing", "food", "health", "transport", "education"];
const DISCRETIONARY_CATEGORIES = ["lazer", "entretenimento", "compras", "viagens", "leisure", "entertainment", "shopping", "travel"];

// ============================================================================
// Financial Manager
// ============================================================================

export class FinancialManager implements Tool {
  id = "T13";
  name = "FinancialManager";
  phase = "processa" as const;
  version = "2.0.0";

  // Metricas
  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;

  // ==========================================================================
  // Execucao Principal
  // ==========================================================================

  async execute(input: FinancialManagerInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      // Converte inputs legados para transacoes
      const transactions = this.normalizeInput(input);

      // Calcula resumo basico
      const summary = this.calculateSummary(transactions);

      // Analisa categorias
      const categories = this.analyzeCategories(transactions);

      // Calcula ratios
      const ratios = this.calculateRatios(summary, transactions);

      // Analisa tendencias
      const trends = this.analyzeTrends(transactions);

      // Detecta anomalias
      const anomalyThreshold = input.anomalyThreshold ?? DEFAULT_ANOMALY_THRESHOLD;
      const anomalies = this.detectAnomalies(transactions, anomalyThreshold);

      // Gera recomendacoes
      const recommendations = input.generateRecommendations !== false
        ? this.generateRecommendations(summary, ratios, categories, anomalies)
        : [];

      const report: FinancialReport = {
        summary,
        categories,
        ratios,
        trends,
        anomalies,
        recommendations,
      };

      const duration = Date.now() - startTime;
      this.successCount++;
      this.totalDuration += duration;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: report,
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
  // Normalizacao de Input
  // ==========================================================================

  private normalizeInput(input: FinancialManagerInput): Transaction[] {
    const transactions: Transaction[] = [];

    // Se ja tem transacoes, usa diretamente
    if (input.transactions && Array.isArray(input.transactions)) {
      return input.transactions;
    }

    // Converte formato legado (income/expense arrays)
    if (input.income !== undefined) {
      const incomes = Array.isArray(input.income) ? input.income : [input.income];
      for (const amount of incomes) {
        transactions.push({
          type: "income",
          amount: this.toNumber(amount),
          category: "geral",
        });
      }
    }

    if (input.expense !== undefined) {
      const expenses = Array.isArray(input.expense) ? input.expense : [input.expense];
      for (const amount of expenses) {
        transactions.push({
          type: "expense",
          amount: this.toNumber(amount),
          category: "geral",
        });
      }
    }

    return transactions;
  }

  // ==========================================================================
  // Resumo Financeiro
  // ==========================================================================

  private calculateSummary(transactions: Transaction[]): FinanceSummary {
    let total_income = 0;
    let total_expense = 0;
    let minDate: string | undefined;
    let maxDate: string | undefined;

    for (const t of transactions) {
      if (t.type === "income") {
        total_income += t.amount;
      } else {
        total_expense += t.amount;
      }

      if (t.date) {
        if (!minDate || t.date < minDate) minDate = t.date;
        if (!maxDate || t.date > maxDate) maxDate = t.date;
      }
    }

    return {
      total_income,
      total_expense,
      balance: total_income - total_expense,
      transactionCount: transactions.length,
      period: minDate && maxDate ? { start: minDate, end: maxDate } : undefined,
    };
  }

  // ==========================================================================
  // Analise de Categorias
  // ==========================================================================

  private analyzeCategories(transactions: Transaction[]): {
    income: CategoryAnalysis[];
    expense: CategoryAnalysis[];
  } {
    const incomeByCategory = new Map<string, number[]>();
    const expenseByCategory = new Map<string, number[]>();

    // Agrupa transacoes por categoria
    for (const t of transactions) {
      const category = t.category.toLowerCase();
      const map = t.type === "income" ? incomeByCategory : expenseByCategory;

      if (!map.has(category)) {
        map.set(category, []);
      }
      map.get(category)!.push(t.amount);
    }

    // Calcula totais para percentuais
    const totalIncome = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    return {
      income: this.buildCategoryAnalysis(incomeByCategory, totalIncome),
      expense: this.buildCategoryAnalysis(expenseByCategory, totalExpense),
    };
  }

  private buildCategoryAnalysis(
    categoryMap: Map<string, number[]>,
    total: number
  ): CategoryAnalysis[] {
    const analyses: CategoryAnalysis[] = [];

    for (const [category, amounts] of categoryMap.entries()) {
      const categoryTotal = amounts.reduce((a, b) => a + b, 0);
      const count = amounts.length;

      analyses.push({
        category,
        total: Number(categoryTotal.toFixed(2)),
        count,
        average: Number((categoryTotal / count).toFixed(2)),
        percentage: total > 0 ? Number(((categoryTotal / total) * 100).toFixed(1)) : 0,
        trend: count >= MIN_TRANSACTIONS_FOR_TREND ? this.calculateTrend(amounts) : undefined,
      });
    }

    // Ordena por total (maior primeiro)
    return analyses.sort((a, b) => b.total - a.total);
  }

  // ==========================================================================
  // Ratios Financeiros
  // ==========================================================================

  private calculateRatios(summary: FinanceSummary, transactions: Transaction[]): FinancialRatios {
    const { total_income, total_expense, balance } = summary;

    // Taxa de poupanca
    const savingsRate = total_income > 0
      ? Number(((total_income - total_expense) / total_income).toFixed(3))
      : 0;

    // Ratio despesa/receita
    const expenseToIncomeRatio = total_income > 0
      ? Number((total_expense / total_income).toFixed(3))
      : total_expense > 0 ? Infinity : 0;

    // Runway (meses de sobrevivencia com balance atual)
    const avgMonthlyExpense = this.estimateMonthlyExpense(transactions);
    const runwayMonths = avgMonthlyExpense > 0
      ? Number((balance / avgMonthlyExpense).toFixed(1))
      : balance > 0 ? Infinity : 0;

    // Tamanho medio de transacao
    const averageTransactionSize = transactions.length > 0
      ? Number((transactions.reduce((sum, t) => sum + t.amount, 0) / transactions.length).toFixed(2))
      : 0;

    return {
      savingsRate,
      expenseToIncomeRatio,
      runwayMonths,
      averageTransactionSize,
    };
  }

  private estimateMonthlyExpense(transactions: Transaction[]): number {
    const expenses = transactions.filter((t) => t.type === "expense");
    if (expenses.length === 0) return 0;

    // Se tem datas, calcula media mensal real
    const datedExpenses = expenses.filter((t) => t.date);
    if (datedExpenses.length >= 2) {
      const dates = datedExpenses.map((t) => new Date(t.date!).getTime());
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      const months = Math.max(1, (maxDate - minDate) / (30 * 24 * 60 * 60 * 1000));
      const totalExpense = datedExpenses.reduce((sum, t) => sum + t.amount, 0);
      return totalExpense / months;
    }

    // Fallback: assume todas as transacoes sao de 1 mes
    return expenses.reduce((sum, t) => sum + t.amount, 0);
  }

  // ==========================================================================
  // Analise de Tendencias
  // ==========================================================================

  private analyzeTrends(transactions: Transaction[]): TrendAnalysis {
    const incomes = transactions.filter((t) => t.type === "income").map((t) => t.amount);
    const expenses = transactions.filter((t) => t.type === "expense").map((t) => t.amount);

    const incomesTrend = this.calculateTrend(incomes);
    const expensesTrend = this.calculateTrend(expenses);

    // Trend de balance depende da relacao entre income e expense trends
    let balanceTrend: "improving" | "stable" | "worsening" = "stable";
    if (incomesTrend === "increasing" && expensesTrend !== "increasing") {
      balanceTrend = "improving";
    } else if (incomesTrend === "decreasing" || expensesTrend === "increasing") {
      balanceTrend = "worsening";
    }

    // Taxa de crescimento mensal (simplificado)
    const monthlyGrowthRate = this.calculateGrowthRate(incomes, expenses);

    return {
      incomesTrend,
      expensesTrend,
      balanceTrend,
      monthlyGrowthRate: Number(monthlyGrowthRate.toFixed(3)),
    };
  }

  private calculateTrend(values: number[]): "increasing" | "stable" | "decreasing" {
    if (values.length < MIN_TRANSACTIONS_FOR_TREND) return "stable";

    // Regressao linear simples
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const avgValue = sumY / n;

    // Considera mudanca significativa se slope > 5% do valor medio
    const threshold = avgValue * 0.05;
    if (slope > threshold) return "increasing";
    if (slope < -threshold) return "decreasing";
    return "stable";
  }

  private calculateGrowthRate(incomes: number[], expenses: number[]): number {
    if (incomes.length < 2 && expenses.length < 2) return 0;

    const totalIncome = incomes.reduce((a, b) => a + b, 0);
    const totalExpense = expenses.reduce((a, b) => a + b, 0);

    if (totalIncome === 0) return totalExpense > 0 ? -1 : 0;

    return (totalIncome - totalExpense) / totalIncome;
  }

  // ==========================================================================
  // Deteccao de Anomalias
  // ==========================================================================

  private detectAnomalies(transactions: Transaction[], threshold: number): FinancialAnomaly[] {
    const anomalies: FinancialAnomaly[] = [];

    const incomes = transactions.filter((t) => t.type === "income");
    const expenses = transactions.filter((t) => t.type === "expense");

    // Detecta incomes incomuns
    anomalies.push(...this.findOutliers(incomes, threshold, "unusual_income"));

    // Detecta expenses incomuns
    anomalies.push(...this.findOutliers(expenses, threshold, "unusual_expense"));

    // Verifica thresholds absolutos
    for (const t of transactions) {
      // Transacao muito grande (> 10x a media)
      const allAmounts = transactions.map((tx) => tx.amount);
      const avg = allAmounts.reduce((a, b) => a + b, 0) / allAmounts.length;

      if (t.amount > avg * 10) {
        anomalies.push({
          type: "threshold_exceeded",
          severity: "high",
          transaction: t,
          message: `Transacao ${t.amount.toFixed(2)} excede 10x a media (${avg.toFixed(2)})`,
          value: t.amount,
          threshold: avg * 10,
        });
      }
    }

    return anomalies;
  }

  private findOutliers(
    transactions: Transaction[],
    threshold: number,
    type: "unusual_income" | "unusual_expense"
  ): FinancialAnomaly[] {
    if (transactions.length < 3) return [];

    const amounts = transactions.map((t) => t.amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((sum, a) => sum + Math.pow(a - mean, 2), 0) / amounts.length;
    const stdDev = Math.sqrt(variance);

    const anomalies: FinancialAnomaly[] = [];

    for (const t of transactions) {
      const zScore = stdDev > 0 ? Math.abs(t.amount - mean) / stdDev : 0;

      if (zScore > threshold) {
        const severity = zScore > threshold * 2 ? "high" : zScore > threshold * 1.5 ? "medium" : "low";
        anomalies.push({
          type,
          severity,
          transaction: t,
          message: `${t.type === "income" ? "Receita" : "Despesa"} de ${t.amount.toFixed(2)} e ${zScore.toFixed(1)} desvios da media`,
          value: t.amount,
          threshold: mean + threshold * stdDev,
        });
      }
    }

    return anomalies;
  }

  // ==========================================================================
  // Recomendacoes
  // ==========================================================================

  private generateRecommendations(
    summary: FinanceSummary,
    ratios: FinancialRatios,
    categories: { income: CategoryAnalysis[]; expense: CategoryAnalysis[] },
    anomalies: FinancialAnomaly[]
  ): string[] {
    const recommendations: string[] = [];

    // Recomendacoes baseadas em ratios
    if (ratios.savingsRate < 0) {
      recommendations.push("ALERTA: Despesas excedem receitas. Revise gastos urgentemente.");
    } else if (ratios.savingsRate < 0.1) {
      recommendations.push("Taxa de poupanca baixa (<10%). Considere reduzir gastos nao essenciais.");
    } else if (ratios.savingsRate > 0.3) {
      recommendations.push("Excelente taxa de poupanca (>30%). Considere investir o excedente.");
    }

    if (ratios.runwayMonths < 3 && ratios.runwayMonths !== Infinity) {
      recommendations.push(`Runway de apenas ${ratios.runwayMonths.toFixed(1)} meses. Construa reserva de emergencia.`);
    }

    if (ratios.expenseToIncomeRatio > 0.9) {
      recommendations.push("Ratio despesa/receita muito alto (>90%). Pouca margem para imprevistos.");
    }

    // Recomendacoes baseadas em categorias
    const discretionaryExpenses = categories.expense.filter((c) =>
      DISCRETIONARY_CATEGORIES.some((dc) => c.category.includes(dc))
    );
    const totalDiscretionary = discretionaryExpenses.reduce((sum, c) => sum + c.total, 0);
    const discretionaryPercent = summary.total_expense > 0
      ? (totalDiscretionary / summary.total_expense) * 100
      : 0;

    if (discretionaryPercent > 30) {
      recommendations.push(`Gastos discricionarios representam ${discretionaryPercent.toFixed(0)}% das despesas. Considere reduzir.`);
    }

    // Recomendacoes baseadas em anomalias
    const highSeverityAnomalies = anomalies.filter((a) => a.severity === "high");
    if (highSeverityAnomalies.length > 0) {
      recommendations.push(`${highSeverityAnomalies.length} anomalia(s) de alta severidade detectada(s). Revise transacoes atipicas.`);
    }

    // Adiciona recomendacao generica se nenhuma especifica
    if (recommendations.length === 0) {
      recommendations.push("Financas aparentemente saudaveis. Continue monitorando regularmente.");
    }

    return recommendations;
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
      : 15;
    const successRate = this.executionCount > 0
      ? this.successCount / this.executionCount
      : 1;

    // Teste rapido de sanidade
    const testResult = await this.execute({
      transactions: [
        { type: "income", amount: 1000, category: "salario" },
        { type: "expense", amount: 500, category: "moradia" },
      ],
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
  console.log("[AE3:FinancialManager] Testando Financial Manager...\n");

  async function runTests() {
    const manager = new FinancialManager();

    // Teste 1: Formato legado
    console.log("=== Teste 1: Formato Legado ===");
    const legacy = await manager.execute({
      income: [1000, 500],
      expense: [300, 200, 100],
    });
    const legacyOut = legacy.output as FinancialReport;
    console.log("Income:", legacyOut.summary.total_income);
    console.log("Expense:", legacyOut.summary.total_expense);
    console.log("Balance:", legacyOut.summary.balance);
    console.log(legacyOut.summary.balance === 900 ? "✓ Legado OK" : "✗ Erro");

    // Teste 2: Transacoes com categorias
    console.log("\n=== Teste 2: Transacoes com Categorias ===");
    const categorized = await manager.execute({
      transactions: [
        { type: "income", amount: 5000, category: "salario" },
        { type: "income", amount: 500, category: "investimentos" },
        { type: "expense", amount: 1500, category: "moradia" },
        { type: "expense", amount: 800, category: "alimentacao" },
        { type: "expense", amount: 300, category: "lazer" },
      ],
    });
    const catOut = categorized.output as FinancialReport;
    console.log("Categorias expense:", catOut.categories.expense.map((c) => `${c.category}: ${c.percentage}%`));
    console.log(catOut.categories.expense.length === 3 ? "✓ Categorias OK" : "✗ Erro");

    // Teste 3: Ratios financeiros
    console.log("\n=== Teste 3: Ratios Financeiros ===");
    console.log("Savings Rate:", (catOut.ratios.savingsRate * 100).toFixed(1) + "%");
    console.log("Expense/Income:", (catOut.ratios.expenseToIncomeRatio * 100).toFixed(1) + "%");
    console.log(catOut.ratios.savingsRate > 0 ? "✓ Ratios OK" : "✗ Erro");

    // Teste 4: Deteccao de anomalias
    console.log("\n=== Teste 4: Deteccao de Anomalias ===");
    const withAnomaly = await manager.execute({
      transactions: [
        { type: "expense", amount: 100, category: "geral" },
        { type: "expense", amount: 120, category: "geral" },
        { type: "expense", amount: 90, category: "geral" },
        { type: "expense", amount: 110, category: "geral" },
        { type: "expense", amount: 5000, category: "geral" }, // Anomalia
      ],
    });
    const anomalyOut = withAnomaly.output as FinancialReport;
    console.log("Anomalias detectadas:", anomalyOut.anomalies.length);
    console.log(anomalyOut.anomalies.length > 0 ? "✓ Anomalias OK" : "✗ Erro");

    // Teste 5: Recomendacoes
    console.log("\n=== Teste 5: Recomendacoes ===");
    const lowSavings = await manager.execute({
      transactions: [
        { type: "income", amount: 1000, category: "salario" },
        { type: "expense", amount: 950, category: "moradia" },
      ],
    });
    const recOut = lowSavings.output as FinancialReport;
    console.log("Recomendacoes:", recOut.recommendations.length);
    for (const rec of recOut.recommendations.slice(0, 2)) {
      console.log(`  - ${rec.substring(0, 60)}...`);
    }
    console.log(recOut.recommendations.length > 0 ? "✓ Recomendacoes OK" : "✗ Erro");

    // Teste 6: Tendencias
    console.log("\n=== Teste 6: Tendencias ===");
    const withTrend = await manager.execute({
      transactions: [
        { type: "income", amount: 1000, category: "salario", date: "2024-01-01" },
        { type: "income", amount: 1100, category: "salario", date: "2024-02-01" },
        { type: "income", amount: 1200, category: "salario", date: "2024-03-01" },
        { type: "expense", amount: 500, category: "geral", date: "2024-01-01" },
        { type: "expense", amount: 500, category: "geral", date: "2024-02-01" },
        { type: "expense", amount: 500, category: "geral", date: "2024-03-01" },
      ],
    });
    const trendOut = withTrend.output as FinancialReport;
    console.log("Trend receitas:", trendOut.trends.incomesTrend);
    console.log("Trend despesas:", trendOut.trends.expensesTrend);
    console.log("Trend balance:", trendOut.trends.balanceTrend);
    console.log(trendOut.trends.incomesTrend === "increasing" ? "✓ Tendencias OK" : "✗ Erro");

    // Teste 7: Periodo automatico
    console.log("\n=== Teste 7: Periodo Automatico ===");
    console.log("Periodo:", trendOut.summary.period);
    console.log(trendOut.summary.period?.start === "2024-01-01" ? "✓ Periodo OK" : "✗ Erro");

    // Teste 8: Health check
    console.log("\n=== Teste 8: Health Check ===");
    const health = await manager.healthCheck();
    console.log("Status:", health.status);
    console.log("Execucoes:", health.details?.executions);
    console.log(health.status === "healthy" ? "✓ Health OK" : "✗ Erro");

    console.log("\n[AE3:FinancialManager] ✓ Testes concluidos");
  }

  runTests().catch(console.error);
}
