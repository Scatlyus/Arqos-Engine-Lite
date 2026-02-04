import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

/**
 * Formatos de relatório suportados
 */
type ReportFormat = "markdown" | "html" | "json" | "text";

/**
 * Estrutura de seção de relatório
 */
type ReportSection = {
  title: string;
  content: string;
  type?: "text" | "table" | "list" | "chart";
  data?: unknown;
};

/**
 * Configuração do relatório
 */
type ReportConfig = {
  title: string;
  subtitle?: string;
  author?: string;
  date?: string | Date;
  format?: ReportFormat;
  sections: ReportSection[];
  metadata?: Record<string, unknown>;
  template?: "default" | "executive" | "technical" | "minimal";
};

type ReportResult = {
  title: string;
  format: ReportFormat;
  content: string;
  metadata: Record<string, unknown>;
  generated_at: Date;
  word_count: number;
  section_count: number;
};

export class ReportGenerator implements Tool {
  id = "T30";
  name = "ReportGenerator";
  phase = "fornece" as const;
  version = "1.0.0";

  private metrics = {
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    totalDuration: 0,
    totalReportsGenerated: 0,
  };

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.metrics.executionCount++;

    try {
      const config = this.parseConfig(input);

      // Gerar conteúdo no formato especificado
      const content = this.generateReport(config);

      // Calcular estatísticas
      const wordCount = this.countWords(content);
      const sectionCount = config.sections.length;

      this.metrics.successCount++;
      this.metrics.totalDuration += Date.now() - startTime;
      this.metrics.totalReportsGenerated++;

      const result: ReportResult = {
        title: config.title,
        format: config.format || "markdown",
        content,
        metadata: {
          author: config.author,
          date: config.date,
          template: config.template,
          ...config.metadata,
        },
        generated_at: new Date(),
        word_count: wordCount,
        section_count: sectionCount,
      };

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
   * Parseia e valida a configuração do relatório
   */
  private parseConfig(input: ToolInput): ReportConfig {
    const config = input as Partial<ReportConfig>;

    if (!config.title) {
      throw new Error("Report title is required");
    }

    if (!config.sections || !Array.isArray(config.sections) || config.sections.length === 0) {
      throw new Error("At least one report section is required");
    }

    // Validar seções
    for (const section of config.sections) {
      if (!section.title) {
        throw new Error("Each section must have a title");
      }
    }

    return {
      title: config.title,
      subtitle: config.subtitle,
      author: config.author,
      date: config.date || new Date().toISOString().split("T")[0],
      format: config.format || "markdown",
      sections: config.sections,
      metadata: config.metadata || {},
      template: config.template || "default",
    };
  }

  /**
   * Gera o relatório no formato especificado
   */
  private generateReport(config: ReportConfig): string {
    switch (config.format) {
      case "markdown":
        return this.generateMarkdown(config);
      case "html":
        return this.generateHTML(config);
      case "json":
        return this.generateJSON(config);
      case "text":
        return this.generateText(config);
      default:
        throw new Error(`Unsupported format: ${config.format}`);
    }
  }

  // ========== Geradores por formato ==========

  /**
   * Gera relatório em Markdown
   */
  private generateMarkdown(config: ReportConfig): string {
    const lines: string[] = [];

    // Header
    lines.push(`# ${config.title}`);
    if (config.subtitle) {
      lines.push(`## ${config.subtitle}`);
    }
    lines.push("");

    // Metadata
    if (config.author || config.date) {
      lines.push("---");
      if (config.author) lines.push(`**Author:** ${config.author}`);
      if (config.date) lines.push(`**Date:** ${config.date}`);
      lines.push("---");
      lines.push("");
    }

    // Sections
    for (const section of config.sections) {
      lines.push(`## ${section.title}`);
      lines.push("");

      if (section.type === "table" && Array.isArray(section.data)) {
        lines.push(this.generateMarkdownTable(section.data));
      } else if (section.type === "list" && Array.isArray(section.data)) {
        for (const item of section.data) {
          lines.push(`- ${String(item)}`);
        }
      } else {
        lines.push(section.content || "");
      }

      lines.push("");
    }

    // Footer
    if (config.template !== "minimal") {
      lines.push("---");
      lines.push(`*Generated by Arqos Engine AE3 on ${new Date().toLocaleString()}*`);
    }

    return lines.join("\n");
  }

  /**
   * Gera tabela em Markdown
   */
  private generateMarkdownTable(data: unknown[]): string {
    if (data.length === 0) return "";

    const rows = data as Record<string, unknown>[];
    const headers = Object.keys(rows[0]);

    const lines: string[] = [];

    // Header row
    lines.push(`| ${headers.join(" | ")} |`);
    lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

    // Data rows
    for (const row of rows) {
      const values = headers.map((header) => String(row[header] ?? ""));
      lines.push(`| ${values.join(" | ")} |`);
    }

    return lines.join("\n");
  }

  /**
   * Gera relatório em HTML
   */
  private generateHTML(config: ReportConfig): string {
    const parts: string[] = [];

    parts.push("<!DOCTYPE html>");
    parts.push("<html lang='en'>");
    parts.push("<head>");
    parts.push("  <meta charset='UTF-8'>");
    parts.push(`  <title>${this.escapeHTML(config.title)}</title>`);
    parts.push("  <style>");
    parts.push(this.getHTMLStyles(config.template!));
    parts.push("  </style>");
    parts.push("</head>");
    parts.push("<body>");

    // Header
    parts.push(`  <h1>${this.escapeHTML(config.title)}</h1>`);
    if (config.subtitle) {
      parts.push(`  <h2>${this.escapeHTML(config.subtitle)}</h2>`);
    }

    // Metadata
    if (config.author || config.date) {
      parts.push("  <div class='metadata'>");
      if (config.author) parts.push(`    <p><strong>Author:</strong> ${this.escapeHTML(config.author)}</p>`);
      if (config.date) parts.push(`    <p><strong>Date:</strong> ${this.escapeHTML(String(config.date))}</p>`);
      parts.push("  </div>");
    }

    // Sections
    for (const section of config.sections) {
      parts.push("  <section>");
      parts.push(`    <h3>${this.escapeHTML(section.title)}</h3>`);

      if (section.type === "table" && Array.isArray(section.data)) {
        parts.push(this.generateHTMLTable(section.data));
      } else if (section.type === "list" && Array.isArray(section.data)) {
        parts.push("    <ul>");
        for (const item of section.data) {
          parts.push(`      <li>${this.escapeHTML(String(item))}</li>`);
        }
        parts.push("    </ul>");
      } else {
        parts.push(`    <p>${this.escapeHTML(section.content || "")}</p>`);
      }

      parts.push("  </section>");
    }

    // Footer
    parts.push("  <footer>");
    parts.push(`    <p><em>Generated by Arqos Engine AE3 on ${new Date().toLocaleString()}</em></p>`);
    parts.push("  </footer>");

    parts.push("</body>");
    parts.push("</html>");

    return parts.join("\n");
  }

  /**
   * Gera tabela em HTML
   */
  private generateHTMLTable(data: unknown[]): string {
    if (data.length === 0) return "";

    const rows = data as Record<string, unknown>[];
    const headers = Object.keys(rows[0]);

    const parts: string[] = [];
    parts.push("    <table>");

    // Header
    parts.push("      <thead><tr>");
    for (const header of headers) {
      parts.push(`        <th>${this.escapeHTML(header)}</th>`);
    }
    parts.push("      </tr></thead>");

    // Body
    parts.push("      <tbody>");
    for (const row of rows) {
      parts.push("        <tr>");
      for (const header of headers) {
        parts.push(`          <td>${this.escapeHTML(String(row[header] ?? ""))}</td>`);
      }
      parts.push("        </tr>");
    }
    parts.push("      </tbody>");

    parts.push("    </table>");

    return parts.join("\n");
  }

  /**
   * Obtém estilos CSS por template
   */
  /**
   * Obtém estilos CSS por template (ATLAS Design System via @arqos/templates)
   */
  private getHTMLStyles(template: string): string {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getReportStyles } = require("../../../../templates/dist");
    return getReportStyles(template);
  }

