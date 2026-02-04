/**
 * Sentiment Analyzer - AE3 Tool
 *
 * Ferramenta de analise de sentimento com:
 * - Padroes de sentimento em portugues e ingles
 * - Deteccao de intensificadores e negadores
 * - Analise de tom (formal, informal, emocional, analitico)
 * - Calculo de confianca
 * - Analise por aspecto
 *
 * Fase: PROCESSA
 */

import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

// ============================================================================
// Tipos
// ============================================================================

export type SentimentLabel = "positive" | "neutral" | "negative";
export type Tone = "formal" | "informal" | "emotional" | "analytical";
export type Intensity = "mild" | "moderate" | "strong";

export interface SentimentResult {
  /** Label do sentimento */
  label: SentimentLabel;
  /** Score de sentimento (-1 a 1) */
  score: number;
  /** Confianca da analise (0 a 1) */
  confidence: number;
  /** Tom detectado */
  tone: Tone;
  /** Intensidade do sentimento */
  intensity: Intensity;
  /** Analise por aspecto (se habilitada) */
  aspects?: AspectSentiment[];
  /** Palavras-chave que influenciaram a analise */
  keywords: KeywordMatch[];
}

export interface AspectSentiment {
  /** Aspecto identificado */
  aspect: string;
  /** Sentimento do aspecto */
  sentiment: SentimentLabel;
  /** Score do aspecto */
  score: number;
}

export interface KeywordMatch {
  /** Palavra encontrada */
  word: string;
  /** Categoria da palavra */
  category: "positive" | "negative" | "intensifier" | "negator";
  /** Peso da palavra */
  weight: number;
  /** Posicao no texto */
  position: number;
}

export interface SentimentConfig {
  /** Habilitar analise de aspectos */
  enableAspectAnalysis: boolean;
  /** Habilitar deteccao de tom */
  enableToneDetection: boolean;
  /** Idioma preferido */
  language: "pt" | "en" | "auto";
  /** Limiar minimo de confianca */
  minConfidenceThreshold: number;
}

// ============================================================================
// Padroes de Sentimento
// ============================================================================

const SENTIMENT_PATTERNS = {
  positive: {
    strong: [
      "excelente", "fantastico", "maravilhoso", "perfeito", "incrivel", "otimo",
      "espetacular", "excepcional", "extraordinario", "sensacional", "magnifico",
      "excellent", "fantastic", "amazing", "perfect", "incredible", "awesome",
      "outstanding", "wonderful", "brilliant", "superb"
    ],
    moderate: [
      "bom", "legal", "bacana", "positivo", "agradavel", "satisfatorio",
      "gostei", "adorei", "aprovado", "recomendo", "eficiente", "util",
      "good", "nice", "great", "pleasant", "satisfactory", "helpful",
      "effective", "useful", "recommended", "enjoyable"
    ],
    mild: [
      "ok", "razoavel", "aceitavel", "suficiente", "adequado", "correto",
      "okay", "acceptable", "decent", "fine", "alright", "fair"
    ]
  },
  negative: {
    strong: [
      "pessimo", "horrivel", "terrivel", "desastroso", "catastrofico",
      "deploravel", "lamentavel", "inaceitavel", "vergonhoso", "ridiculo",
      "terrible", "horrible", "awful", "disastrous", "catastrophic",
      "deplorable", "unacceptable", "disgraceful", "pathetic"
    ],
    moderate: [
      "ruim", "mau", "negativo", "inadequado", "insatisfatorio", "problematico",
      "decepcionante", "frustrante", "chato", "irritante",
      "bad", "poor", "negative", "inadequate", "unsatisfactory",
      "disappointing", "frustrating", "annoying", "boring"
    ],
    mild: [
      "fraco", "abaixo", "insuficiente", "mediano", "regular",
      "weak", "below", "insufficient", "mediocre", "underwhelming"
    ]
  }
};

const INTENSIFIERS = [
  "muito", "extremamente", "bastante", "super", "demais", "totalmente",
  "completamente", "absolutamente", "realmente", "verdadeiramente",
  "very", "extremely", "really", "absolutely", "completely", "totally",
  "incredibly", "utterly", "highly", "particularly"
];

