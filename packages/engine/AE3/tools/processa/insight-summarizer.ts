import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

export class InsightSummarizer implements Tool {
  id = "T4";
  name = "InsightSummarizer";
  phase = "processa" as const;
  version = "2.0.0";

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    const text = String(input.text ?? "");

    if (!text || text.length < 50) {
      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: { summary: text, highlights: [] },
        duration_ms: Date.now() - startTime,
        timestamp: new Date(),
      };
    }

    const summary = this.generateLexicalSummary(text);

    return {
      tool_id: this.id,
      tool_name: this.name,
      success: true,
      output: summary,
      duration_ms: Date.now() - startTime,
      timestamp: new Date(),
    };
  }

  private generateLexicalSummary(text: string) {
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    if (sentences.length <= 2) return { summary: text, highlights: sentences };

    // Simple TF calculation for words
    const words = text.toLowerCase().match(/\w+/g) || [];
    const freq: Record<string, number> = {};
    const stopwords = new Set(["the", "and", "a", "is", "in", "to", "of", "it", "with", "for", "on"]);

    words.forEach(w => {
      if (w.length > 3 && !stopwords.has(w)) {
        freq[w] = (freq[w] || 0) + 1;
      }
    });

    // Score sentences based on word frequency
    const scored = sentences.map(s => {
      const sWords = s.toLowerCase().match(/\w+/g) || [];
      const score = sWords.reduce((acc, w) => acc + (freq[w] || 0), 0) / (sWords.length || 1);
      return { text: s, score };
    });

    // Sort and take top sentences
    const topSentences = scored.sort((a, b) => b.score - a.score).slice(0, 3);
    const highlights = topSentences.map(s => s.text);
    const summary = topSentences.sort((a, b) => sentences.indexOf(a.text) - sentences.indexOf(b.text))
      .map(s => s.text)
      .join(". ") + ".";

    return {
      summary,
      highlights,
      stats: {
        original_length: text.length,
        summary_length: summary.length,
        reduction_ratio: Number((1 - summary.length / text.length).toFixed(2))
      }
    };
  }

  async healthCheck(): Promise<ToolHealth> {
    return {
      tool_name: this.name,
      status: "healthy",
      last_check: new Date(),
      avg_latency_ms: 5,
      success_rate: 1,
    };
  }
}