  /**
   * Gera relatório em JSON
   */
  private generateJSON(config: ReportConfig): string {
    const report = {
      title: config.title,
      subtitle: config.subtitle,
      author: config.author,
      date: config.date,
      template: config.template,
      sections: config.sections,
      metadata: config.metadata,
      generated_at: new Date().toISOString(),
    };

    return JSON.stringify(report, null, 2);
  }

  /**
   * Gera relatório em Plain Text
   */
  private generateText(config: ReportConfig): string {
    const lines: string[] = [];
    const width = 80;

    // Header
    lines.push("=".repeat(width));
    lines.push(this.centerText(config.title, width));
    if (config.subtitle) {
      lines.push(this.centerText(config.subtitle, width));
    }
    lines.push("=".repeat(width));
    lines.push("");

    // Metadata
    if (config.author) lines.push(`Author: ${config.author}`);
    if (config.date) lines.push(`Date: ${config.date}`);
    if (config.author || config.date) lines.push("");

    // Sections
    for (const section of config.sections) {
      lines.push("-".repeat(width));
      lines.push(section.title.toUpperCase());
      lines.push("-".repeat(width));
      lines.push("");

      if (section.type === "list" && Array.isArray(section.data)) {
        for (const item of section.data) {
          lines.push(`  * ${String(item)}`);
        }
      } else {
        lines.push(section.content || "");
      }

      lines.push("");
    }

    // Footer
    lines.push("=".repeat(width));
    lines.push(this.centerText(`Generated by Arqos Engine AE3`, width));
    lines.push(this.centerText(new Date().toLocaleString(), width));
    lines.push("=".repeat(width));

    return lines.join("\n");
  }

