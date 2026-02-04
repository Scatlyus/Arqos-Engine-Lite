import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type Diagnosis = {
  category: string;
  confidence: number;
  tags: string[];
  urgency: "low" | "medium" | "high";
  complexity: "low" | "medium" | "high";
  risk_flags: string[];
  constraints: string[];
  signals: {
    word_count: number;
    has_deadline: boolean;
    has_budget: boolean;
    has_data: boolean;
    has_compliance: boolean;
    requires_external: boolean;
  };
  summary: string;
};

type CategoryScore = {
  category: string;
  score: number;
};

export class TaskDiagnoser implements Tool {
  id = "T6";
  name = "TaskDiagnoser";
  phase = "colhe" as const;
  version = "2.0.0";

  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount += 1;

    try {
      const text = String(input.text ?? input.prompt ?? input.query ?? "");
      const diagnosis = this.diagnose(text);

      this.successCount += 1;
      this.totalDuration += Date.now() - startTime;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: diagnosis,
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    } catch (error) {
      this.totalDuration += Date.now() - startTime;
      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        error: error instanceof Error ? error.message : "TaskDiagnoser failed",
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount ? Math.round(this.totalDuration / this.executionCount) : 6;
    const successRate = this.executionCount ? this.successCount / this.executionCount : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.9 ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: avgLatency,
      success_rate: Number(successRate.toFixed(2))
    };
  }

  private diagnose(text: string): Diagnosis {
    const normalized = text.toLowerCase();
    const tokens = this.tokenize(normalized);
    const wordCount = tokens.length;

    const categories = this.scoreCategories(normalized);
    const primary = categories[0]?.category ?? "general";
    const confidence = categories[0]?.score ?? 0.35;
    const tags = categories.filter((entry) => entry.score > 0).map((entry) => entry.category);

    const signals = {
      word_count: wordCount,
      has_deadline: this.hasDeadline(normalized),
      has_budget: this.hasBudget(normalized),
      has_data: this.hasDataSignals(normalized),
      has_compliance: this.hasComplianceSignals(normalized),
      requires_external: this.requiresExternalSignals(normalized)
    };

    const urgency = this.estimateUrgency(normalized, signals);
    const complexity = this.estimateComplexity(wordCount, tags, signals);
    const constraints = this.extractConstraints(normalized);
    const riskFlags = this.identifyRisks(normalized, signals, constraints);

    return {
      category: primary,
      confidence: this.roundTo(confidence, 2),
      tags,
      urgency,
      complexity,
      risk_flags: riskFlags,
      constraints,
      signals,
      summary: this.buildSummary(primary, urgency, complexity, signals, constraints)
    };
  }

  private scoreCategories(text: string): CategoryScore[] {
    const dictionary: Record<string, string[]> = {
      finance: ["finance", "orcamento", "budget", "custo", "receita", "lucro", "pricing", "invest"],
      summarization: ["resumo", "sumario", "summarize", "summary", "tl;dr"],
      translation: ["traduz", "translate", "translation", "idioma"],
      legal: ["contrato", "juridico", "compliance", "regulatorio", "lgpd", "gdpr"],
      analytics: ["kpi", "metric", "dashboard", "analise", "analysis", "insight"],
      planning: ["roadmap", "plano", "estrategia", "strategy", "cronograma"],
      data_integration: ["etl", "integracao", "pipeline", "database", "api", "webhook"]
    };

    const scores: CategoryScore[] = [];
    for (const [category, keywords] of Object.entries(dictionary)) {
      const hits = keywords.reduce((acc, keyword) => acc + (text.includes(keyword) ? 1 : 0), 0);
      if (hits > 0) {
        scores.push({ category, score: Math.min(0.3 + hits * 0.15, 0.95) });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    return scores.length ? scores : [{ category: "general", score: 0.35 }];
  }

  private hasDeadline(text: string): boolean {
    return /hoje|amanh[aã]|prazo|deadline|até\s+\d|\bASAP\b/i.test(text);
  }

  private hasBudget(text: string): boolean {
    return /\b(usd|brl|eur|r\$|€|\$)\b|\b(budget|orcamento|custo|capex|opex)\b/i.test(text);
  }

  private hasDataSignals(text: string): boolean {
    return /\b(csv|xlsx|json|dados|dataset|tabela|schema|query)\b/i.test(text);
  }

  private hasComplianceSignals(text: string): boolean {
    return /\b(lgpd|gdpr|compliance|regulatorio|auditoria|risco)\b/i.test(text);
  }

  private requiresExternalSignals(text: string): boolean {
    return /\b(api|webhook|integra|conector|externo|third-party)\b/i.test(text);
  }

  private estimateUrgency(text: string, signals: Diagnosis["signals"]): Diagnosis["urgency"] {
    if (/urgente|imediato|critical|cr[ií]tico/.test(text)) return "high";
    if (signals.has_deadline) return "high";
    if (/logo|short-term|prioridade/.test(text)) return "medium";
    return "low";
  }

  private estimateComplexity(
    wordCount: number,
    tags: string[],
    signals: Diagnosis["signals"]
  ): Diagnosis["complexity"] {
    let score = 0;
    if (wordCount > 120) score += 2;
    if (wordCount > 50) score += 1;
    if (tags.length > 2) score += 2;
    if (signals.has_data) score += 1;
    if (signals.requires_external) score += 2;
    if (signals.has_compliance) score += 1;
    if (score >= 5) return "high";
    if (score >= 3) return "medium";
    return "low";
  }

  private extractConstraints(text: string): string[] {
    const constraints: string[] = [];
    const patterns: Array<{ label: string; regex: RegExp }> = [
      { label: "deadline", regex: /até\s+\d+|\bdeadline\b|\bhoje\b|\bamanh[aã]\b/i },
      { label: "budget", regex: /\b(usd|brl|eur|r\$|€|\$)\b|\borcamento\b|\bbudget\b/i },
      { label: "format", regex: /\b(csv|xlsx|json|pdf|ppt|docx)\b/i },
      { label: "language", regex: /\bportugues|ingles|espanhol|french\b/i }
    ];

    for (const pattern of patterns) {
      if (pattern.regex.test(text)) constraints.push(pattern.label);
    }

    return Array.from(new Set(constraints));
  }

  private identifyRisks(
    text: string,
    signals: Diagnosis["signals"],
    constraints: string[]
  ): string[] {
    const risks = new Set<string>();
    if (signals.has_compliance) risks.add("compliance");
    if (signals.requires_external) risks.add("external_dependency");
    if (constraints.includes("deadline")) risks.add("time_constraint");
    if (/sensitive|sigiloso|privado|confidencial/.test(text)) risks.add("sensitive_data");
    return Array.from(risks);
  }

  private buildSummary(
    category: string,
    urgency: Diagnosis["urgency"],
    complexity: Diagnosis["complexity"],
    signals: Diagnosis["signals"],
    constraints: string[]
  ): string {
    const parts = [
      `Categoria: ${category}`,
      `Urgência: ${urgency}`,
      `Complexidade: ${complexity}`
    ];
    if (signals.has_data) parts.push("Dados identificados");
    if (signals.has_budget) parts.push("Orçamento detectado");
    if (constraints.length) parts.push(`Restrições: ${constraints.join(", ")}`);
    return parts.join(" | ");
  }

  private tokenize(text: string): string[] {
    return text.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  }

  private roundTo(value: number, decimals: number): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }
}

if (require.main === module) {
  const tool = new TaskDiagnoser();
  console.log("[AE3:TaskDiagnoser] Testing TaskDiagnoser...\n");

  tool
    .execute({
      text: "Preciso de um resumo do relatório financeiro até amanhã. Orçamento limitado em R$ 5k."
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      console.log("\n[AE3:TaskDiagnoser] ✓ Tests completed");
    })
    .catch((error) => {
      console.error("[AE3:TaskDiagnoser] Test failed", error);
    });
}