const NEGATORS = [
  "nao", "nunca", "jamais", "nem", "nenhum", "nada", "sem",
  "not", "never", "no", "none", "nothing", "without", "nor"
];

const FORMAL_INDICATORS = [
  "prezado", "cordialmente", "atenciosamente", "conforme", "mediante",
  "dear", "sincerely", "regards", "hereby", "pursuant"
];

const INFORMAL_INDICATORS = [
  "oi", "ola", "falou", "valeu", "blz", "cara", "mano",
  "hey", "hi", "cool", "dude", "bro", "lol", "omg"
];

const EMOTIONAL_INDICATORS = [
  "!", "?!", "...", "amo", "odeio", "sinto", "chorei",
  "love", "hate", "feel", "cry", "angry", "happy", "sad"
];

const ANALYTICAL_INDICATORS = [
  "portanto", "entretanto", "consequentemente", "analisando", "considerando",
  "therefore", "however", "consequently", "analyzing", "considering"
];

// ============================================================================
// SentimentAnalyzer Class
// ============================================================================

export class SentimentAnalyzer implements Tool {
  id = "T27";
  name = "SentimentAnalyzer";
  phase = "processa" as const;
  version = "2.0.0";

  private config: SentimentConfig;
  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;

  constructor(config?: Partial<SentimentConfig>) {
    this.config = {
      enableAspectAnalysis: config?.enableAspectAnalysis ?? false,
      enableToneDetection: config?.enableToneDetection ?? true,
      language: config?.language ?? "auto",
      minConfidenceThreshold: config?.minConfidenceThreshold ?? 0.3,
    };
  }

  // ==========================================================================
  // Interface Tool
  // ==========================================================================

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      const text = String(input.text ?? "");

      if (!text.trim()) {
        return this.createOutput(false, null, "Texto vazio", startTime);
      }

      const result = this.analyze(text);

      // Verifica confianca minima
      if (result.confidence < this.config.minConfidenceThreshold) {
        result.label = "neutral";
        result.score = 0;
      }