  // ========== Utilidades ==========

  private escapeHTML(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  private centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return " ".repeat(padding) + text;
  }

  private countWords(text: string): number {
    return text.split(/\s+/).filter((word) => word.length > 0).length;
  }

  // ========== Métricas e Health Check ==========

  async healthCheck(): Promise<ToolHealth> {
    try {
      // Teste simples de geração
      const testResult = await this.execute({
        title: "Health Check Report",
        sections: [{ title: "Test", content: "Test content" }],
        format: "text",
      });

      const avgLatency =
        this.metrics.successCount > 0
          ? this.metrics.totalDuration / this.metrics.successCount
          : 0;

      const successRate =
        this.metrics.executionCount > 0
          ? this.metrics.successCount / this.metrics.executionCount
          : 0;

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
    };
  }

  resetMetrics(): void {
    this.metrics = {
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      totalReportsGenerated: 0,
    };
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE3:ReportGenerator] Testing Report Generator Tool...\n");

  async function runTests() {
    const tool = new ReportGenerator();

    // Teste 1: Relatório Markdown simples
    console.log("=== Teste 1: Relatório Markdown ===");
    const result1 = await tool.execute({
      title: "Monthly Sales Report",
      subtitle: "Q1 2024",
      author: "Arqos Engine",
      format: "markdown",
      sections: [
        {
          title: "Executive Summary",
          content: "Sales increased by 25% compared to previous quarter.",
        },
        {
          title: "Key Metrics",
          type: "list",
          data: ["Revenue: $1.2M", "New customers: 150", "Churn rate: 5%"],
        },
      ],
    });
    console.log(result1.success ? "✓" : "✗", "Generated");
    if (result1.output) {
      console.log("Word count:", (result1.output as ReportResult).word_count);
      console.log("Content preview:", (result1.output as ReportResult).content.substring(0, 200) + "...");
    }

    // Teste 2: Relatório HTML com tabela
    console.log("\n=== Teste 2: Relatório HTML com Tabela ===");
    const result2 = await tool.execute({
      title: "Performance Dashboard",
      author: "Data Team",
      format: "html",
      template: "executive",
      sections: [
        {
          title: "Metrics Overview",
          type: "table",
          data: [
            { metric: "Uptime", value: "99.9%", status: "Good" },
            { metric: "Response Time", value: "120ms", status: "Excellent" },
            { metric: "Error Rate", value: "0.1%", status: "Good" },
          ],
        },
      ],
    });
    console.log(result2.success ? "✓" : "✗", "Generated");
    if (result2.output) {
      console.log("Format:", (result2.output as ReportResult).format);
      console.log("Sections:", (result2.output as ReportResult).section_count);
    }

    // Teste 3: Relatório JSON
    console.log("\n=== Teste 3: Relatório JSON ===");
    const result3 = await tool.execute({
      title: "API Usage Report",
      format: "json",
      sections: [
        {
          title: "Statistics",
          content: "API calls processed",
          data: { total_calls: 10000, success: 9950, errors: 50 },
        },
      ],
    });
    console.log(result3.success ? "✓" : "✗", "Generated");

    // Teste 4: Relatório Plain Text
    console.log("\n=== Teste 4: Relatório Plain Text ===");
    const result4 = await tool.execute({
      title: "System Status",
      format: "text",
      template: "minimal",
      sections: [
        {
          title: "Current Status",
          content: "All systems operational.",
        },
      ],
    });
    console.log(result4.success ? "✓" : "✗", "Generated");

    // Teste 5: Health Check
    console.log("\n=== Teste 5: Health Check ===");
    const health = await tool.healthCheck();
    console.log(health.status === "healthy" ? "✓" : "✗", "Status:", health.status);

    console.log("\n[AE3:ReportGenerator] ✓ Testes concluídos");
  }

  runTests().catch(console.error);
}
