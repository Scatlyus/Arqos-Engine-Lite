/**
 * ChainOfThoughtGenerator - Gerador de Raciocínio Passo-a-Passo
 * Fase: PROCESSA (Transformation & Analysis)
 *
 * Responsabilidades:
 * - Decompor problemas complexos em passos menores
 * - Gerar raciocínio estruturado (Thought → Action → Observation)
 * - Identificar dependências entre passos
 * - Validar coerência lógica
 * - Produzir conclusão fundamentada
 */

import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

// ========== Tipos ==========

export interface ReasoningStep {
  /** Número do passo (1-indexed) */
  step_number: number;
  /** Pensamento/análise do passo */
  thought: string;
  /** Ação a ser tomada */
  action: string;
  /** Observação/resultado esperado */
  observation: string;
  /** Dependências de outros passos */
  dependencies: number[];
  /** Confiança neste passo (0-1) */
  confidence: number;
  /** Tipo de raciocínio */
  type: ReasoningType;
}

export type ReasoningType =
  | 'analysis'      // Análise de informação
  | 'decomposition' // Quebra de problema
  | 'hypothesis'    // Formulação de hipótese
  | 'validation'    // Validação de premissa
  | 'synthesis'     // Síntese de conclusão
  | 'decision'      // Tomada de decisão
  | 'execution';    // Planejamento de execução

export interface ChainOfThought {
  /** Problema original */
  problem: string;
  /** Passos de raciocínio */
  reasoning_steps: ReasoningStep[];
  /** Conclusão final */
  conclusion: string;
  /** Confiança geral (0-1) */
  overall_confidence: number;
  /** Alternativas consideradas */
  alternatives: string[];
  /** Riscos identificados */
  risks: string[];
  /** Duração total */
  duration_ms: number;
}

interface GeneratorConfig {
  maxDepth: number;
  timeout: number;
  enableValidation: boolean;
  enableAlternatives: boolean;
  minConfidenceThreshold: number;
}

// ========== Padrões de Decomposição ==========

interface DecompositionPattern {
  keywords: string[];
  strategy: string;
  suggestedSteps: string[];
}

const DECOMPOSITION_PATTERNS: DecompositionPattern[] = [
  {
    keywords: ['analisar', 'análise', 'examinar'],
    strategy: 'analytical',
    suggestedSteps: [
      'Identificar componentes principais',
      'Examinar cada componente individualmente',
      'Identificar relações entre componentes',
      'Sintetizar análise completa'
    ]
  },
  {
    keywords: ['criar', 'desenvolver', 'construir'],
    strategy: 'constructive',
    suggestedSteps: [
      'Definir requisitos e especificações',
      'Planejar arquitetura/estrutura',
      'Implementar componentes principais',
      'Validar e testar resultado'
    ]
  },
  {
    keywords: ['resolver', 'solucionar', 'consertar'],
    strategy: 'problem-solving',
    suggestedSteps: [
      'Identificar raiz do problema',
      'Gerar possíveis soluções',
      'Avaliar prós/contras de cada solução',
      'Selecionar e implementar melhor solução'
    ]
  },
  {
    keywords: ['comparar', 'escolher', 'selecionar'],
    strategy: 'comparative',
    suggestedSteps: [
      'Listar opções disponíveis',
      'Definir critérios de avaliação',
      'Avaliar cada opção contra critérios',
      'Tomar decisão fundamentada'
    ]
  },
  {
    keywords: ['prever', 'estimar', 'projetar'],
    strategy: 'predictive',
    suggestedSteps: [
      'Coletar dados históricos relevantes',
      'Identificar padrões e tendências',
      'Construir modelo preditivo',
      'Validar precisão da previsão'
    ]
  }
];

// ========== Classe Principal ==========

export class ChainOfThoughtGenerator implements Tool {
  id = "T3";
  name = "ChainOfThoughtGenerator";
  phase = "processa" as const;
  version = "2.0.0";

