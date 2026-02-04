import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type RedactionRule = {
  name: string;
  pattern: RegExp;
  replacement: string;
};

type AnonymizerOptions = {
  enabledRules?: string[];
  disabledRules?: string[];
};

const DEFAULT_RULES: RedactionRule[] = [
  { name: "email", pattern: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, replacement: "[REDACTED_EMAIL]" },
  { name: "cpf", pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, replacement: "[REDACTED_CPF]" },
  { name: "cnpj", pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g, replacement: "[REDACTED_CNPJ]" },
  {
    name: "phone",
    pattern: /(?:\+?\d{1,3}\s*)?(?:\(\d{2,3}\)\s*|\d{2,3}\s*)?\d{4,5}-?\d{4}/g,
    replacement: "[REDACTED_PHONE]"
  },
  { name: "cep", pattern: /\b\d{5}-?\d{3}\b/g, replacement: "[REDACTED_CEP]" },
  { name: "rg", pattern: /\b\d{1,2}\.?\d{3}\.?\d{3}-?[0-9Xx]\b/g, replacement: "[REDACTED_RG]" },
  { name: "passport", pattern: /\b[A-Z]{2}\d{6}\b/g, replacement: "[REDACTED_PASSPORT]" },
  { name: "credit_card", pattern: /\b(?:\d[ -]*?){13,19}\b/g, replacement: "[REDACTED_CARD]" }
];

export class DataAnonymizer implements Tool {
  id = "T2";
  name = "DataAnonymizer";
  phase = "recebe" as const;
  version = "2.0.0";

  private readonly rules: RedactionRule[];
  private executionCount = 0;
  private totalDuration = 0;
  private successCount = 0;
  private redactionStats: Map<string, number> = new Map();

