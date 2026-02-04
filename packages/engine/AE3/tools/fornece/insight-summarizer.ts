/**
 * Insight Summarizer - AE3 Fornece
 *
 * Ferramenta de sumarizacao e extracao de insights:
 * - Sumarizacao extrativa baseada em pontuacao de sentencas
 * - Extracao de insights-chave com importancia
 * - Identificacao de topicos
 * - Calculo de taxa de compressao
 * - Contagem de palavras original vs resumo
 */

import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

// ============================================================================
// Tipos
// ============================================================================

export type InsightImportance = "critical" | "high" | "medium" | "low";

export interface Insight {
  text: string;
  importance: InsightImportance;
  category: string;
  confidence: number;
  keywords: string[];
}

export interface SummaryResult {
  summary: string;
  keyInsights: Insight[];
  wordCount: {
    original: number;
    summary: number;
  };
  compressionRatio: number;
  topics: string[];
  sentenceCount: {
    original: number;
    summary: number;
  };
}

export interface InsightSummarizerInput extends ToolInput {
  text?: string;
  maxSentences?: number;
  targetCompressionRatio?: number; // 0 a 1 (ex: 0.3 = 30% do original)
  extractInsights?: boolean;
  identifyTopics?: boolean;
}

interface ScoredSentence {
  text: string;
  score: number;
  position: number;
  wordCount: number;
}

// ============================================================================
// Constantes
// ============================================================================

const DEFAULT_MAX_SENTENCES = 5;
const DEFAULT_COMPRESSION_RATIO = 0.3;

// Palavras-chave de importancia
const IMPORTANCE_KEYWORDS: Record<InsightImportance, string[]> = {
  critical: [
    "urgente", "critico", "imediato", "emergencia", "fatal", "grave",
    "urgent", "critical", "immediate", "emergency", "fatal", "severe",
  ],
  high: [
    "importante", "essencial", "necessario", "fundamental", "principal",
    "important", "essential", "necessary", "fundamental", "main", "key",
  ],
  medium: [
    "relevante", "significativo", "notavel", "consideravel",
    "relevant", "significant", "notable", "considerable",
  ],
  low: [
    "menor", "secundario", "opcional", "adicional",
    "minor", "secondary", "optional", "additional",
  ],
};

// Categorias de insights
const INSIGHT_CATEGORIES: Record<string, string[]> = {
  problema: ["problema", "erro", "falha", "bug", "issue", "problem", "error", "failure"],
  solucao: ["solucao", "resolver", "corrigir", "fix", "solution", "resolve"],
  acao: ["fazer", "implementar", "criar", "executar", "do", "implement", "create", "execute"],
  resultado: ["resultado", "output", "saida", "retorno", "result", "outcome"],
  metrica: ["porcentagem", "taxa", "numero", "quantidade", "percentage", "rate", "number"],
  tempo: ["prazo", "deadline", "data", "quando", "date", "when", "deadline"],
  risco: ["risco", "perigo", "ameaca", "vulnerabilidade", "risk", "danger", "threat"],
};

// Stopwords para nao contar como relevantes
const STOPWORDS = new Set([
  "a", "o", "e", "de", "da", "do", "em", "para", "com", "que", "um", "uma",
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
  "se", "por", "como", "mais", "ou", "ao", "dos", "das", "na", "no", "nos",
]);

// ============================================================================
// Insight Summarizer
// ============================================================================

export class InsightSummarizer implements Tool {
  id = "T24";
  name = "InsightSummarizer";
  phase = "fornece" as const;
  version = "2.0.0";

  // Metricas
  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;

  // ==========================================================================
  // Execucao Principal
  // ==========================================================================

