import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";
import { DEFAULT_TEMPLATES, DEFAULT_TITLES } from "./clause-templates";
import { ClauseFormatter } from "./clause-formatter";
import type {
  ClauseType,
  Language,
  LanguageStyle,
  TemplateVariable,
  ClauseDefinition,
  SubSection,
  ClauseConfig,
  ClauseResult,
} from "./clause-types";

// Export types for consumers
export type {
  ClauseType,
  Language,
  ClauseConfig,
  ClauseResult,
  ClauseDefinition,
  SubSection,
  TemplateVariable,
};

export class ClauseGeneration implements Tool {
  id = "T5";
  name = "ClauseGeneration";
  phase = "fornece" as const;
  version = "1.0.0";

  private formatter: ClauseFormatter;

  private metrics = {
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    totalDuration: 0,
    totalClausesGenerated: 0,
    totalWordsGenerated: 0,
  };

  constructor() {
    this.formatter = new ClauseFormatter();
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.metrics.executionCount++;

    try {
      const config = this.parseConfig(input);
      const result = this.generateDocument(config);

      this.metrics.successCount++;
      this.metrics.totalDuration += Date.now() - startTime;
      this.metrics.totalClausesGenerated += result.clauseCount;
      this.metrics.totalWordsGenerated += result.wordCount;

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
   * Parseia e valida a configuração de entrada
   */
  private parseConfig(input: ToolInput): ClauseConfig {
    const config = input as Partial<ClauseConfig>;

    // Validação básica
    if (!config.clauses || !Array.isArray(config.clauses) || config.clauses.length === 0) {
      throw new Error("At least one clause definition is required");
    }

    // Validar cada cláusula
    for (let i = 0; i < config.clauses.length; i++) {
      const clause = config.clauses[i] as ClauseDefinition;
      if (!clause.type) {
        throw new Error(`Clause at index ${i} must have a type`);
      }
      if (clause.type === "custom" && !clause.content && !clause.template) {
        throw new Error(`Custom clause at index ${i} must have content or template`);
      }
    }

    return {
      clauses: config.clauses.map((c: any, idx) => ({
        ...c,
        id: c.id || `clause_${idx + 1}`,
        order: c.order ?? idx,
      })),
      format: config.format || "text",
      style: config.style || "formal",
      language: config.language || "pt_BR",
      documentTitle: config.documentTitle,
      documentVersion: config.documentVersion,
      effectiveDate: config.effectiveDate,
      includeNumbering: config.includeNumbering ?? true,
      includeTableOfContents: config.includeTableOfContents ?? false,
      headerText: config.headerText,
      footerText: config.footerText,
      metadata: config.metadata || {},
    };
  }

  /**
   * Gera o documento completo
   */
  private generateDocument(config: ClauseConfig): ClauseResult {
    // Ordenar cláusulas
    const sortedClauses = [...config.clauses].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Gerar conteúdo de cada cláusula
    const generatedClauses = sortedClauses.map((clause, index) =>
      this.generateClause(clause, index + 1, config)
    );

    // Gerar table of contents se solicitado
    const tableOfContents = config.includeTableOfContents
      ? sortedClauses.map((c, i) => {
        const title = c.title || DEFAULT_TITLES[c.type][config.language!];
        return `${i + 1}. ${title}`;
      })
      : undefined;

    // Formatar documento
    const document = this.formatter.formatDocument(generatedClauses, tableOfContents, config);

    // Calcular estatísticas
    const wordCount = this.formatter.countWords(document);
    const characterCount = document.length;

    return {
      document,
      format: config.format!,
      clauseCount: sortedClauses.length,
      wordCount,
      characterCount,
      generatedAt: new Date(),
      metadata: {
        title: config.documentTitle,
        version: config.documentVersion,
        effectiveDate: config.effectiveDate,
        language: config.language!,
        style: config.style!,
        clauseIds: sortedClauses.map((c) => c.id!),
      },
      tableOfContents,
    };
  }

  /**
   * Gera uma cláusula individual
   */
  private generateClause(
    clause: ClauseDefinition,
    number: number,
    config: ClauseConfig
  ): { title: string; content: string; subsections?: SubSection[] } {
    // Determinar título
    const title = clause.title || DEFAULT_TITLES[clause.type][config.language!];

    // Determinar conteúdo base
    let content = clause.content || clause.template || DEFAULT_TEMPLATES[clause.type][config.language!];

    // Substituir variáveis
    if (clause.variables && clause.variables.length > 0) {
      content = this.replaceVariables(content, clause.variables);
    }

    // Aplicar estilo de linguagem
    content = this.applyStyle(content, config.style!);

    // Adicionar numeração se solicitado
    const formattedTitle = config.includeNumbering ? `${number}. ${title}` : title;

    return {
      title: formattedTitle,
      content,
      subsections: clause.subsections,
    };
  }

  /**
   * Substitui variáveis no template
   */
  private replaceVariables(template: string, variables: TemplateVariable[]): string {
    let result = template;

    for (const variable of variables) {
      const pattern = new RegExp(`\\{\\{\\s*${variable.name}\\s*\\}\\}`, "g");
      result = result.replace(pattern, variable.value);
    }

    // Verificar variáveis não substituídas
    const remaining = result.match(/\{\{\s*\w+\s*\}\}/g);
    if (remaining) {
      const names = remaining.map((r) => r.replace(/[{}]/g, "").trim());
      throw new Error(`Missing required variables: ${names.join(", ")}`);
    }

    return result;
  }

  /**
   * Aplica estilo de linguagem ao texto
   */
  private applyStyle(text: string, style: LanguageStyle): string {
    switch (style) {
      case "formal":
        // Manter texto formal como está
        return text;

      case "semi_formal":
        // Pequenas simplificações
        return text
          .replace(/\bno presente documento\b/gi, "neste documento")
          .replace(/\bherein\b/gi, "here")
          .replace(/\bhereby\b/gi, "")
          .replace(/\bwhereof\b/gi, "of which");

      case "plain":
        // Linguagem mais simples
        return text
          .replace(/\bem conformidade com\b/gi, "de acordo com")
          .replace(/\bin accordance with\b/gi, "following")
          .replace(/\bnotwithstanding\b/gi, "despite")
          .replace(/\bshall\b/gi, "will");

      case "technical":
        // Manter termos técnicos
        return text;

      default:
        return text;
    }
  }

  // ========== Health Check & Metrics ==========

  async healthCheck(): Promise<ToolHealth> {
    try {
      // Teste básico de geração
      const testResult = await this.execute({
        clauses: [{ type: "disclaimer", content: "Test clause content" } as ClauseDefinition],
        format: "text",
      });

      const avgLatency =
        this.metrics.successCount > 0
          ? this.metrics.totalDuration / this.metrics.successCount
          : 0;

      const successRate =
        this.metrics.executionCount > 0
          ? this.metrics.successCount / this.metrics.executionCount
          : 1;

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
      ...this.metrics,
      averageDuration:
        this.metrics.successCount > 0
          ? this.metrics.totalDuration / this.metrics.successCount
          : 0,
      successRate:
        this.metrics.executionCount > 0
          ? this.metrics.successCount / this.metrics.executionCount
          : 0,
      averageWordsPerClause:
        this.metrics.totalClausesGenerated > 0
          ? this.metrics.totalWordsGenerated / this.metrics.totalClausesGenerated
          : 0,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      totalClausesGenerated: 0,
      totalWordsGenerated: 0,
    };
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE3:ClauseGeneration] Testing Clause Generation Tool...\\n");

  async function runTests() {
    const tool = new ClauseGeneration();
    let passed = 0;
    let failed = 0;

    // Teste 1: Cláusula simples em português
    console.log("=== Teste 1: Cláusula Simples (PT-BR, Text) ===");
    try {
      const result1 = await tool.execute({
        documentTitle: "Contrato de Prestação de Serviços",
        documentVersion: "1.0",
        effectiveDate: "01/02/2026",
        language: "pt_BR",
        format: "text",
        clauses: [
          { type: "privacy" },
          { type: "confidentiality" },
          { type: "liability" },
        ],
      });

      if (result1.success && result1.output) {
        const out = result1.output as ClauseResult;
        console.log("✓ Gerado com sucesso");
        console.log(`  Cláusulas: ${out.clauseCount}`);
        console.log(`  Palavras: ${out.wordCount}`);
        console.log(`  Preview:\\n${out.document.substring(0, 300)}...`);
        passed++;
      } else {
        console.log("✗ Falha:", result1.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 2: Documento com variáveis
    console.log("\\n=== Teste 2: Cláusulas com Variáveis ===");
    try {
      const result2 = await tool.execute({
        documentTitle: "Termos de Garantia",
        language: "pt_BR",
        format: "markdown",
        clauses: [
          {
            type: "warranty",
            variables: [{ name: "warranty_period", value: "12 (doze) meses" }],
          },
          {
            type: "termination",
            variables: [{ name: "notice_period", value: "30 (trinta) dias" }],
          },
        ],
      });

      if (result2.success && result2.output) {
        const out = result2.output as ClauseResult;
        console.log("✓ Gerado com sucesso");
        console.log(`  Formato: ${out.format}`);
        console.log(`  Preview:\\n${out.document.substring(0, 400)}...`);
        passed++;
      } else {
        console.log("✗ Falha:", result2.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 3: Documento HTML completo
    console.log("\\n=== Teste 3: Documento HTML Completo ===");
    try {
      const result3 = await tool.execute({
        documentTitle: "Política de Privacidade",
        documentVersion: "2.0",
        language: "pt_BR",
        format: "html",
        includeTableOfContents: true,
        headerText: "Este documento descreve como tratamos seus dados pessoais.",
        footerText: "© 2026 Empresa XYZ. Todos os direitos reservados.",
        clauses: [
          { type: "privacy", title: "Coleta de Dados" },
          { type: "confidentiality", title: "Uso de Informações" },
          {
            type: "custom",
            title: "Cookies",
            content: "Utilizamos cookies para melhorar sua experiência.",
            subsections: [
              { numbering: "3.1", title: "Cookies Essenciais", content: "Necessários para o funcionamento." },
              { numbering: "3.2", title: "Cookies Analíticos", content: "Usados para estatísticas." },
            ],
          },
        ],
      });

      if (result3.success && result3.output) {
        const out = result3.output as ClauseResult;
        console.log("✓ Gerado com sucesso");
        console.log(`  ToC: ${out.tableOfContents?.join(", ")}`);
        console.log(`  Caracteres: ${out.characterCount}`);
        passed++;
      } else {
        console.log("✗ Falha:", result3.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 4: Documento em inglês
    console.log("\\n=== Teste 4: Documento em Inglês (JSON) ===");
    try {
      const result4 = await tool.execute({
        documentTitle: "Terms of Service",
        language: "en_US",
        format: "json",
        style: "plain",
        clauses: [
          { type: "terms_of_service" },
          { type: "disclaimer" },
          { type: "liability" },
        ],
      });

      if (result4.success && result4.output) {
        const out = result4.output as ClauseResult;
        console.log("✓ Gerado com sucesso");
        const parsed = JSON.parse(out.document);
        console.log(`  Language: ${parsed.metadata.language}`);
        console.log(`  Clauses: ${parsed.clauses.length}`);
        passed++;
      } else {
        console.log("✗ Falha:", result4.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 5: Validação de erros
    console.log("\\n=== Teste 5: Validação de Erros ===");
    try {
      const result5 = await tool.execute({
        clauses: [], // Deve falhar: sem cláusulas
      });

      if (!result5.success) {
        console.log("✓ Erro capturado corretamente:", result5.error);
        passed++;
      } else {
        console.log("✗ Deveria ter falhado");
        failed++;
      }
    } catch (e) {
      console.log("✓ Exceção capturada:", e);
      passed++;
    }

    // Teste 6: Health Check
    console.log("\\n=== Teste 6: Health Check ===");
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

    // Teste 7: Métricas
    console.log("\\n=== Teste 7: Métricas ===");
    const metrics = tool.getMetrics();
    console.log(`  Execuções: ${metrics.executionCount}`);
    console.log(`  Sucesso: ${metrics.successCount}`);
    console.log(`  Falhas: ${metrics.failureCount}`);
    console.log(`  Total Cláusulas: ${metrics.totalClausesGenerated}`);
    console.log(`  Total Palavras: ${metrics.totalWordsGenerated}`);
    console.log(`  Média palavras/cláusula: ${metrics.averageWordsPerClause.toFixed(1)}`);
    passed++;

    // Resumo
    console.log("\\n" + "=".repeat(50));
    console.log(`[AE3:ClauseGeneration] Testes: ${passed} passed, ${failed} failed`);
    console.log("=".repeat(50));

    if (failed === 0) {
      console.log("✓ Todos os testes passaram!");
    }
  }

  runTests().catch(console.error);
}