  private config: GeneratorConfig;
  private executionCount = 0;
  private totalDuration = 0;
  private successCount = 0;

  constructor(mode: "lite" | "fullstack" = "lite") {
    this.config = {
      maxDepth: mode === "lite" ? 5 : 10,
      timeout: mode === "lite" ? 10000 : 30000,
      enableValidation: true,
      enableAlternatives: mode === "fullstack",
      minConfidenceThreshold: 0.5,
    };
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      // Extrair problema
      const problem = this.extractProblem(input);

      if (!problem || problem.trim().length === 0) {
        throw new Error("Invalid input: problem is required and must be non-empty");
      }

      // Verificar timeout
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Chain of thought generation timeout')), this.config.timeout)
      );

      // Gerar chain of thought
      const chainPromise = this.generateChainOfThought(problem, startTime);

      const chain = await Promise.race([chainPromise, timeoutPromise]);

      const duration = Date.now() - startTime;
      this.totalDuration += duration;
      this.successCount++;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: { chain },
        duration_ms: duration,
        timestamp: new Date(),
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      this.totalDuration += duration;
      const message = error instanceof Error ? error.message : "Unknown error";

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

  private extractProblem(input: ToolInput): string {
    if (typeof input === 'string') return input;
    if (input && typeof input === 'object') {
      return (input as any).problem || (input as any).question || (input as any).text || JSON.stringify(input);
    }
    return String(input);
  }

  private async generateChainOfThought(problem: string, startTime: number): Promise<ChainOfThought> {
    // 1. Analisar problema e escolher estratégia
    const strategy = this.selectStrategy(problem);

    // 2. Gerar passos de raciocínio
    const reasoning_steps = await this.generateReasoningSteps(problem, strategy);

    // 3. Validar coerência (se habilitado)
    if (this.config.enableValidation) {
      this.validateCoherence(reasoning_steps);
    }

    // 4. Gerar alternativas (se habilitado)
    const alternatives = this.config.enableAlternatives
      ? this.generateAlternatives(problem, reasoning_steps)
      : [];

    // 5. Identificar riscos
    const risks = this.identifyRisks(problem, reasoning_steps);

    // 6. Gerar conclusão
    const conclusion = this.generateConclusion(problem, reasoning_steps);

    // 7. Calcular confiança geral
    const overall_confidence = this.calculateOverallConfidence(reasoning_steps);

    const duration_ms = Date.now() - startTime;

    return {
      problem,
      reasoning_steps,
      conclusion,
      overall_confidence,
      alternatives,
      risks,
      duration_ms,
    };
  }

  private selectStrategy(problem: string): DecompositionPattern {
    const normalized = problem.toLowerCase();

    for (const pattern of DECOMPOSITION_PATTERNS) {
      if (pattern.keywords.some(kw => normalized.includes(kw))) {
        return pattern;
      }
    }

    // Default: analytical
    return DECOMPOSITION_PATTERNS[0];
  }

  private async generateReasoningSteps(
    problem: string,
    strategy: DecompositionPattern
  ): Promise<ReasoningStep[]> {
    const steps: ReasoningStep[] = [];
    const suggestedSteps = strategy.suggestedSteps.slice(0, this.config.maxDepth);

    // Adicionar passo inicial: entendimento do problema
    steps.push({
      step_number: 1,
      thought: `Analisar o problema: "${problem}"`,
      action: 'Decompor o problema em componentes fundamentais',
      observation: `Problema classificado como estratégia "${strategy.strategy}"`,
      dependencies: [],
      confidence: 0.9,
      type: 'analysis',
    });

    // Gerar passos baseados na estratégia
    for (let i = 0; i < suggestedSteps.length; i++) {
      const stepNumber = i + 2;
      const stepDescription = suggestedSteps[i];

      const step = this.generateStep(
        stepNumber,
        stepDescription,
        problem,
        steps,
        strategy.strategy
      );

      steps.push(step);
    }

    // Adicionar passo final: validação
    if (steps.length > 2) {
      steps.push({
        step_number: steps.length + 1,
        thought: 'Validar raciocínio e verificar consistência',
        action: 'Revisar todos os passos anteriores',
        observation: 'Raciocínio validado e pronto para conclusão',
        dependencies: steps.map(s => s.step_number),
        confidence: 0.85,
        type: 'validation',
      });
    }

    return steps;
  }

