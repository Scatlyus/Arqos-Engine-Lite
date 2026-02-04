import type { ClauseConfig, ClauseResult, SubSection, LanguageStyle, OutputFormat } from "./clause-types";

export class ClauseFormatter {
    /**
     * Formata o documento final
     */
    formatDocument(
        clauses: Array<{ title: string; content: string; subsections?: SubSection[] }>,
        tableOfContents: string[] | undefined,
        config: ClauseConfig
    ): string {
        switch (config.format) {
            case "markdown":
                return this.formatMarkdown(clauses, tableOfContents, config);
            case "html":
                return this.formatHTML(clauses, tableOfContents, config);
            case "json":
                return this.formatJSON(clauses, tableOfContents, config);
            case "text":
            default:
                return this.formatText(clauses, tableOfContents, config);
        }
    }

    /**
     * Conta palavras no texto
     */
    countWords(text: string): number {
        return text.split(/\s+/).filter((word) => word.length > 0).length;
    }

    /**
     * Formato: Plain Text
     */
    private formatText(
        clauses: Array<{ title: string; content: string; subsections?: SubSection[] }>,
        tableOfContents: string[] | undefined,
        config: ClauseConfig
    ): string {
        const lines: string[] = [];
        const separator = "=".repeat(80);
        const subSeparator = "-".repeat(60);

        // Header
        if (config.documentTitle) {
            lines.push(separator);
            lines.push(this.centerText(config.documentTitle.toUpperCase(), 80));
            if (config.documentVersion) {
                lines.push(this.centerText(`Versão ${config.documentVersion}`, 80));
            }
            lines.push(separator);
            lines.push("");
        }

        // Effective date
        if (config.effectiveDate) {
            lines.push(`Data de Vigência: ${config.effectiveDate}`);
            lines.push("");
        }

        // Header text
        if (config.headerText) {
            lines.push(config.headerText);
            lines.push("");
        }

        // Table of contents
        if (tableOfContents && tableOfContents.length > 0) {
            lines.push(subSeparator);
            lines.push("ÍNDICE");
            lines.push(subSeparator);
            for (const item of tableOfContents) {
                lines.push(`  ${item}`);
            }
            lines.push("");
        }

        // Clauses
        for (const clause of clauses) {
            lines.push(subSeparator);
            lines.push(clause.title.toUpperCase());
            lines.push(subSeparator);
            lines.push("");
            lines.push(clause.content);
            lines.push("");

            // Subsections
            if (clause.subsections) {
                for (const sub of clause.subsections) {
                    const numbering = sub.numbering ? `${sub.numbering} ` : "  • ";
                    lines.push(`${numbering}${sub.title}`);
                    lines.push(`    ${sub.content}`);
                    lines.push("");
                }
            }
        }

        // Footer
        if (config.footerText) {
            lines.push(separator);
            lines.push(config.footerText);
        }

        lines.push(separator);
        lines.push(this.centerText(`Gerado por Arqos Engine AE3 - ${new Date().toLocaleString()}`, 80));
        lines.push(separator);

        return lines.join("\n");
    }

    /**
     * Formato: Markdown
     */
    private formatMarkdown(
        clauses: Array<{ title: string; content: string; subsections?: SubSection[] }>,
        tableOfContents: string[] | undefined,
        config: ClauseConfig
    ): string {
        const lines: string[] = [];

        // Header
        if (config.documentTitle) {
            lines.push(`# ${config.documentTitle}`);
            if (config.documentVersion) {
                lines.push(`**Versão:** ${config.documentVersion}`);
            }
            lines.push("");
        }

        // Metadata
        if (config.effectiveDate) {
            lines.push(`**Data de Vigência:** ${config.effectiveDate}`);
            lines.push("");
        }

        // Header text
        if (config.headerText) {
            lines.push(config.headerText);
            lines.push("");
        }

        lines.push("---");
        lines.push("");

        // Table of contents
        if (tableOfContents && tableOfContents.length > 0) {
            lines.push("## Índice");
            lines.push("");
            for (const item of tableOfContents) {
                const slug = item
                    .toLowerCase()
                    .replace(/^\d+\.\s*/, "")
                    .replace(/\s+/g, "-");
                lines.push(`- [${item}](#${slug})`);
            }
            lines.push("");
            lines.push("---");
            lines.push("");
        }

        // Clauses
        for (const clause of clauses) {
            lines.push(`## ${clause.title}`);
            lines.push("");
            lines.push(clause.content);
            lines.push("");

            // Subsections
            if (clause.subsections) {
                for (const sub of clause.subsections) {
                    const numbering = sub.numbering ? `**${sub.numbering}** ` : "";
                    lines.push(`### ${numbering}${sub.title}`);
                    lines.push("");
                    lines.push(sub.content);
                    lines.push("");
                }
            }
        }

        // Footer
        if (config.footerText) {
            lines.push("---");
            lines.push("");
            lines.push(config.footerText);
            lines.push("");
        }

        lines.push("---");
        lines.push(`*Gerado por Arqos Engine AE3 - ${new Date().toLocaleString()}*`);

        return lines.join("\n");
    }