      this.successCount++;
      return this.createOutput(true, result, undefined, startTime);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      return this.createOutput(false, null, errorMessage, startTime);
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount > 0
      ? this.totalDuration / this.executionCount
      : 0;
    const successRate = this.executionCount > 0
      ? this.successCount / this.executionCount
      : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.8 ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: Math.round(avgLatency),
      success_rate: Number(successRate.toFixed(2)),
    };
  }

  // ==========================================================================
  // Analise Principal
  // ==========================================================================

  private analyze(text: string): SentimentResult {
    const normalizedText = text.toLowerCase();
    const words = this.tokenize(normalizedText);

    // Encontra palavras-chave
    const keywords = this.findKeywords(normalizedText, words);

    // Calcula score base
    let score = this.calculateBaseScore(keywords);

    // Aplica modificadores (intensificadores e negadores)
    score = this.applyModifiers(score, keywords, normalizedText);

    // Determina label e intensidade
    const label = this.determineLabel(score);
    const intensity = this.determineIntensity(Math.abs(score));

    // Detecta tom
    const tone = this.config.enableToneDetection
      ? this.detectTone(normalizedText, words)
      : "analytical";

    // Calcula confianca
    const confidence = this.calculateConfidence(keywords, words.length);

    // Analise por aspecto (se habilitada)
    const aspects = this.config.enableAspectAnalysis
      ? this.analyzeAspects(text)
      : undefined;

    return {
      label,
      score: Number(score.toFixed(3)),
      confidence: Number(confidence.toFixed(3)),
      tone,
      intensity,
      aspects,
      keywords,
    };
  }

  // ==========================================================================
  // Tokenizacao e Busca
  // ==========================================================================

  private tokenize(text: string): string[] {
    return text
      .replace(/[^\w\sáéíóúàèìòùâêîôûãõç]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1);
  }

  private findKeywords(text: string, words: string[]): KeywordMatch[] {
    const keywords: KeywordMatch[] = [];

    // Busca positivos
    for (const [level, patterns] of Object.entries(SENTIMENT_PATTERNS.positive)) {
      const weight = level === "strong" ? 1.0 : level === "moderate" ? 0.6 : 0.3;
      for (const pattern of patterns) {
        const position = text.indexOf(pattern);
        if (position !== -1) {
          keywords.push({ word: pattern, category: "positive", weight, position });
        }
      }
    }

    // Busca negativos
    for (const [level, patterns] of Object.entries(SENTIMENT_PATTERNS.negative)) {
      const weight = level === "strong" ? 1.0 : level === "moderate" ? 0.6 : 0.3;
      for (const pattern of patterns) {
        const position = text.indexOf(pattern);
        if (position !== -1) {
          keywords.push({ word: pattern, category: "negative", weight, position });
        }
      }
    }

    // Busca intensificadores
    for (const intensifier of INTENSIFIERS) {
      const position = text.indexOf(intensifier);
      if (position !== -1) {
        keywords.push({ word: intensifier, category: "intensifier", weight: 0.5, position });
      }
    }

    // Busca negadores
    for (const negator of NEGATORS) {
      const position = text.indexOf(negator);
      if (position !== -1) {
        keywords.push({ word: negator, category: "negator", weight: 0.5, position });
      }
    }

    return keywords.sort((a, b) => a.position - b.position);
  }

  // ==========================================================================
  // Calculo de Score
  // ==========================================================================

  private calculateBaseScore(keywords: KeywordMatch[]): number {
    let positiveScore = 0;
    let negativeScore = 0;

    for (const kw of keywords) {
      if (kw.category === "positive") {
        positiveScore += kw.weight;
      } else if (kw.category === "negative") {
        negativeScore += kw.weight;
      }
    }

    // Normaliza para range -1 a 1
    const totalSentiment = positiveScore + negativeScore;
    if (totalSentiment === 0) return 0;

    return (positiveScore - negativeScore) / Math.max(totalSentiment, 1);
  }

  private applyModifiers(score: number, keywords: KeywordMatch[], text: string): number {
    let modifiedScore = score;

    // Encontra intensificadores e negadores
    const intensifiers = keywords.filter((k) => k.category === "intensifier");
    const negators = keywords.filter((k) => k.category === "negator");

    // Aplica intensificadores (aumenta magnitude)
    if (intensifiers.length > 0) {
      const intensifierBoost = Math.min(intensifiers.length * 0.2, 0.5);
      modifiedScore = modifiedScore * (1 + intensifierBoost);
    }

    // Aplica negadores (pode inverter sentimento)
    if (negators.length > 0) {
      // Verifica se negador esta proximo de palavra de sentimento
      for (const negator of negators) {
        const nearbyPositive = keywords.find(
          (k) => k.category === "positive" &&
          Math.abs(k.position - negator.position) < 20
        );
        const nearbyNegative = keywords.find(
          (k) => k.category === "negative" &&
          Math.abs(k.position - negator.position) < 20
        );

        if (nearbyPositive || nearbyNegative) {
          // Negador inverte ou atenua o sentimento
          modifiedScore = -modifiedScore * 0.7;
        }
      }
    }

    // Clamp para range -1 a 1
    return Math.max(-1, Math.min(1, modifiedScore));
  }

  // ==========================================================================
  // Determinacao de Label e Intensidade
  // ==========================================================================

  private determineLabel(score: number): SentimentLabel {
    if (score > 0.15) return "positive";
    if (score < -0.15) return "negative";
    return "neutral";
  }

  private determineIntensity(absoluteScore: number): Intensity {
    if (absoluteScore >= 0.7) return "strong";
    if (absoluteScore >= 0.4) return "moderate";
    return "mild";
  }

  // ==========================================================================
  // Deteccao de Tom
  // ==========================================================================

  private detectTone(text: string, words: string[]): Tone {
    let formalCount = 0;
    let informalCount = 0;
    let emotionalCount = 0;
    let analyticalCount = 0;

    // Conta indicadores de cada tom
    for (const indicator of FORMAL_INDICATORS) {
      if (text.includes(indicator)) formalCount++;
    }

    for (const indicator of INFORMAL_INDICATORS) {
      if (text.includes(indicator)) informalCount++;
    }

    for (const indicator of EMOTIONAL_INDICATORS) {
      if (text.includes(indicator)) emotionalCount++;
    }

    for (const indicator of ANALYTICAL_INDICATORS) {
      if (text.includes(indicator)) analyticalCount++;
    }

    // Conta exclamacoes e interrogacoes como emocional
    const exclamations = (text.match(/!/g) || []).length;
    const questions = (text.match(/\?/g) || []).length;
    emotionalCount += exclamations + questions;

    // Determina tom dominante
    const scores = [
      { tone: "formal" as Tone, score: formalCount },
      { tone: "informal" as Tone, score: informalCount },
      { tone: "emotional" as Tone, score: emotionalCount },
      { tone: "analytical" as Tone, score: analyticalCount },
    ];

    scores.sort((a, b) => b.score - a.score);

    // Se nenhum indicador, assume analitico
    if (scores[0].score === 0) return "analytical";

    return scores[0].tone;
  }

  // ==========================================================================
  // Calculo de Confianca
  // ==========================================================================

  private calculateConfidence(keywords: KeywordMatch[], totalWords: number): number {
    if (totalWords === 0) return 0;

    // Base: proporcao de palavras-chave
    const sentimentKeywords = keywords.filter(
      (k) => k.category === "positive" || k.category === "negative"
    );
    const keywordRatio = Math.min(sentimentKeywords.length / Math.max(totalWords, 1), 1);

    // Bonus por palavras fortes
    const strongKeywords = sentimentKeywords.filter((k) => k.weight >= 0.8);
    const strongBonus = Math.min(strongKeywords.length * 0.1, 0.3);

    // Penalidade por conflito (positivo e negativo juntos)
    const hasPositive = sentimentKeywords.some((k) => k.category === "positive");
    const hasNegative = sentimentKeywords.some((k) => k.category === "negative");
    const conflictPenalty = hasPositive && hasNegative ? 0.2 : 0;

    // Confianca final
    let confidence = keywordRatio * 0.5 + 0.3 + strongBonus - conflictPenalty;

    // Bonus por texto maior (mais contexto)
    if (totalWords > 20) confidence += 0.1;
    if (totalWords > 50) confidence += 0.1;

    return Math.max(0, Math.min(1, confidence));
  }

  // ==========================================================================
  // Analise por Aspecto
  // ==========================================================================

  private analyzeAspects(text: string): AspectSentiment[] {
    const aspects: AspectSentiment[] = [];

    // Divide em sentencas
    const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);

    for (const sentence of sentences) {
      // Identifica possivel aspecto (substantivo no inicio)
      const words = sentence.trim().split(/\s+/);
      if (words.length < 3) continue;

      // Usa primeira palavra significativa como aspecto
      const potentialAspect = words[0].toLowerCase();
      if (potentialAspect.length < 3) continue;

      // Analisa sentimento da sentenca
      const sentenceResult = this.analyze(sentence);

      aspects.push({
        aspect: potentialAspect,
        sentiment: sentenceResult.label,
        score: sentenceResult.score,
      });
    }

    return aspects;
  }

  // ==========================================================================
  // Utilitarios
  // ==========================================================================

  private createOutput(
    success: boolean,
    output: SentimentResult | null,
    error: string | undefined,
    startTime: number
  ): ToolOutput {
    const duration = Date.now() - startTime;
    this.totalDuration += duration;

    return {
      tool_id: this.id,
      tool_name: this.name,
      success,
      output: output ?? undefined,
      error,
      duration_ms: duration,
      timestamp: new Date(),
    };
  }
}

