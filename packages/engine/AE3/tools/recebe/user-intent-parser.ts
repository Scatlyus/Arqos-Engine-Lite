/**
 * UserIntentParser - Extrai intenção estruturada de entrada do usuário
 * Fase: RECEBE (Input & Validation)
 *
 * Responsabilidades:
 * - Analisa texto natural do usuário
 * - Extrai intenção primária e secundária
 * - Identifica entidades (pessoas, locais, datas, valores)
 * - Classifica domínio e urgência
 * - Detecta sentimento e tom
 */

import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

// ========== Tipos ==========

export interface ParsedIntent {
  /** Intenção primária identificada */
  primary: string;
  /** Intenções secundárias */
  secondary: string[];
  /** Domínio detectado */
  domain: string;
  /** Nível de urgência (0-100) */
  urgency: number;
  /** Nível de complexidade (0-100) */
  complexity: number;
  /** Entidades extraídas */
  entities: Entity[];
  /** Sentimento detectado */
  sentiment: Sentiment;
  /** Keywords identificadas */
  keywords: string[];
  /** Texto original */
  originalText: string;
  /** Confiança da análise (0-1) */
  confidence: number;
}

export interface Entity {
  type: EntityType;
  value: string;
  position: [number, number]; // [start, end]
}

export type EntityType =
  | 'person'
  | 'location'
  | 'date'
  | 'time'
  | 'money'
  | 'number'
  | 'email'
  | 'url'
  | 'organization';

export interface Sentiment {
  polarity: 'positive' | 'neutral' | 'negative';
  score: number; // -1 a 1
  tone: 'formal' | 'informal' | 'technical' | 'casual';
}

interface ParserConfig {
  enableEntityExtraction: boolean;
  enableSentimentAnalysis: boolean;
  enableDomainClassification: boolean;
  minConfidenceThreshold: number;
}

// ========== Padrões e Mapeamentos ==========

const INTENT_PATTERNS: Array<{ pattern: RegExp; intent: string; urgency: number }> = [
  // Análise e Relatórios
  { pattern: /(?:analis[ae]|avaliar|examinar|revisar|investigar)/i, intent: 'analysis', urgency: 50 },
  { pattern: /(?:relatório|report|sumário|resumo)/i, intent: 'report', urgency: 40 },
  { pattern: /(?:dashboard|painel|visualiz)/i, intent: 'visualization', urgency: 30 },

  // Ações e Operações
  { pattern: /(?:criar|gerar|construir|desenvolver)/i, intent: 'create', urgency: 60 },
  { pattern: /(?:atualizar|modificar|alterar|mudar)/i, intent: 'update', urgency: 70 },
  { pattern: /(?:deletar|remover|excluir|apagar)/i, intent: 'delete', urgency: 80 },
  { pattern: /(?:executar|rodar|processar|fazer)/i, intent: 'execute', urgency: 65 },

  // Consultas
  { pattern: /(?:buscar|procurar|encontrar|pesquisar)/i, intent: 'search', urgency: 45 },
  { pattern: /(?:listar|mostrar|exibir|ver)/i, intent: 'list', urgency: 30 },
  { pattern: /(?:explicar|como|o que é|ajuda)/i, intent: 'help', urgency: 25 },

  // Urgência e Prioridade
  { pattern: /(?:urgente|emergência|crítico|imediato)/i, intent: 'urgent_action', urgency: 95 },
  { pattern: /(?:alertar|notificar|avisar)/i, intent: 'alert', urgency: 75 },

  // Planejamento
  { pattern: /(?:planejar|agendar|programar|organizar)/i, intent: 'planning', urgency: 50 },
  { pattern: /(?:prever|estimar|projetar|simular)/i, intent: 'prediction', urgency: 55 },
];

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  financial: ['finanças', 'financeiro', 'dinheiro', 'investimento', 'ações', 'bolsa', 'lucro', 'prejuízo', 'receita', 'despesa'],
  data_processing: ['dados', 'análise', 'processar', 'transformar', 'csv', 'excel', 'tabela', 'dataset'],
  health: ['saúde', 'mental', 'terapia', 'paciente', 'diagnóstico', 'sintoma', 'tratamento'],
  marketing: ['marketing', 'campanha', 'anúncio', 'vendas', 'lead', 'conversão', 'cliente'],
  operations: ['operação', 'processo', 'workflow', 'automação', 'tarefa', 'executar'],
  general: ['geral', 'diversos', 'outros', 'ajuda', 'informação'],
};

