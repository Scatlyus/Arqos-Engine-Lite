/**
 * Pattern Matcher - AE3 Processa
 *
 * Ferramenta avancada de correspondencia de padroes:
 * - Correspondencia literal (substring)
 * - Correspondencia regex com grupos capturados
 * - Correspondencia fuzzy com distancia de Levenshtein
 * - Rastreamento de posicoes de match
 * - Multiplas estrategias de matching
 */

import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

// ============================================================================
// Tipos
// ============================================================================

export type MatchType = "literal" | "regex" | "fuzzy";

export interface MatchPosition {
  start: number;
  end: number;
  text: string;
}

export interface PatternMatch {
  pattern: string;
  matched: boolean;
  matchType: MatchType;
  positions: MatchPosition[];
  capturedGroups: Record<string, string>;
  similarity?: number; // Para fuzzy matching (0 a 1)
  matchCount: number;
}

export interface PatternMatcherInput extends ToolInput {
  text?: string;
  patterns?: string[];
  matchType?: MatchType | "auto";
  fuzzyThreshold?: number; // 0 a 1, default 0.7
  caseSensitive?: boolean;
  maxMatches?: number;
}

export interface PatternMatcherOutput {
  text: string;
  matches: PatternMatch[];
  totalMatches: number;
  matchedPatterns: number;
  unmatchedPatterns: string[];
  summary: string;
}

// ============================================================================
// Constantes
// ============================================================================

const DEFAULT_FUZZY_THRESHOLD = 0.7;
const DEFAULT_MAX_MATCHES = 100;

// ============================================================================
// Pattern Matcher
// ============================================================================

export class PatternMatcher implements Tool {
  id = "T28";
  name = "PatternMatcher";
  phase = "processa" as const;
  version = "2.0.0";

  // Metricas
  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;

  // ==========================================================================
  // Execucao Principal
  // ==========================================================================