    /**
     * Formato: HTML
     */
    private formatHTML(
        clauses: Array<{ title: string; content: string; subsections?: SubSection[] }>,
        tableOfContents: string[] | undefined,
        config: ClauseConfig
    ): string {
        const parts: string[] = [];

        parts.push("<!DOCTYPE html>");
        parts.push("<html lang='pt-BR'>");
        parts.push("<head>");
        parts.push("  <meta charset='UTF-8'>");
        parts.push(`  <title>${this.escapeHTML(config.documentTitle || "Documento Legal")}</title>`);
        parts.push("  <style>");
        parts.push(this.getHTMLStyles());
        parts.push("  </style>");
        parts.push("</head>");
        parts.push("<body>");
        parts.push("  <div class='container'>");

        // Header
        if (config.documentTitle) {
            parts.push("    <header>");
            parts.push(`      <h1>${this.escapeHTML(config.documentTitle)}</h1>`);
            if (config.documentVersion) {
                parts.push(`      <p class='version'>Versão ${this.escapeHTML(config.documentVersion)}</p>`);
            }
            if (config.effectiveDate) {
                parts.push(`      <p class='date'>Data de Vigência: ${this.escapeHTML(config.effectiveDate)}</p>`);
            }
            parts.push("    </header>");
        }

        // Header text
        if (config.headerText) {
            parts.push(`    <div class='intro'>${this.escapeHTML(config.headerText)}</div>`);
        }

        // Table of contents
        if (tableOfContents && tableOfContents.length > 0) {
            parts.push("    <nav class='toc'>");
            parts.push("      <h2>Índice</h2>");
            parts.push("      <ol>");
            for (const item of tableOfContents) {
                const text = item.replace(/^\d+\.\s*/, "");
                const slug = text.toLowerCase().replace(/\s+/g, "-");
                parts.push(`        <li><a href='#${slug}'>${this.escapeHTML(text)}</a></li>`);
            }
            parts.push("      </ol>");
            parts.push("    </nav>");
        }

        // Clauses
        parts.push("    <main>");
        for (const clause of clauses) {
            const slug = clause.title
                .replace(/^\d+\.\s*/, "")
                .toLowerCase()
                .replace(/\s+/g, "-");

            parts.push(`      <section id='${slug}' class='clause'>`);
            parts.push(`        <h2>${this.escapeHTML(clause.title)}</h2>`);
            parts.push(`        <p>${this.escapeHTML(clause.content)}</p>`);

            // Subsections
            if (clause.subsections) {
                parts.push("        <div class='subsections'>");
                for (const sub of clause.subsections) {
                    parts.push("          <div class='subsection'>");
                    const numbering = sub.numbering ? `<span class='num'>${this.escapeHTML(sub.numbering)}</span> ` : "";
                    parts.push(`            <h3>${numbering}${this.escapeHTML(sub.title)}</h3>`);
                    parts.push(`            <p>${this.escapeHTML(sub.content)}</p>`);
                    parts.push("          </div>");
                }
                parts.push("        </div>");
            }

            parts.push("      </section>");
        }
        parts.push("    </main>");

        // Footer
        parts.push("    <footer>");
        if (config.footerText) {
            parts.push(`      <p>${this.escapeHTML(config.footerText)}</p>`);
        }
        parts.push(`      <p class='generated'>Gerado por Arqos Engine AE3 - ${new Date().toLocaleString()}</p>`);
        parts.push("    </footer>");

        parts.push("  </div>");
        parts.push("</body>");
        parts.push("</html>");

        return parts.join("\n");
    }

    /**
     * Formato: JSON
     */
    private formatJSON(
        clauses: Array<{ title: string; content: string; subsections?: SubSection[] }>,
        tableOfContents: string[] | undefined,
        config: ClauseConfig
    ): string {
        const document = {
            metadata: {
                title: config.documentTitle,
                version: config.documentVersion,
                effectiveDate: config.effectiveDate,
                language: config.language,
                style: config.style,
                generatedAt: new Date().toISOString(),
                generator: "Arqos Engine AE3 - ClauseGeneration",
            },
            header: config.headerText,
            tableOfContents,
            clauses: clauses.map((c) => ({
                title: c.title,
                content: c.content,
                subsections: c.subsections,
            })),
            footer: config.footerText,
        };

        return JSON.stringify(document, null, 2);
    }

    // ========== Utilidades ==========

    private getHTMLStyles(): string {
        return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Georgia', 'Times New Roman', serif;
      line-height: 1.8;
      color: #333;
      background: #f9f9f9;
    }
    .container {
      max-width: 800px;
      margin: 40px auto;
      padding: 60px;
      background: white;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 30px;
      border-bottom: 2px solid #1a365d;
    }
    h1 {
      color: #1a365d;
      font-size: 28px;
      margin-bottom: 10px;
      text-transform: uppercase;
      letter-spacing: 2px;
    }
    h2 {
      color: #2c5282;
      font-size: 18px;
      margin: 30px 0 15px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    h3 {
      color: #4a5568;
      font-size: 15px;
      margin: 20px 0 10px;
    }
    p { margin: 10px 0; text-align: justify; }
    .version, .date { color: #718096; font-size: 14px; margin: 5px 0; }
    .intro {
      background: #edf2f7;
      padding: 20px;
      margin: 20px 0;
      border-left: 4px solid #2c5282;
      font-style: italic;
    }
    .toc {
      background: #f7fafc;
      padding: 25px 35px;
      margin: 30px 0;
      border: 1px solid #e2e8f0;
    }
    .toc h2 { margin: 0 0 15px; border: none; }
    .toc ol { padding-left: 25px; }
    .toc li { margin: 8px 0; }
    .toc a { color: #2c5282; text-decoration: none; }
    .toc a:hover { text-decoration: underline; }
    .clause { margin: 35px 0; }
    .subsections { margin-left: 25px; }
    .subsection { margin: 15px 0; }
    .num {
      color: #2c5282;
      font-weight: bold;
    }
    footer {
      margin-top: 50px;
      padding-top: 25px;
      border-top: 2px solid #1a365d;
      text-align: center;
      color: #718096;
      font-size: 13px;
    }
    .generated { font-style: italic; margin-top: 15px; }
    `;
    }

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
}