const SENTIMENT_POSITIVE: string[] = ['ótimo', 'excelente', 'bom', 'perfeito', 'maravilhoso', 'obrigado', 'grato'];
const SENTIMENT_NEGATIVE: string[] = ['ruim', 'péssimo', 'problema', 'erro', 'falha', 'não funciona', 'quebrado'];

const ENTITY_PATTERNS: Record<EntityType, RegExp> = {
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  url: /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_\+.~#?&\/=]*)/gi,
  money: /(?:R\$|USD|\$|€|£)\s*[\d,.]+/gi,
  date: /\b(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\b/g,
  time: /\b(?:\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|am|pm))?)\b/g,
  number: /\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d+)?\b/g,
  person: /\b[A-Z][a-z]+(?:\s[A-Z][a-z]+)+\b/g, // Nome próprio (simplificado)
  location: /(?:em|no|na|para|de)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)/g,
  organization: /\b[A-Z][A-Z0-9&\s]+(?:Inc|Ltd|Corp|S\.A\.|LTDA)?\.?\b/g,
};

// ========== Classe Principal ==========

export class UserIntentParser implements Tool {
  id = "T1";
  name = "UserIntentParser";
  phase = "recebe" as const;
  version = "2.0.0";

  private config: ParserConfig;
  private executionCount = 0;
  private totalDuration = 0;
  private successCount = 0;