  private generateStep(
    stepNumber: number,
    description: string,
    problem: string,
    previousSteps: ReasoningStep[],
    strategy: string
  ): ReasoningStep {
    // Determinar tipo de raciocínio
    const type = this.determineReasoningType(description, stepNumber, previousSteps.length);

    // Gerar pensamento contextualizado
    const thought = this.generateThought(description, problem, strategy);

    // Gerar ação específica
    const action = this.generateAction(description, type);

    // Gerar observação esperada
    const observation = this.generateObservation(description, type);

    // Identificar dependências (geralmente depende do passo anterior)
    const dependencies = stepNumber > 1 ? [stepNumber - 1] : [];

    // Calcular confiança (diminui com profundidade)
    const confidence = Math.max(0.6, 0.95 - (stepNumber * 0.05));

    return {
      step_number: stepNumber,
      thought,
      action,
      observation,
      dependencies,
      confidence: Number(confidence.toFixed(2)),
      type,
    };
  }

  private determineReasoningType(
    description: string,
    stepNumber: number,
    totalSteps: number
  ): ReasoningType {
    const lower = description.toLowerCase();

    if (lower.includes('identificar') || lower.includes('examinar')) return 'analysis';
    if (lower.includes('quebrar') || lower.includes('decompor')) return 'decomposition';
    if (lower.includes('hipótese') || lower.includes('supor')) return 'hypothesis';
    if (lower.includes('validar') || lower.includes('verificar')) return 'validation';
    if (lower.includes('sintetizar') || lower.includes('combinar')) return 'synthesis';
    if (lower.includes('decidir') || lower.includes('escolher')) return 'decision';
    if (lower.includes('implementar') || lower.includes('executar')) return 'execution';

    // Default baseado na posição
    if (stepNumber === 1) return 'analysis';
    if (stepNumber === totalSteps) return 'synthesis';
    return 'decomposition';
  }

  private generateThought(description: string, problem: string, strategy: string): string {
    return `${description}. Considerando a natureza "${strategy}" do problema, ` +
           `precisamos focar em aspectos específicos para avançar logicamente.`;
  }

  private generateAction(description: string, type: ReasoningType): string {
    const actionPrefixes: Record<ReasoningType, string> = {
      analysis: 'Analisar',
      decomposition: 'Decompor',
      hypothesis: 'Formular hipótese sobre',
      validation: 'Validar',
      synthesis: 'Sintetizar',
      decision: 'Tomar decisão sobre',
      execution: 'Planejar execução de',
    };

    const prefix = actionPrefixes[type];
    return `${prefix} ${description.toLowerCase()}`;
  }

  private generateObservation(description: string, type: ReasoningType): string {
    const observationTemplates: Record<ReasoningType, string> = {
      analysis: 'Análise completa, padrões identificados',
      decomposition: 'Problema decomposto em sub-problemas gerenciáveis',
      hypothesis: 'Hipótese formulada e pronta para teste',
      validation: 'Validação concluída, premissas confirmadas',
      synthesis: 'Síntese completa com insights integrados',
      decision: 'Decisão tomada com base em evidências',
      execution: 'Plano de execução definido',
    };

    return observationTemplates[type] + '. ' + description + ' concluído com sucesso.';
  }