  async execute(input: PatternMatcherInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      const text = String(input.text ?? "");
      const patterns = Array.isArray(input.patterns) ? input.patterns.map(String) : [];
      const matchType = input.matchType ?? "auto";
      const fuzzyThreshold = input.fuzzyThreshold ?? DEFAULT_FUZZY_THRESHOLD;
      const caseSensitive = input.caseSensitive ?? false;
      const maxMatches = input.maxMatches ?? DEFAULT_MAX_MATCHES;

      const matches: PatternMatch[] = [];
      const unmatchedPatterns: string[] = [];
      let totalMatchCount = 0;

      for (const pattern of patterns) {
        const result = this.matchPattern(
          text,
          pattern,
          matchType,
          fuzzyThreshold,
          caseSensitive,
          maxMatches - totalMatchCount
        );

        matches.push(result);

        if (result.matched) {
          totalMatchCount += result.matchCount;
        } else {
          unmatchedPatterns.push(pattern);
        }

        if (totalMatchCount >= maxMatches) break;
      }

      const matchedPatterns = matches.filter((m) => m.matched).length;
      const summary = this.generateSummary(matches, text);

      const output: PatternMatcherOutput = {
        text,
        matches,
        totalMatches: totalMatchCount,
        matchedPatterns,
        unmatchedPatterns,
        summary,
      };

      const duration = Date.now() - startTime;
      this.successCount++;
      this.totalDuration += duration;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output,
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
  // Matching Principal
  // ==========================================================================

  private matchPattern(
    text: string,
    pattern: string,
    matchType: MatchType | "auto",
    fuzzyThreshold: number,
    caseSensitive: boolean,
    remainingMatches: number
  ): PatternMatch {
    // Determina tipo de match automaticamente
    const effectiveType = matchType === "auto" ? this.detectMatchType(pattern) : matchType;

    switch (effectiveType) {
      case "regex":
        return this.matchRegex(text, pattern, caseSensitive, remainingMatches);
      case "fuzzy":
        return this.matchFuzzy(text, pattern, fuzzyThreshold, caseSensitive);
      case "literal":
      default:
        return this.matchLiteral(text, pattern, caseSensitive, remainingMatches);
    }
  }

  /**
   * Detecta automaticamente o tipo de match baseado no padrao
   */
  private detectMatchType(pattern: string): MatchType {
    // Se contem caracteres regex especiais, trata como regex
    const regexChars = /[.*+?^${}()|[\]\\]/;
    if (regexChars.test(pattern)) {
      return "regex";
    }
    return "literal";
  }

  // ==========================================================================
  // Correspondencia Literal
  // ==========================================================================

  private matchLiteral(
    text: string,
    pattern: string,
    caseSensitive: boolean,
    maxMatches: number
  ): PatternMatch {
    const searchText = caseSensitive ? text : text.toLowerCase();
    const searchPattern = caseSensitive ? pattern : pattern.toLowerCase();

    const positions: MatchPosition[] = [];
    let startIndex = 0;

    while (positions.length < maxMatches) {
      const foundIndex = searchText.indexOf(searchPattern, startIndex);
      if (foundIndex === -1) break;

      positions.push({
        start: foundIndex,
        end: foundIndex + pattern.length,
        text: text.substring(foundIndex, foundIndex + pattern.length),
      });

      startIndex = foundIndex + 1;
    }

    return {
      pattern,
      matched: positions.length > 0,
      matchType: "literal",
      positions,
      capturedGroups: {},
      matchCount: positions.length,
    };
  }

  // ==========================================================================
  // Correspondencia Regex
  // ==========================================================================

  private matchRegex(
    text: string,
    pattern: string,
    caseSensitive: boolean,
    maxMatches: number
  ): PatternMatch {
    try {
      const flags = caseSensitive ? "g" : "gi";
      const regex = new RegExp(pattern, flags);
      const positions: MatchPosition[] = [];
      const capturedGroups: Record<string, string> = {};

      let match: RegExpExecArray | null;
      while ((match = regex.exec(text)) !== null && positions.length < maxMatches) {
        positions.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
        });

        // Captura grupos nomeados e numerados
        if (match.groups) {
          Object.assign(capturedGroups, match.groups);
        }
        for (let i = 1; i < match.length; i++) {
          if (match[i] !== undefined) {
            capturedGroups[`$${i}`] = match[i];
          }
        }

        // Evita loop infinito em regex que match string vazia
        if (match[0].length === 0) {
          regex.lastIndex++;
        }
      }

      return {
        pattern,
        matched: positions.length > 0,
        matchType: "regex",
        positions,
        capturedGroups,
        matchCount: positions.length,
      };
    } catch {
      // Regex invalido, retorna sem match
      return {
        pattern,
        matched: false,
        matchType: "regex",
        positions: [],
        capturedGroups: {},
        matchCount: 0,
      };
    }
  }

  // ==========================================================================
  // Correspondencia Fuzzy
  // ==========================================================================

  private matchFuzzy(
    text: string,
    pattern: string,
    threshold: number,
    caseSensitive: boolean
  ): PatternMatch {
    const searchText = caseSensitive ? text : text.toLowerCase();
    const searchPattern = caseSensitive ? pattern : pattern.toLowerCase();

    // Divide texto em palavras para comparacao
    const words = searchText.split(/\s+/);
    const positions: MatchPosition[] = [];
    let bestSimilarity = 0;

    let currentIndex = 0;
    for (const word of words) {
      const similarity = this.calculateSimilarity(word, searchPattern);

      if (similarity >= threshold) {
        const wordStart = text.toLowerCase().indexOf(word.toLowerCase(), currentIndex);
        if (wordStart !== -1) {
          positions.push({
            start: wordStart,
            end: wordStart + word.length,
            text: text.substring(wordStart, wordStart + word.length),
          });
          currentIndex = wordStart + word.length;
        }
      }

      if (similarity > bestSimilarity) {
        bestSimilarity = similarity;
      }
    }

    // Tambem verifica substrings para padroes maiores
    if (searchPattern.length > 3) {
      for (let i = 0; i <= searchText.length - searchPattern.length; i++) {
        const substring = searchText.substring(i, i + searchPattern.length);
        const similarity = this.calculateSimilarity(substring, searchPattern);

        if (similarity >= threshold && similarity > bestSimilarity) {
          bestSimilarity = similarity;
          // Adiciona se nao sobrepoe posicoes existentes
          const overlaps = positions.some(
            (p) => (i >= p.start && i < p.end) || (i + searchPattern.length > p.start && i + searchPattern.length <= p.end)
          );
          if (!overlaps) {
            positions.push({
              start: i,
              end: i + searchPattern.length,
              text: text.substring(i, i + searchPattern.length),
            });
          }
        }
      }
    }

    return {
      pattern,
      matched: positions.length > 0,
      matchType: "fuzzy",
      positions,
      capturedGroups: {},
      similarity: bestSimilarity,
      matchCount: positions.length,
    };
  }

  /**
   * Calcula similaridade entre duas strings usando distancia de Levenshtein normalizada
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);

    return 1 - distance / maxLength;
  }

  /**
   * Calcula distancia de Levenshtein entre duas strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;

    // Matriz de distancias
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    // Inicializa primeira coluna e linha
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    // Preenche matriz
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,     // Delecao
          dp[i][j - 1] + 1,     // Insercao
          dp[i - 1][j - 1] + cost // Substituicao
        );
      }
    }

    return dp[m][n];
  }

  // ==========================================================================
  // Utilitarios
  // ==========================================================================

  private generateSummary(matches: PatternMatch[], text: string): string {
    const total = matches.length;
    const matched = matches.filter((m) => m.matched).length;
    const totalPositions = matches.reduce((sum, m) => sum + m.matchCount, 0);

    const parts: string[] = [];
    parts.push(`${matched}/${total} padroes encontrados`);
    parts.push(`${totalPositions} correspondencias totais`);

    if (text.length > 0) {
      parts.push(`em texto de ${text.length} caracteres`);
    }

    // Menciona tipos usados
    const types = new Set(matches.map((m) => m.matchType));
    if (types.size > 0) {
      parts.push(`(${[...types].join(", ")})`);
    }

    return parts.join(" ");
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount > 0
      ? this.totalDuration / this.executionCount
      : 5;
    const successRate = this.executionCount > 0
      ? this.successCount / this.executionCount
      : 1;

    // Teste rapido de sanidade
    const testResult = await this.execute({
      text: "teste de pattern matching",
      patterns: ["pattern", "test.*"],
      matchType: "auto",
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
  console.log("[AE3:PatternMatcher] Testando Pattern Matcher...\n");

  async function runTests() {
    const matcher = new PatternMatcher();

    // Teste 1: Correspondencia literal
    console.log("=== Teste 1: Correspondencia Literal ===");
    const literal = await matcher.execute({
      text: "O sistema funciona de forma eficiente e o sistema responde rapido",
      patterns: ["sistema", "eficiente"],
      matchType: "literal",
    });
    const literalOut = literal.output as PatternMatcherOutput;
    console.log("Matches:", literalOut.matches.map((m) => `${m.pattern}: ${m.matchCount}x`));
    console.log(literalOut.matchedPatterns === 2 ? "✓ Literal OK" : "✗ Erro");

    // Teste 2: Correspondencia regex
    console.log("\n=== Teste 2: Correspondencia Regex ===");
    const regex = await matcher.execute({
      text: "Email: joao@email.com e maria@empresa.org",
      patterns: ["\\w+@\\w+\\.\\w+"],
      matchType: "regex",
    });
    const regexOut = regex.output as PatternMatcherOutput;
    console.log("Emails encontrados:", regexOut.matches[0]?.positions.map((p) => p.text));
    console.log(regexOut.matches[0]?.matchCount === 2 ? "✓ Regex OK" : "✗ Erro");

    // Teste 3: Grupos capturados
    console.log("\n=== Teste 3: Grupos Capturados ===");
    const groups = await matcher.execute({
      text: "Data: 2024-01-15",
      patterns: ["(\\d{4})-(\\d{2})-(\\d{2})"],
      matchType: "regex",
    });
    const groupsOut = groups.output as PatternMatcherOutput;
    console.log("Grupos:", groupsOut.matches[0]?.capturedGroups);
    console.log(groupsOut.matches[0]?.capturedGroups["$1"] === "2024" ? "✓ Grupos OK" : "✗ Erro");

    // Teste 4: Correspondencia fuzzy
    console.log("\n=== Teste 4: Correspondencia Fuzzy ===");
    const fuzzy = await matcher.execute({
      text: "O programador desenvolveu o sistema",
      patterns: ["programdor", "sistma"], // Com erros de digitacao
      matchType: "fuzzy",
      fuzzyThreshold: 0.7,
    });
    const fuzzyOut = fuzzy.output as PatternMatcherOutput;
    console.log("Fuzzy matches:", fuzzyOut.matches.map((m) => `${m.pattern}: ${m.matched} (${m.similarity?.toFixed(2)})`));
    console.log(fuzzyOut.matchedPatterns >= 1 ? "✓ Fuzzy OK" : "✗ Erro");

    // Teste 5: Deteccao automatica
    console.log("\n=== Teste 5: Deteccao Automatica ===");
    const auto = await matcher.execute({
      text: "Teste 123 do sistema",
      patterns: ["sistema", "\\d+"], // Literal e regex
      matchType: "auto",
    });
    const autoOut = auto.output as PatternMatcherOutput;
    console.log("Tipos detectados:", autoOut.matches.map((m) => `${m.pattern}: ${m.matchType}`));
    console.log(autoOut.matchedPatterns === 2 ? "✓ Auto OK" : "✗ Erro");

    // Teste 6: Case insensitive
    console.log("\n=== Teste 6: Case Insensitive ===");
    const caseTest = await matcher.execute({
      text: "SISTEMA Sistema sistema",
      patterns: ["Sistema"],
      matchType: "literal",
      caseSensitive: false,
    });
    const caseOut = caseTest.output as PatternMatcherOutput;
    console.log("Matches (case insensitive):", caseOut.matches[0]?.matchCount);
    console.log(caseOut.matches[0]?.matchCount === 3 ? "✓ Case OK" : "✗ Erro");

    // Teste 7: Levenshtein distance
    console.log("\n=== Teste 7: Levenshtein Distance ===");
    const pm = new PatternMatcher();
    // Acessa metodo privado para teste
    const dist = (pm as any).levenshteinDistance("kitten", "sitting");
    console.log("Distancia kitten->sitting:", dist);
    console.log(dist === 3 ? "✓ Levenshtein OK" : "✗ Erro");

    // Teste 8: Health check
    console.log("\n=== Teste 8: Health Check ===");
    const health = await matcher.healthCheck();
    console.log("Status:", health.status);
    console.log("Execucoes:", health.details?.executions);
    console.log(health.status === "healthy" ? "✓ Health OK" : "✗ Erro");

    console.log("\n[AE3:PatternMatcher] ✓ Testes concluidos");
  }

  runTests().catch(console.error);
}
