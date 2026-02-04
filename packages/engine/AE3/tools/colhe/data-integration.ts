import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type IntegrationSource = {
  name: string;
  payload: Record<string, unknown>;
  priority?: number;
  timestamp?: string;
};

type IntegrationRule = {
  field: string;
  strategy: "prefer_source" | "merge" | "coalesce" | "sum" | "concat";
  source?: string;
};

type IntegrationResult = {
  merged: Record<string, unknown>;
  conflicts: Array<{ field: string; sources: string[]; values: unknown[] }>;
  provenance: Record<string, string>;
  stats: {
    sources: number;
    fields_merged: number;
    conflicts: number;
    runtime_ms: number;
  };
};

export class DataIntegration implements Tool {
  id = "T12";
  name = "DataIntegration";
  phase = "colhe" as const;
  version = "2.0.0";

  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount += 1;

    try {
      const sources = this.normalizeSources(input.sources);
      const rules = this.normalizeRules(input.rules);
      const defaultStrategy = this.normalizeStrategy(input.default_strategy);

      const sortedSources = [...sources].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
      const { merged, conflicts, provenance, fieldsMerged } = this.mergeSources(
        sortedSources,
        rules,
        defaultStrategy
      );

      const runtime = Date.now() - startTime;
      this.successCount += 1;
      this.totalDuration += runtime;

      const result: IntegrationResult = {
        merged,
        conflicts,
        provenance,
        stats: {
          sources: sortedSources.length,
          fields_merged: fieldsMerged,
          conflicts: conflicts.length,
          runtime_ms: runtime
        }
      };

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: result,
        duration_ms: runtime,
        timestamp: new Date()
      };
    } catch (error) {
      this.totalDuration += Date.now() - startTime;
      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        error: error instanceof Error ? error.message : "DataIntegration failed",
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount ? Math.round(this.totalDuration / this.executionCount) : 7;
    const successRate = this.executionCount ? this.successCount / this.executionCount : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.9 ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: avgLatency,
      success_rate: Number(successRate.toFixed(2))
    };
  }

  private normalizeSources(raw: unknown): IntegrationSource[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((source) => {
        if (!source || typeof source !== "object") return null;
        const name = String((source as IntegrationSource).name ?? "").trim();
        if (!name) return null;
        const payload =
          (source as IntegrationSource).payload && typeof (source as IntegrationSource).payload === "object"
            ? ((source as IntegrationSource).payload as Record<string, unknown>)
            : {};
        return {
          name,
          payload,
          priority: Number((source as IntegrationSource).priority ?? 0),
          timestamp: (source as IntegrationSource).timestamp
        } as IntegrationSource;
      })
      .filter((source): source is IntegrationSource => Boolean(source));
  }

  private normalizeRules(raw: unknown): IntegrationRule[] {
    if (!Array.isArray(raw)) return [];
    return raw
      .map((rule) => {
        if (!rule || typeof rule !== "object") return null;
        const field = String((rule as IntegrationRule).field ?? "").trim();
        if (!field) return null;
        const strategy = this.normalizeStrategy((rule as IntegrationRule).strategy);
        const source = (rule as IntegrationRule).source ? String((rule as IntegrationRule).source) : undefined;
        return { field, strategy, source };
      })
      .filter((rule): rule is IntegrationRule => Boolean(rule));
  }

  private normalizeStrategy(value: unknown): IntegrationRule["strategy"] {
    const strategy = String(value ?? "coalesce").toLowerCase();
    if (strategy === "prefer_source" || strategy === "merge" || strategy === "sum" || strategy === "concat") {
      return strategy;
    }
    return "coalesce";
  }

  private mergeSources(
    sources: IntegrationSource[],
    rules: IntegrationRule[],
    defaultStrategy: IntegrationRule["strategy"]
  ): {
    merged: Record<string, unknown>;
    conflicts: Array<{ field: string; sources: string[]; values: unknown[] }>;
    provenance: Record<string, string>;
    fieldsMerged: number;
  } {
    const merged: Record<string, unknown> = {};
    const provenance: Record<string, string> = {};
    const conflicts: Array<{ field: string; sources: string[]; values: unknown[] }> = [];
    const fieldHits = new Map<string, Array<{ source: string; value: unknown }>>();

    for (const source of sources) {
      for (const [key, value] of Object.entries(source.payload)) {
        if (!fieldHits.has(key)) fieldHits.set(key, []);
        fieldHits.get(key)?.push({ source: source.name, value });
      }
    }

    for (const [field, entries] of fieldHits.entries()) {
      const rule = rules.find((candidate) => candidate.field === field);
      const strategy = rule?.strategy ?? defaultStrategy;

      if (entries.length === 1) {
        merged[field] = entries[0].value;
        provenance[field] = entries[0].source;
        continue;
      }

      const values = entries.map((entry) => entry.value);
      const sourcesForField = entries.map((entry) => entry.source);

      if (!this.areValuesEqual(values)) {
        conflicts.push({ field, sources: sourcesForField, values });
      }

      switch (strategy) {
        case "prefer_source": {
          const preferred = rule?.source
            ? entries.find((entry) => entry.source === rule.source) ?? entries[0]
            : entries[0];
          merged[field] = preferred.value;
          provenance[field] = preferred.source;
          break;
        }
        case "merge": {
          merged[field] = this.deepMerge(values);
          provenance[field] = sourcesForField[0];
          break;
        }
        case "sum": {
          merged[field] = values.reduce((acc, value) => acc + (Number(value) || 0), 0);
          provenance[field] = sourcesForField.join("+");
          break;
        }
        case "concat": {
          merged[field] = values.flatMap((value) => (Array.isArray(value) ? value : [value]));
          provenance[field] = sourcesForField.join("+");
          break;
        }
        case "coalesce":
        default: {
          const chosen = values.find((value) => value !== null && value !== undefined) ?? values[0];
          const chosenIndex = values.findIndex((value) => value === chosen);
          merged[field] = chosen;
          provenance[field] = sourcesForField[Math.max(chosenIndex, 0)];
          break;
        }
      }
    }

    return { merged, conflicts, provenance, fieldsMerged: fieldHits.size };
  }

  private areValuesEqual(values: unknown[]): boolean {
    if (values.length <= 1) return true;
    return values.every((value) => this.stringifyStable(value) === this.stringifyStable(values[0]));
  }

  private stringifyStable(value: unknown): string {
    if (value && typeof value === "object") {
      if (Array.isArray(value)) {
        return `[${value.map((item) => this.stringifyStable(item)).join(",")}]`;
      }
      const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
      return `{${entries.map(([key, val]) => `${key}:${this.stringifyStable(val)}`).join(",")}}`;
    }
    return String(value);
  }

  private deepMerge(values: unknown[]): unknown {
    return values.reduce((acc, value) => this.mergeTwo(acc, value), {});
  }

  private mergeTwo(base: unknown, update: unknown): unknown {
    if (this.isPlainObject(base) && this.isPlainObject(update)) {
      const result: Record<string, unknown> = { ...base };
      for (const [key, value] of Object.entries(update)) {
        result[key] = this.mergeTwo(result[key], value);
      }
      return result;
    }
    if (Array.isArray(base) && Array.isArray(update)) {
      return [...base, ...update];
    }
    return update ?? base;
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }
}

if (require.main === module) {
  const tool = new DataIntegration();
  console.log("[AE3:DataIntegration] Testing DataIntegration...\n");

  tool
    .execute({
      sources: [
        { name: "crm", priority: 2, payload: { name: "Ana", spend: 900, tags: ["vip"] } },
        { name: "billing", priority: 1, payload: { spend: 1200, region: "sul", tags: ["paid"] } }
      ],
      rules: [
        { field: "spend", strategy: "prefer_source", source: "billing" },
        { field: "tags", strategy: "concat" }
      ],
      default_strategy: "coalesce"
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      console.log("\n[AE3:DataIntegration] ✓ Tests completed");
    })
    .catch((error) => {
      console.error("[AE3:DataIntegration] Test failed", error);
    });
}