// ============================================================================
// CLI Test Suite
// ============================================================================

if (require.main === module) {
  console.log("[AE3:SentimentAnalyzer] Testando Sentiment Analyzer...\n");

  async function runTests() {
    const analyzer = new SentimentAnalyzer({
      enableAspectAnalysis: true,
      enableToneDetection: true,
    });

    // Teste 1: Sentimento positivo forte
    console.log("=== Teste 1: Positivo Forte ===");
    const positive = await analyzer.execute({
      text: "Este produto é absolutamente fantástico! Excelente qualidade, muito satisfeito!"
    });
    console.log("Resultado:", JSON.stringify(positive.output, null, 2));
    const posResult = positive.output as SentimentResult;
    console.log(posResult?.label === "positive" && posResult?.intensity === "strong"
      ? "✓ Positivo forte detectado"
      : "✗ Erro na deteccao");

    // Teste 2: Sentimento negativo
    console.log("\n=== Teste 2: Negativo ===");
    const negative = await analyzer.execute({
      text: "Péssimo atendimento, produto ruim e decepcionante. Não recomendo."
    });
    console.log("Resultado:", JSON.stringify(negative.output, null, 2));
    const negResult = negative.output as SentimentResult;
    console.log(negResult?.label === "negative"
      ? "✓ Negativo detectado"
      : "✗ Erro na deteccao");

    // Teste 3: Negacao (inverte sentimento)
    console.log("\n=== Teste 3: Negacao ===");
    const negation = await analyzer.execute({
      text: "Não é bom. Não gostei do produto."
    });
    console.log("Resultado:", JSON.stringify(negation.output, null, 2));
    const negationResult = negation.output as SentimentResult;
    console.log(negationResult?.label === "negative" || negationResult?.label === "neutral"
      ? "✓ Negacao aplicada"
      : "✗ Erro na negacao");

    // Teste 4: Tom formal
    console.log("\n=== Teste 4: Tom Formal ===");
    const formal = await analyzer.execute({
      text: "Prezado cliente, conforme solicitado, segue a análise do produto. Atenciosamente."
    });
    console.log("Resultado:", JSON.stringify(formal.output, null, 2));
    const formalResult = formal.output as SentimentResult;
    console.log(formalResult?.tone === "formal"
      ? "✓ Tom formal detectado"
      : "✗ Erro no tom");

    // Teste 5: Tom emocional
    console.log("\n=== Teste 5: Tom Emocional ===");
    const emotional = await analyzer.execute({
      text: "Que maravilha!!! Amei demais!!! Chorei de alegria!!!"
    });
    console.log("Resultado:", JSON.stringify(emotional.output, null, 2));
    const emotionalResult = emotional.output as SentimentResult;
    console.log(emotionalResult?.tone === "emotional"
      ? "✓ Tom emocional detectado"
      : "✗ Erro no tom");

    // Teste 6: Texto neutro
    console.log("\n=== Teste 6: Neutro ===");
    const neutral = await analyzer.execute({
      text: "O produto chegou ontem. A embalagem estava fechada."
    });
    console.log("Resultado:", JSON.stringify(neutral.output, null, 2));
    const neutralResult = neutral.output as SentimentResult;
    console.log(neutralResult?.label === "neutral"
      ? "✓ Neutro detectado"
      : "✗ Erro na deteccao");

    // Teste 7: Ingles
    console.log("\n=== Teste 7: Ingles ===");
    const english = await analyzer.execute({
      text: "This is an absolutely amazing product! I love it! Highly recommended."
    });
    console.log("Resultado:", JSON.stringify(english.output, null, 2));
    const englishResult = english.output as SentimentResult;
    console.log(englishResult?.label === "positive"
      ? "✓ Ingles detectado"
      : "✗ Erro no ingles");

    // Teste 8: Health Check
    console.log("\n=== Teste 8: Health Check ===");
    const health = await analyzer.healthCheck();
    console.log("Health:", JSON.stringify(health, null, 2));
    console.log(health.status === "healthy" ? "✓ Health OK" : "✗ Health degradado");

    console.log("\n[AE3:SentimentAnalyzer] ✓ Testes concluidos");
  }

  runTests().catch(console.error);
}