  constructor(config: Partial<ParserConfig> = {}) {
    this.config = {
      enableEntityExtraction: true,
      enableSentimentAnalysis: true,
      enableDomainClassification: true,
      minConfidenceThreshold: 0.3,
      ...config,
    };
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      // Extrair texto do input
      const text = this.extractText(input);

      if (!text || text.trim().length === 0) {
        throw new Error('Input text is empty');
      }

      // Parse da intenção
      const parsed = this.parseIntent(text);

      // Validar confiança mínima
      if (parsed.confidence < this.config.minConfidenceThreshold) {
        console.warn(`[UserIntentParser] Low confidence: ${parsed.confidence.toFixed(2)}`);
      }

      const duration = Date.now() - startTime;
      this.totalDuration += duration;
      this.successCount++;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: { parsed },
        duration_ms: duration,
        timestamp: new Date(),
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.totalDuration += duration;
      const message = error instanceof Error ? error.message : 'Unknown error';

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        error: message,
        duration_ms: duration,
        timestamp: new Date(),
      };
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount > 0 ? this.totalDuration / this.executionCount : 0;
    const successRate = this.executionCount > 0 ? this.successCount / this.executionCount : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.8 ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: Math.round(avgLatency),
      success_rate: Number(successRate.toFixed(2)),
    };
  }

  // ========== Métodos Privados ==========

  private extractText(input: ToolInput): string {
    if (typeof input === 'string') return input;
    if (input && typeof input === 'object') {
      return (input as any).text || (input as any).message || (input as any).query || JSON.stringify(input);
    }
    return String(input);
  }

  private parseIntent(text: string): ParsedIntent {
    const normalized = text.toLowerCase();

    // 1. Identificar intenção primária
    const { primary, urgency: intentUrgency } = this.identifyPrimaryIntent(normalized);

    // 2. Identificar domínio
    const domain = this.config.enableDomainClassification
      ? this.identifyDomain(normalized)
      : 'general';

    // 3. Calcular urgência e complexidade
    const urgency = this.calculateUrgency(normalized, intentUrgency);
    const complexity = this.calculateComplexity(text);

    // 4. Extrair entidades
    const entities = this.config.enableEntityExtraction
      ? this.extractEntities(text)
      : [];

    // 5. Analisar sentimento
    const sentiment = this.config.enableSentimentAnalysis
      ? this.analyzeSentiment(normalized)
      : { polarity: 'neutral' as const, score: 0, tone: 'formal' as const };

    // 6. Extrair keywords
    const keywords = this.extractKeywords(normalized);

    // 7. Identificar intenções secundárias
    const secondary = this.identifySecondaryIntents(normalized, primary);

    // 8. Calcular confiança
    const confidence = this.calculateConfidence(primary, domain, entities, keywords);

    return {
      primary,
      secondary,
      domain,
      urgency,
      complexity,
      entities,
      sentiment,
      keywords,
      originalText: text,
      confidence,
    };
  }

  private identifyPrimaryIntent(text: string): { primary: string; urgency: number } {
    for (const { pattern, intent, urgency } of INTENT_PATTERNS) {
      if (pattern.test(text)) {
        return { primary: intent, urgency };
      }
    }
    return { primary: 'unknown', urgency: 50 };
  }

  private identifySecondaryIntents(text: string, primary: string): string[] {
    const secondary: string[] = [];
    for (const { pattern, intent } of INTENT_PATTERNS) {
      if (intent !== primary && pattern.test(text)) {
        secondary.push(intent);
      }
    }
    return secondary.slice(0, 3); // Máximo 3 intenções secundárias
  }

  private identifyDomain(text: string): string {
    const scores: Record<string, number> = {};

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      scores[domain] = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          scores[domain]++;
        }
      }
    }

    const bestDomain = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)[0];

    return bestDomain && bestDomain[1] > 0 ? bestDomain[0] : 'general';
  }

  private calculateUrgency(text: string, intentUrgency: number): number {
    let urgency = intentUrgency;

    // Modificadores de urgência
    if (/urgente|emergência|crítico|imediato|agora|já/i.test(text)) {
      urgency = Math.min(100, urgency + 30);
    }
    if (/quando possível|sem pressa|depois/i.test(text)) {
      urgency = Math.max(0, urgency - 20);
    }
    if (/!{2,}/.test(text)) { // Múltiplos pontos de exclamação
      urgency = Math.min(100, urgency + 15);
    }

    return Math.round(urgency);
  }

  private calculateComplexity(text: string): number {
    let complexity = 30; // Base

    // Tamanho do texto
    const wordCount = text.split(/\s+/).length;
    complexity += Math.min(30, wordCount / 10); // Máximo +30

    // Número de frases
    const sentenceCount = text.split(/[.!?]+/).length;
    complexity += Math.min(20, sentenceCount * 5); // Máximo +20

    // Presença de termos técnicos ou números
    if (/\d{4,}|API|SQL|JSON|regex|algoritmo|arquitetura/i.test(text)) {
      complexity += 20;
    }

    return Math.round(Math.min(100, complexity));
  }

  private extractEntities(text: string): Entity[] {
    const entities: Entity[] = [];

    for (const [type, pattern] of Object.entries(ENTITY_PATTERNS)) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          entities.push({
            type: type as EntityType,
            value: match[0],
            position: [match.index, match.index + match[0].length],
          });
        }
      }
    }

    return entities;
  }

  private analyzeSentiment(text: string): Sentiment {
    let score = 0;

    // Análise de polaridade
    for (const positive of SENTIMENT_POSITIVE) {
      if (text.includes(positive)) score += 0.2;
    }
    for (const negative of SENTIMENT_NEGATIVE) {
      if (text.includes(negative)) score -= 0.2;
    }

    score = Math.max(-1, Math.min(1, score));

    const polarity: 'positive' | 'neutral' | 'negative' =
      score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral';

    // Análise de tom
    const hasFormalMarkers = /prezado|senhor|senhora|atenciosamente|cordialmente/i.test(text);
    const hasTechnicalMarkers = /implementar|configurar|parâmetro|sistema|módulo/i.test(text);
    const hasInformalMarkers = /oi|olá|valeu|beleza|cara/i.test(text);

    let tone: 'formal' | 'informal' | 'technical' | 'casual' = 'casual';
    if (hasFormalMarkers) tone = 'formal';
    else if (hasTechnicalMarkers) tone = 'technical';
    else if (hasInformalMarkers) tone = 'informal';

    return { polarity, score, tone };
  }

  private extractKeywords(text: string): string[] {
    // Remover stop words comuns
    const stopWords = new Set(['o', 'a', 'de', 'da', 'do', 'em', 'para', 'com', 'um', 'uma', 'e', 'é']);

    const words = text
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !stopWords.has(word))
      .slice(0, 10); // Máximo 10 keywords

    return Array.from(new Set(words)); // Remove duplicatas
  }

  private calculateConfidence(
    primary: string,
    domain: string,
    entities: Entity[],
    keywords: string[]
  ): number {
    let confidence = 0.5; // Base

    // Boost se identificou intenção conhecida
    if (primary !== 'unknown') confidence += 0.2;

    // Boost se identificou domínio específico
    if (domain !== 'general') confidence += 0.15;

    // Boost baseado em entidades extraídas
    confidence += Math.min(0.1, entities.length * 0.02);

    // Boost baseado em keywords
    confidence += Math.min(0.05, keywords.length * 0.01);

    return Math.min(1, Number(confidence.toFixed(2)));
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE3:UserIntentParser] Testando UserIntentParser...\n');

  async function runTests() {
    const parser = new UserIntentParser();

    // Teste 1: Intenção simples
    console.log('=== Teste 1: Intenção Simples ===');
    const result1 = await parser.execute({ text: 'Criar um relatório de vendas do último mês' });
    if (result1.success) {
      const parsed = result1.output.parsed as ParsedIntent;
      console.log('Intenção primária:', parsed.primary);
      console.log('Domínio:', parsed.domain);
      console.log('Urgência:', parsed.urgency);
      console.log('Complexidade:', parsed.complexity);
      console.log('Confiança:', parsed.confidence);
      console.log('Keywords:', parsed.keywords);
    }

    // Teste 2: Urgente com entidades
    console.log('\n=== Teste 2: Urgente com Entidades ===');
    const result2 = await parser.execute({
      text: 'URGENTE! Analisar investimento de R$ 50.000 até 15/02/2024. Contatar João Silva em joao@exemplo.com'
    });
    if (result2.success) {
      const parsed = result2.output.parsed as ParsedIntent;
      console.log('Intenção primária:', parsed.primary);
      console.log('Urgência:', parsed.urgency);
      console.log('Entidades extraídas:', parsed.entities.length);
      parsed.entities.forEach(e => console.log(`  - ${e.type}: ${e.value}`));
      console.log('Sentimento:', parsed.sentiment.polarity, `(${parsed.sentiment.score.toFixed(2)})`);
    }

    // Teste 3: Consulta informal
    console.log('\n=== Teste 3: Consulta Informal ===');
    const result3 = await parser.execute({ text: 'Oi! Como faço para buscar os dados do cliente?' });
    if (result3.success) {
      const parsed = result3.output.parsed as ParsedIntent;
      console.log('Intenção primária:', parsed.primary);
      console.log('Intenções secundárias:', parsed.secondary);
      console.log('Tom:', parsed.sentiment.tone);
      console.log('Complexidade:', parsed.complexity);
    }

    // Teste 4: Health check
    console.log('\n=== Teste 4: Health Check ===');
    const health = await parser.healthCheck();
    console.log('Status:', health.status);
    console.log('Latência média:', health.avg_latency_ms, 'ms');
    console.log('Taxa de sucesso:', (health.success_rate * 100).toFixed(0), '%');

    console.log('\n[AE3:UserIntentParser] ✓ Testes concluídos');
  }

  runTests().catch(console.error);
}