  async execute(input: InsightSummarizerInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      const text = String(input.text ?? "");
      const maxSentences = input.maxSentences ?? DEFAULT_MAX_SENTENCES;
      const targetRatio = input.targetCompressionRatio ?? DEFAULT_COMPRESSION_RATIO;
      const extractInsights = input.extractInsights ?? true;
      const identifyTopics = input.identifyTopics ?? true;

      // Extrai e pontua sentencas
      const sentences = this.extractSentences(text);
      const scoredSentences = this.scoreSentences(sentences, text);

      // Seleciona melhores sentencas para o resumo
      const selectedSentences = this.selectTopSentences(
        scoredSentences,
        maxSentences,
        targetRatio,
        this.countWords(text)
      );

      // Gera resumo
      const summary = selectedSentences
        .sort((a, b) => a.position - b.position) // Mantem ordem original
        .map((s) => s.text)
        .join(" ");

      // Extrai insights se solicitado
      const keyInsights = extractInsights ? this.extractKeyInsights(text, sentences) : [];

      // Identifica topicos se solicitado
      const topics = identifyTopics ? this.identifyTopics(text) : [];

      // Calcula metricas
      const originalWordCount = this.countWords(text);
      const summaryWordCount = this.countWords(summary);
      const compressionRatio = originalWordCount > 0
        ? summaryWordCount / originalWordCount
        : 1;

      const result: SummaryResult = {
        summary,
        keyInsights,
        wordCount: {
          original: originalWordCount,
          summary: summaryWordCount,
        },
        compressionRatio: Number(compressionRatio.toFixed(3)),
        topics,
        sentenceCount: {
          original: sentences.length,
          summary: selectedSentences.length,
        },
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
  // Extracao de Sentencas
  // ==========================================================================

  private extractSentences(text: string): string[] {
    // Divide por pontuacao final, mantendo o delimitador
    const sentenceRegex = /[^.!?]*[.!?]+/g;
    const matches = text.match(sentenceRegex) || [];

    return matches
      .map((s) => s.trim())
      .filter((s) => s.length > 10); // Remove sentencas muito curtas
  }

  // ==========================================================================
  // Pontuacao de Sentencas
  // ==========================================================================

  private scoreSentences(sentences: string[], fullText: string): ScoredSentence[] {
    const wordFrequency = this.calculateWordFrequency(fullText);
    const maxFreq = Math.max(...Object.values(wordFrequency), 1);

    return sentences.map((sentence, index) => {
      let score = 0;

      // 1. Pontuacao por frequencia de palavras importantes
      const words = this.tokenize(sentence);
      for (const word of words) {
        if (wordFrequency[word]) {
          score += wordFrequency[word] / maxFreq;
        }
      }
      score = words.length > 0 ? score / words.length : 0;

      // 2. Bonus por posicao (primeiras e ultimas sentencas sao mais importantes)
      const positionBonus = this.calculatePositionBonus(index, sentences.length);
      score += positionBonus * 0.2;

      // 3. Bonus por conter palavras-chave de importancia
      const importanceBonus = this.calculateImportanceBonus(sentence);
      score += importanceBonus * 0.3;

      // 4. Penalidade por sentencas muito longas ou muito curtas
      const lengthPenalty = this.calculateLengthPenalty(words.length);
      score *= lengthPenalty;

      return {
        text: sentence,
        score,
        position: index,
        wordCount: words.length,
      };
    });
  }

  private calculateWordFrequency(text: string): Record<string, number> {
    const words = this.tokenize(text);
    const frequency: Record<string, number> = {};

    for (const word of words) {
      if (!STOPWORDS.has(word)) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
    }

    return frequency;
  }

  private calculatePositionBonus(index: number, total: number): number {
    // Primeira sentenca tem bonus maximo, ultima tem bonus medio
    if (index === 0) return 1.0;
    if (index === total - 1) return 0.5;
    if (index === 1) return 0.7;
    return 0.3;
  }

  private calculateImportanceBonus(sentence: string): number {
    const lower = sentence.toLowerCase();
    let bonus = 0;

    if (IMPORTANCE_KEYWORDS.critical.some((k) => lower.includes(k))) bonus = 1.0;
    else if (IMPORTANCE_KEYWORDS.high.some((k) => lower.includes(k))) bonus = 0.7;
    else if (IMPORTANCE_KEYWORDS.medium.some((k) => lower.includes(k))) bonus = 0.4;

    return bonus;
  }

  private calculateLengthPenalty(wordCount: number): number {
    // Sentencas ideais tem entre 10-30 palavras
    if (wordCount >= 10 && wordCount <= 30) return 1.0;
    if (wordCount < 5) return 0.5;
    if (wordCount > 50) return 0.7;
    return 0.85;
  }

  // ==========================================================================
  // Selecao de Sentencas
  // ==========================================================================

  private selectTopSentences(
    scored: ScoredSentence[],
    maxSentences: number,
    targetRatio: number,
    totalWords: number
  ): ScoredSentence[] {
    // Ordena por score (maior primeiro)
    const sorted = [...scored].sort((a, b) => b.score - a.score);

    const targetWords = Math.ceil(totalWords * targetRatio);
    const selected: ScoredSentence[] = [];
    let currentWords = 0;

    for (const sentence of sorted) {
      if (selected.length >= maxSentences) break;
      if (currentWords >= targetWords) break;

      selected.push(sentence);
      currentWords += sentence.wordCount;
    }

    return selected;
  }

  // ==========================================================================
  // Extracao de Insights
  // ==========================================================================

  private extractKeyInsights(text: string, sentences: string[]): Insight[] {
    const insights: Insight[] = [];

    for (const sentence of sentences) {
      const importance = this.determineImportance(sentence);
      const category = this.determineCategory(sentence);
      const keywords = this.extractKeywords(sentence);

      // So adiciona se tiver importancia media ou maior
      if (importance !== "low" || keywords.length >= 3) {
        const confidence = this.calculateInsightConfidence(sentence, keywords, importance);

        insights.push({
          text: sentence,
          importance,
          category,
          confidence: Number(confidence.toFixed(2)),
          keywords,
        });
      }
    }

    // Ordena por importancia e limita
    const importanceOrder: Record<InsightImportance, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return insights
      .sort((a, b) => importanceOrder[b.importance] - importanceOrder[a.importance])
      .slice(0, 10);
  }

  private determineImportance(text: string): InsightImportance {
    const lower = text.toLowerCase();

    for (const level of ["critical", "high", "medium", "low"] as InsightImportance[]) {
      if (IMPORTANCE_KEYWORDS[level].some((k) => lower.includes(k))) {
        return level;
      }
    }

    return "low";
  }

  private determineCategory(text: string): string {
    const lower = text.toLowerCase();

    for (const [category, keywords] of Object.entries(INSIGHT_CATEGORIES)) {
      if (keywords.some((k) => lower.includes(k))) {
        return category;
      }
    }

    return "geral";
  }

  private extractKeywords(text: string): string[] {
    const words = this.tokenize(text);
    const keywords: string[] = [];

    for (const word of words) {
      if (!STOPWORDS.has(word) && word.length > 3) {
        keywords.push(word);
      }
    }

    // Remove duplicatas e limita
    return [...new Set(keywords)].slice(0, 5);
  }

  private calculateInsightConfidence(
    text: string,
    keywords: string[],
    importance: InsightImportance
  ): number {
    let confidence = 0.5;

    // Mais keywords = maior confianca
    confidence += Math.min(keywords.length * 0.1, 0.3);

    // Importancia maior = maior confianca
    const importanceBoost: Record<InsightImportance, number> = {
      critical: 0.2,
      high: 0.15,
      medium: 0.1,
      low: 0,
    };
    confidence += importanceBoost[importance];

    // Sentenca mais longa (mas nao excessiva) = maior confianca
    const wordCount = this.countWords(text);
    if (wordCount >= 10 && wordCount <= 30) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1);
  }

  // ==========================================================================
  // Identificacao de Topicos
  // ==========================================================================

  private identifyTopics(text: string): string[] {
    const frequency = this.calculateWordFrequency(text);
    const sortedWords = Object.entries(frequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);

    // Agrupa palavras similares como topicos
    const topics: string[] = [];
    const used = new Set<string>();

    for (const word of sortedWords) {
      if (!used.has(word) && word.length > 3) {
        topics.push(word);
        used.add(word);

        // Marca palavras similares como usadas
        for (const other of sortedWords) {
          if (this.areSimilar(word, other)) {
            used.add(other);
          }
        }
      }
    }

    return topics.slice(0, 5);
  }

  private areSimilar(word1: string, word2: string): boolean {
    // Verifica se uma palavra e prefixo da outra (ex: "sistema", "sistemas")
    if (word1.length < 4 || word2.length < 4) return false;
    const shorter = word1.length < word2.length ? word1 : word2;
    const longer = word1.length < word2.length ? word2 : word1;
    return longer.startsWith(shorter.slice(0, -1));
  }

  // ==========================================================================
  // Utilitarios
  // ==========================================================================

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 0);
  }

  private countWords(text: string): number {
    return this.tokenize(text).length;
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
      text: "Este e um teste importante. O sistema funciona bem. Resultado positivo.",
      maxSentences: 2,
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
  console.log("[AE3:InsightSummarizer] Testando Insight Summarizer...\n");

  async function runTests() {
    const summarizer = new InsightSummarizer();

    // Texto de teste
    const testText = `
      O sistema de processamento apresentou problemas criticos ontem.
      A taxa de erro aumentou para 15%, o que e muito preocupante.
      Nossa equipe identificou a causa raiz do problema na integracao com a API externa.
      A solucao implementada foi adicionar retry com backoff exponencial.
      Apos a correcao, o sistema voltou a operar normalmente.
      Os resultados mostram uma melhoria significativa na estabilidade.
      Recomendamos monitorar de perto nas proximas 48 horas.
      O prazo para o proximo release e dia 15 do mes corrente.
    `;

    // Teste 1: Sumarizacao basica
    console.log("=== Teste 1: Sumarizacao Basica ===");
    const basic = await summarizer.execute({ text: testText, maxSentences: 3 });
    const basicOut = basic.output as SummaryResult;
    console.log("Resumo:", basicOut.summary.substring(0, 100) + "...");
    console.log("Palavras:", basicOut.wordCount);
    console.log("Compressao:", (basicOut.compressionRatio * 100).toFixed(1) + "%");
    console.log(basicOut.compressionRatio < 0.5 ? "✓ Sumarizacao OK" : "✗ Erro");

    // Teste 2: Extracao de insights
    console.log("\n=== Teste 2: Extracao de Insights ===");
    const insights = await summarizer.execute({
      text: testText,
      extractInsights: true,
    });
    const insightsOut = insights.output as SummaryResult;
    console.log("Insights encontrados:", insightsOut.keyInsights.length);
    for (const insight of insightsOut.keyInsights.slice(0, 3)) {
      console.log(`  - [${insight.importance}] ${insight.category}: ${insight.text.substring(0, 50)}...`);
    }
    console.log(insightsOut.keyInsights.length > 0 ? "✓ Insights OK" : "✗ Erro");

    // Teste 3: Identificacao de topicos
    console.log("\n=== Teste 3: Identificacao de Topicos ===");
    const topics = await summarizer.execute({
      text: testText,
      identifyTopics: true,
    });
    const topicsOut = topics.output as SummaryResult;
    console.log("Topicos:", topicsOut.topics);
    console.log(topicsOut.topics.length > 0 ? "✓ Topicos OK" : "✗ Erro");

    // Teste 4: Compressao customizada
    console.log("\n=== Teste 4: Compressao Customizada ===");
    const compressed = await summarizer.execute({
      text: testText,
      targetCompressionRatio: 0.2,
    });
    const compressedOut = compressed.output as SummaryResult;
    console.log("Taxa alvo: 20%");
    console.log("Taxa obtida:", (compressedOut.compressionRatio * 100).toFixed(1) + "%");
    console.log(compressedOut.compressionRatio <= 0.35 ? "✓ Compressao OK" : "✗ Erro");

    // Teste 5: Texto curto
    console.log("\n=== Teste 5: Texto Curto ===");
    const short = await summarizer.execute({
      text: "Apenas uma sentenca curta.",
    });
    const shortOut = short.output as SummaryResult;
    console.log("Sentencas originais:", shortOut.sentenceCount.original);
    console.log("Sentencas no resumo:", shortOut.sentenceCount.summary);
    console.log(short.success ? "✓ Texto curto OK" : "✗ Erro");

    // Teste 6: Importancia de insights
    console.log("\n=== Teste 6: Importancia de Insights ===");
    const importantText = `
      Alerta critico: o servidor principal esta fora do ar.
      Isso e importante para o negocio.
      Uma observacao menor sobre a documentacao.
    `;
    const important = await summarizer.execute({ text: importantText });
    const importantOut = important.output as SummaryResult;
    const criticalInsights = importantOut.keyInsights.filter((i) => i.importance === "critical");
    console.log("Insights criticos:", criticalInsights.length);
    console.log(criticalInsights.length > 0 ? "✓ Importancia OK" : "✗ Erro");

    // Teste 7: Contagem de palavras
    console.log("\n=== Teste 7: Contagem de Palavras ===");
    const wordTest = "Uma dois tres quatro cinco seis sete oito nove dez.";
    const words = await summarizer.execute({ text: wordTest });
    const wordsOut = words.output as SummaryResult;
    console.log("Palavras contadas:", wordsOut.wordCount.original);
    console.log(wordsOut.wordCount.original === 10 ? "✓ Contagem OK" : "✗ Erro");

    // Teste 8: Health check
    console.log("\n=== Teste 8: Health Check ===");
    const health = await summarizer.healthCheck();
    console.log("Status:", health.status);
    console.log("Execucoes:", health.details?.executions);
    console.log(health.status === "healthy" ? "✓ Health OK" : "✗ Erro");

    console.log("\n[AE3:InsightSummarizer] ✓ Testes concluidos");
  }

  runTests().catch(console.error);
}