  private validateCoherence(steps: ReasoningStep[]): void {
    // Verificar se há dependências circulares
    for (const step of steps) {
      for (const dep of step.dependencies) {
        if (dep >= step.step_number) {
          throw new Error(`Invalid dependency: step ${step.step_number} cannot depend on step ${dep}`);
        }
      }
    }

    // Verificar se todas as dependências existem
    const stepNumbers = new Set(steps.map(s => s.step_number));
    for (const step of steps) {
      for (const dep of step.dependencies) {
        if (!stepNumbers.has(dep)) {
          throw new Error(`Missing dependency: step ${step.step_number} depends on non-existent step ${dep}`);
        }
      }
    }
  }

  private generateAlternatives(problem: string, steps: ReasoningStep[]): string[] {
    const alternatives: string[] = [];

    // Alternativa 1: Abordagem mais direta (menos passos)
    if (steps.length > 3) {
      alternatives.push(
        `Abordagem simplificada: Reduzir para ${Math.ceil(steps.length / 2)} passos focando apenas em componentes críticos`
      );
    }

    // Alternativa 2: Abordagem mais cautelosa
    if (steps.some(s => s.confidence < 0.7)) {
      alternatives.push(
        'Abordagem cautelosa: Adicionar passos de validação intermediária para aumentar confiança'
      );
    }

    // Alternativa 3: Paralelização
    const parallelizableSteps = steps.filter(s => s.dependencies.length <= 1);
    if (parallelizableSteps.length > 2) {
      alternatives.push(
        `Abordagem paralela: Executar ${parallelizableSteps.length} passos independentes simultaneamente`
      );
    }

    return alternatives.slice(0, 3); // Máximo 3 alternativas
  }

  private identifyRisks(problem: string, steps: ReasoningStep[]): string[] {
    const risks: string[] = [];

    // Risco 1: Confiança baixa em algum passo
    const lowConfidenceSteps = steps.filter(s => s.confidence < 0.7);
    if (lowConfidenceSteps.length > 0) {
      risks.push(
        `${lowConfidenceSteps.length} passo(s) com confiança abaixo de 70%: ${lowConfidenceSteps.map(s => s.step_number).join(', ')}`
      );
    }

    // Risco 2: Muitas dependências
    const maxDependencies = Math.max(...steps.map(s => s.dependencies.length));
    if (maxDependencies > 3) {
      risks.push(`Passo com ${maxDependencies} dependências pode criar gargalo de execução`);
    }

    // Risco 3: Cadeia muito longa
    if (steps.length > 7) {
      risks.push(`Cadeia com ${steps.length} passos pode ser difícil de executar/manter`);
    }

    // Risco 4: Falta de validação
    const hasValidation = steps.some(s => s.type === 'validation');
    if (!hasValidation && steps.length > 4) {
      risks.push('Ausência de passos de validação intermediária');
    }

    return risks;
  }

  private generateConclusion(problem: string, steps: ReasoningStep[]): string {
    const lastStep = steps[steps.length - 1];
    const avgConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length;

    const parts: string[] = [];

    parts.push(`Para resolver "${problem}", ` +
               `foi desenvolvida uma cadeia de raciocínio com ${steps.length} passos.`);

    parts.push(`A abordagem segue uma estratégia ${this.getStrategyDescription(steps)}.`);

    parts.push(`A confiança média dos passos é de ${(avgConfidence * 100).toFixed(0)}%, ` +
               `com o passo final ("${lastStep.thought}") apresentando ${(lastStep.confidence * 100).toFixed(0)}% de confiança.`);

    if (avgConfidence >= 0.8) {
      parts.push('O raciocínio é sólido e pode ser executado com alta confiança.');
    } else if (avgConfidence >= 0.6) {
      parts.push('O raciocínio é viável, mas recomenda-se validação adicional em pontos críticos.');
    } else {
      parts.push('O raciocínio requer refinamento antes da execução.');
    }

    return parts.join(' ');
  }