  constructor(rules?: RedactionRule[]) {
    this.rules = rules && rules.length > 0 ? rules : DEFAULT_RULES;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      const target = input.text ?? input.payload ?? input.data ?? input;
      const options = this.extractOptions(input);
      const result = this.anonymizeValue(target, options);

      const duration = Date.now() - startTime;
      this.totalDuration += duration;
      this.successCount++;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: {
          anonymized: result.value,
          redactions: result.redactions,
          stats: result.stats
        },
        duration_ms: duration,
        timestamp: new Date()
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
        timestamp: new Date()
      };
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount > 0 ? this.totalDuration / this.executionCount : 0;
    const successRate = this.executionCount > 0 ? this.successCount / this.executionCount : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.95 ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: Math.round(avgLatency),
      success_rate: Number(successRate.toFixed(2))
    };
  }

  /**
   * Retorna estatísticas de redação
   */
  getRedactionStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.redactionStats.forEach((count, type) => {
      stats[type] = count;
    });
    return stats;
  }

  private anonymizeValue(value: unknown, options?: AnonymizerOptions): { value: unknown; redactions: number; stats: Record<string, number> } {
    const stats: Record<string, number> = {};
    let totalRedactions = 0;

    const anonymize = (val: unknown): unknown => {
      if (typeof val === "string") {
        const result = this.applyRules(val, options);
        totalRedactions += result.redactionCount;
        // Merge stats
        Object.entries(result.stats).forEach(([type, count]) => {
          stats[type] = (stats[type] || 0) + count;
          this.redactionStats.set(type, (this.redactionStats.get(type) || 0) + count);
        });
        return result.text;
      }

      if (Array.isArray(val)) {
        return val.map((item) => anonymize(item));
      }

      if (val && typeof val === "object") {
        const output: Record<string, unknown> = {};
        for (const [key, nested] of Object.entries(val as Record<string, unknown>)) {
          output[key] = anonymize(nested);
        }
        return output;
      }

      return val;
    };

    const anonymized = anonymize(value);

    return {
      value: anonymized,
      redactions: totalRedactions,
      stats
    };
  }

  private applyRules(text: string, options?: AnonymizerOptions): { text: string; redactionCount: number; stats: Record<string, number> } {
    let redacted = text;
    const activeRules = this.filterRules(options);
    const stats: Record<string, number> = {};
    let totalRedactions = 0;

    for (const rule of activeRules) {
      const matches = text.match(rule.pattern);
      if (matches && matches.length > 0) {
        stats[rule.name] = matches.length;
        totalRedactions += matches.length;
      }
      redacted = redacted.replace(rule.pattern, rule.replacement);
    }

    return { text: redacted, redactionCount: totalRedactions, stats };
  }

  private filterRules(options?: AnonymizerOptions): RedactionRule[] {
    if (!options) {
      return this.rules;
    }

    const enabled = options.enabledRules?.map((rule) => rule.toLowerCase());
    const disabled = options.disabledRules?.map((rule) => rule.toLowerCase());

    return this.rules.filter((rule) => {
      const name = rule.name.toLowerCase();
      if (enabled && enabled.length > 0) {
        return enabled.includes(name);
      }
      if (disabled && disabled.length > 0) {
        return !disabled.includes(name);
      }
      return true;
    });
  }

  private extractOptions(input: ToolInput): AnonymizerOptions | undefined {
    const options = input.options as AnonymizerOptions | undefined;
    if (!options) {
      return undefined;
    }

    if (options.enabledRules && !Array.isArray(options.enabledRules)) {
      throw new Error("Invalid input: options.enabledRules must be an array");
    }

    if (options.disabledRules && !Array.isArray(options.disabledRules)) {
      throw new Error("Invalid input: options.disabledRules must be an array");
    }

    return options;
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log('[AE3:DataAnonymizer] Testando DataAnonymizer...\n');

  async function runTests() {
    const anonymizer = new DataAnonymizer();

    // Teste 1: Texto simples com dados pessoais
    console.log('=== Teste 1: Texto Simples ===');
    const result1 = await anonymizer.execute({
      text: 'Meu email é joao@exemplo.com e meu CPF é 123.456.789-10. Telefone: (11) 98765-4321'
    });
    if (result1.success) {
      console.log('Original:', 'joao@exemplo.com, 123.456.789-10, (11) 98765-4321');
      console.log('Anonimizado:', result1.output.anonymized);
      console.log('Redações:', result1.output.redactions);
      console.log('Stats:', result1.output.stats);
    }

    // Teste 2: Objeto complexo
    console.log('\n=== Teste 2: Objeto Complexo ===');
    const result2 = await anonymizer.execute({
      data: {
        usuario: {
          nome: 'João Silva',
          email: 'joao.silva@empresa.com',
          cpf: '123.456.789-10',
          telefone: '+55 11 98765-4321'
        },
        transacao: {
          valor: 'R$ 1.500,00',
          cartao: '4532 1234 5678 9010'
        }
      }
    });
    if (result2.success) {
      console.log('Objeto anonimizado:');
      console.log(JSON.stringify(result2.output.anonymized, null, 2));
      console.log('Total de redações:', result2.output.redactions);
      console.log('Breakdown:', result2.output.stats);
    }

    // Teste 3: Opções personalizadas (apenas email)
    console.log('\n=== Teste 3: Opções Personalizadas (apenas email) ===');
    const result3 = await anonymizer.execute({
      text: 'Contatos: email@test.com, CPF 123.456.789-10, tel (11) 99999-9999',
      options: {
        enabledRules: ['email']
      }
    });
    if (result3.success) {
      console.log('Original:', 'email@test.com, CPF 123.456.789-10, tel (11) 99999-9999');
      console.log('Anonimizado:', result3.output.anonymized);
      console.log('(Apenas email foi redatado)');
    }

    // Teste 4: Array de dados
    console.log('\n=== Teste 4: Array de Dados ===');
    const result4 = await anonymizer.execute({
      data: [
        'Cliente 1: maria@email.com, CPF 111.222.333-44',
        'Cliente 2: pedro@email.com, CPF 555.666.777-88',
        'Cliente 3: ana@email.com, CPF 999.000.111-22'
      ]
    });
    if (result4.success) {
      console.log('Array anonimizado:', result4.output.anonymized);
      console.log('Total de redações:', result4.output.redactions);
    }

    // Teste 5: Health check e estatísticas
    console.log('\n=== Teste 5: Health Check e Estatísticas ===');
    const health = await anonymizer.healthCheck();
    console.log('Status:', health.status);
    console.log('Latência média:', health.avg_latency_ms, 'ms');
    console.log('Taxa de sucesso:', (health.success_rate * 100).toFixed(0), '%');
    console.log('Estatísticas de redação acumuladas:');
    const stats = anonymizer.getRedactionStats();
    Object.entries(stats).forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

    console.log('\n[AE3:DataAnonymizer] ✓ Testes concluídos');
  }

  runTests().catch(console.error);
}