  private getStrategyDescription(steps: ReasoningStep[]): string {
    const typeCounts = steps.reduce((acc, step) => {
      acc[step.type] = (acc[step.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dominantType = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)[0][0] as ReasoningType;

    const descriptions: Record<ReasoningType, string> = {
      analysis: 'analítica, focada em decomposição e compreensão',
      decomposition: 'de decomposição, quebrando o problema em partes menores',
      hypothesis: 'hipotética, testando suposições',
      validation: 'de validação, verificando premissas',
      synthesis: 'sintética, combinando insights',
      decision: 'decisória, focada em escolhas',
      execution: 'executiva, focada em implementação',
    };

    return descriptions[dominantType];
  }

  private calculateOverallConfidence(steps: ReasoningStep[]): number {
    if (steps.length === 0) return 0;

    // Confiança geral é a média ponderada, dando mais peso aos passos finais
    let weightedSum = 0;
    let totalWeight = 0;

    steps.forEach((step, index) => {
      const weight = 1 + (index / steps.length); // Peso aumenta com a progressão
      weightedSum += step.confidence * weight;
      totalWeight += weight;
    });

    const confidence = weightedSum / totalWeight;
    return Number(confidence.toFixed(2));
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE3:ChainOfThought] Testando ChainOfThoughtGenerator...\n');

  async function runTests() {
    const generator = new ChainOfThoughtGenerator('lite');

    // Teste 1: Problema analítico
    console.log('=== Teste 1: Problema Analítico ===');
    const result1 = await generator.execute({
      problem: 'Analisar o desempenho de vendas do último trimestre e identificar oportunidades de melhoria'
    });
    if (result1.success) {
      const chain = result1.output.chain as ChainOfThought;
      console.log('Problema:', chain.problem);
      console.log('Passos de raciocínio:', chain.reasoning_steps.length);
      chain.reasoning_steps.forEach(step => {
        console.log(`  ${step.step_number}. [${step.type}] ${step.thought.substring(0, 60)}...`);
        console.log(`     Confiança: ${(step.confidence * 100).toFixed(0)}%`);
      });
      console.log('Conclusão:', chain.conclusion);
      console.log('Confiança geral:', (chain.overall_confidence * 100).toFixed(0), '%');
    }

    // Teste 2: Problema de decisão
    console.log('\n=== Teste 2: Problema de Decisão ===');
    const result2 = await generator.execute({
      problem: 'Escolher entre três fornecedores de software baseado em custo, qualidade e suporte'
    });
    if (result2.success) {
      const chain = result2.output.chain as ChainOfThought;
      console.log('Estratégia:', chain.reasoning_steps[1]?.type);
      console.log('Riscos identificados:', chain.risks.length);
      chain.risks.forEach(risk => console.log(`  - ${risk}`));
      console.log('Duração:', chain.duration_ms, 'ms');
    }

    // Teste 3: Problema construtivo
    console.log('\n=== Teste 3: Problema Construtivo ===');
    const result3 = await generator.execute({
      problem: 'Desenvolver um sistema de autenticação seguro para aplicação web'
    });
    if (result3.success) {
      const chain = result3.output.chain as ChainOfThought;
      console.log('Total de passos:', chain.reasoning_steps.length);
      const types = chain.reasoning_steps.map(s => s.type);
      console.log('Tipos de raciocínio:', [...new Set(types)].join(', '));
      console.log('Conclusão (primeiras 100 chars):', chain.conclusion.substring(0, 100) + '...');
    }

    // Teste 4: Health check
    console.log('\n=== Teste 4: Health Check ===');
    const health = await generator.healthCheck();
    console.log('Status:', health.status);
    console.log('Latência média:', health.avg_latency_ms, 'ms');
    console.log('Taxa de sucesso:', (health.success_rate * 100).toFixed(0), '%');

    console.log('\n[AE3:ChainOfThought] ✓ Testes concluídos');
  }

  runTests().catch(console.error);
}
