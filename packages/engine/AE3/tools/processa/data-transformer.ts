import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

/**
 * Operações de transformação suportadas
 */
type TransformOperation =
  | "map" // Mapear campos
  | "filter" // Filtrar elementos
  | "reduce" // Reduzir/agregar
  | "flatten" // Achatar arrays aninhados
  | "group_by" // Agrupar por campo
  | "sort" // Ordenar
  | "rename" // Renomear campos
  | "extract" // Extrair campos específicos
  | "convert_types" // Converter tipos de dados
  | "normalize" // Normalizar valores (ex: datas, números)
  | "merge" // Merge de múltiplos datasets
  | "pivot" // Pivot table
  | "unpivot"; // Desfazer pivot

type TransformConfig = {
  data: unknown;
  operations: Array<{
    type: TransformOperation;
    params?: Record<string, unknown>;
  }>;
};

export class DataTransformer implements Tool {
  id = "T26";
  name = "DataTransformer";
  phase = "processa" as const;
  version = "1.0.0";

  private metrics = {
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    totalDuration: 0,
  };

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.metrics.executionCount++;

    try {
      const payload = (input.payload ?? input) as TransformConfig;

      if (!payload.data) {
        throw new Error("Input 'data' is required");
      }

      if (!Array.isArray(payload.operations) || payload.operations.length === 0) {
        throw new Error("At least one transformation operation is required");
      }

      // Aplicar transformações em sequência
      let result = payload.data;
      const appliedOperations: string[] = [];

      for (const operation of payload.operations) {
        result = this.applyTransformation(result, operation.type, operation.params || {});
        appliedOperations.push(operation.type);
      }

      this.metrics.successCount++;
      this.metrics.totalDuration += Date.now() - startTime;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: {
          transformed: result,
          operations_applied: appliedOperations,
          operations_count: appliedOperations.length,
        },
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
   * Aplica uma transformação específica nos dados
   */
  private applyTransformation(
    data: unknown,
    operation: TransformOperation,
    params: Record<string, unknown>
  ): unknown {
    switch (operation) {
      case "map":
        return this.mapTransform(data, params);

      case "filter":
        return this.filterTransform(data, params);

      case "reduce":
        return this.reduceTransform(data, params);

      case "flatten":
        return this.flattenTransform(data, params);

      case "group_by":
        return this.groupByTransform(data, params);

      case "sort":
        return this.sortTransform(data, params);

      case "rename":
        return this.renameTransform(data, params);

      case "extract":
        return this.extractTransform(data, params);

      case "convert_types":
        return this.convertTypesTransform(data, params);

      case "normalize":
        return this.normalizeTransform(data, params);

      case "merge":
        return this.mergeTransform(data, params);

      case "pivot":
        return this.pivotTransform(data, params);

      case "unpivot":
        return this.unpivotTransform(data, params);

      default:
        throw new Error(`Unknown transformation operation: ${operation}`);
    }
  }

  // ========== Implementações de transformações ==========

  private mapTransform(data: unknown, params: Record<string, unknown>): unknown {
    if (!Array.isArray(data)) {
      throw new Error("map operation requires array input");
    }

    const { mapping } = params as { mapping?: Record<string, string> };
    if (!mapping) {
      throw new Error("map operation requires 'mapping' parameter");
    }

    return data.map((item) => {
      const newItem: Record<string, unknown> = {};
      for (const [newKey, oldKey] of Object.entries(mapping)) {
        newItem[newKey] = (item as Record<string, unknown>)[oldKey];
      }
      return newItem;
    });
  }

  private filterTransform(data: unknown, params: Record<string, unknown>): unknown {
    if (!Array.isArray(data)) {
      throw new Error("filter operation requires array input");
    }

    const { field, operator, value } = params as {
      field?: string;
      operator?: string;
      value?: unknown;
    };

    if (!field || !operator) {
      throw new Error("filter requires 'field' and 'operator' parameters");
    }

    return data.filter((item) => {
      const itemValue = (item as Record<string, unknown>)[field];

      switch (operator) {
        case "==":
          return itemValue === value;
        case "!=":
          return itemValue !== value;
        case ">":
          return Number(itemValue) > Number(value);
        case "<":
          return Number(itemValue) < Number(value);
        case ">=":
          return Number(itemValue) >= Number(value);
        case "<=":
          return Number(itemValue) <= Number(value);
        case "contains":
          return String(itemValue).includes(String(value));
        case "starts_with":
          return String(itemValue).startsWith(String(value));
        case "ends_with":
          return String(itemValue).endsWith(String(value));
        default:
          throw new Error(`Unknown operator: ${operator}`);
      }
    });
  }

  private reduceTransform(data: unknown, params: Record<string, unknown>): unknown {
    if (!Array.isArray(data)) {
      throw new Error("reduce operation requires array input");
    }

    const { operation: op, field } = params as {
      operation?: string;
      field?: string;
    };

    if (!op) {
      throw new Error("reduce requires 'operation' parameter (sum, avg, count, min, max)");
    }

    switch (op) {
      case "sum":
        return data.reduce((acc, item) => {
          const value = field
            ? (item as Record<string, unknown>)[field]
            : item;
          return acc + Number(value);
        }, 0);

      case "avg":
        const sum = data.reduce((acc, item) => {
          const value = field
            ? (item as Record<string, unknown>)[field]
            : item;
          return acc + Number(value);
        }, 0);
        return sum / data.length;

      case "count":
        return data.length;

      case "min":
        return Math.min(
          ...data.map((item) => {
            const value = field
              ? (item as Record<string, unknown>)[field]
              : item;
            return Number(value);
          })
        );

      case "max":
        return Math.max(
          ...data.map((item) => {
            const value = field
              ? (item as Record<string, unknown>)[field]
              : item;
            return Number(value);
          })
        );

      default:
        throw new Error(`Unknown reduce operation: ${op}`);
    }
  }

  private flattenTransform(data: unknown, params: Record<string, unknown>): unknown {
    const { depth = 1 } = params as { depth?: number };

    if (!Array.isArray(data)) {
      throw new Error("flatten operation requires array input");
    }

    const flatten = (arr: unknown[], d: number): unknown[] => {
      if (d === 0) return arr;

      return arr.reduce((acc: unknown[], val) => {
        if (Array.isArray(val)) {
          return acc.concat(flatten(val, d - 1));
        }
        return acc.concat(val);
      }, []);
    };

    return flatten(data, depth);
  }

  private groupByTransform(data: unknown, params: Record<string, unknown>): unknown {
    if (!Array.isArray(data)) {
      throw new Error("group_by operation requires array input");
    }

    const { field } = params as { field?: string };
    if (!field) {
      throw new Error("group_by requires 'field' parameter");
    }

    const grouped: Record<string, unknown[]> = {};

    for (const item of data) {
      const key = String((item as Record<string, unknown>)[field]);
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(item);
    }

    return grouped;
  }

  private sortTransform(data: unknown, params: Record<string, unknown>): unknown {
    if (!Array.isArray(data)) {
      throw new Error("sort operation requires array input");
    }

    const { field, order = "asc" } = params as {
      field?: string;
      order?: "asc" | "desc";
    };

    if (!field) {
      throw new Error("sort requires 'field' parameter");
    }

    const sorted = [...data].sort((a, b) => {
      const aValue = (a as Record<string, unknown>)[field];
      const bValue = (b as Record<string, unknown>)[field];

      if (aValue < bValue) return order === "asc" ? -1 : 1;
      if (aValue > bValue) return order === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }

  private renameTransform(data: unknown, params: Record<string, unknown>): unknown {
    if (!Array.isArray(data)) {
      throw new Error("rename operation requires array input");
    }

    const { mapping } = params as { mapping?: Record<string, string> };
    if (!mapping) {
      throw new Error("rename requires 'mapping' parameter");
    }

    return data.map((item) => {
      const newItem: Record<string, unknown> = {};
      for (const [oldKey, value] of Object.entries(item as Record<string, unknown>)) {
        const newKey = mapping[oldKey] || oldKey;
        newItem[newKey] = value;
      }
      return newItem;
    });
  }

  private extractTransform(data: unknown, params: Record<string, unknown>): unknown {
    if (!Array.isArray(data)) {
      throw new Error("extract operation requires array input");
    }

    const { fields } = params as { fields?: string[] };
    if (!fields || !Array.isArray(fields)) {
      throw new Error("extract requires 'fields' array parameter");
    }

    return data.map((item) => {
      const extracted: Record<string, unknown> = {};
      for (const field of fields) {
        extracted[field] = (item as Record<string, unknown>)[field];
      }
      return extracted;
    });
  }

  private convertTypesTransform(data: unknown, params: Record<string, unknown>): unknown {
    if (!Array.isArray(data)) {
      throw new Error("convert_types operation requires array input");
    }

    const { conversions } = params as {
      conversions?: Record<string, "string" | "number" | "boolean" | "date">;
    };

    if (!conversions) {
      throw new Error("convert_types requires 'conversions' parameter");
    }

    return data.map((item) => {
      const converted: Record<string, unknown> = { ...item as Record<string, unknown> };

      for (const [field, targetType] of Object.entries(conversions)) {
        const value = converted[field];

        switch (targetType) {
          case "string":
            converted[field] = String(value);
            break;
          case "number":
            converted[field] = Number(value);
            break;
          case "boolean":
            converted[field] = Boolean(value);
            break;
          case "date":
            converted[field] = new Date(String(value));
            break;
        }
      }

      return converted;
    });
  }

  private normalizeTransform(data: unknown, params: Record<string, unknown>): unknown {
    if (!Array.isArray(data)) {
      throw new Error("normalize operation requires array input");
    }

    const { field, min = 0, max = 1 } = params as {
      field?: string;
      min?: number;
      max?: number;
    };

    if (!field) {
      throw new Error("normalize requires 'field' parameter");
    }

    // Encontrar min e max atuais
    const values = data.map((item) =>
      Number((item as Record<string, unknown>)[field])
    );
    const currentMin = Math.min(...values);
    const currentMax = Math.max(...values);
    const range = currentMax - currentMin;

    return data.map((item) => {
      const normalized: Record<string, unknown> = { ...item as Record<string, unknown> };
      const value = Number(normalized[field]);
      normalized[field] =
        range === 0 ? min : ((value - currentMin) / range) * (max - min) + min;
      return normalized;
    });
  }

  private mergeTransform(data: unknown, params: Record<string, unknown>): unknown {
    const { with: otherData, on } = params as {
      with?: unknown[];
      on?: string;
    };

    if (!Array.isArray(data) || !Array.isArray(otherData)) {
      throw new Error("merge operation requires two array inputs");
    }

    if (!on) {
      throw new Error("merge requires 'on' parameter (join key)");
    }

    return data.map((item) => {
      const key = (item as Record<string, unknown>)[on];
      const match = otherData.find(
        (other) => (other as Record<string, unknown>)[on] === key
      );
      return { ...item, ...(match || {}) };
    });
  }

  private pivotTransform(data: unknown, params: Record<string, unknown>): unknown {
    if (!Array.isArray(data)) {
      throw new Error("pivot operation requires array input");
    }

    const { index, columns, values } = params as {
      index?: string;
      columns?: string;
      values?: string;
    };

    if (!index || !columns || !values) {
      throw new Error("pivot requires 'index', 'columns', and 'values' parameters");
    }

    const pivoted: Record<string, Record<string, unknown>> = {};

    for (const item of data) {
      const row = item as Record<string, unknown>;
      const indexValue = String(row[index]);
      const columnValue = String(row[columns]);
      const value = row[values];

      if (!pivoted[indexValue]) {
        pivoted[indexValue] = { [index]: indexValue };
      }

      pivoted[indexValue][columnValue] = value;
    }

    return Object.values(pivoted);
  }

  private unpivotTransform(data: unknown, params: Record<string, unknown>): unknown {
    if (!Array.isArray(data)) {
      throw new Error("unpivot operation requires array input");
    }

    const { id_vars = [], value_name = "value", var_name = "variable" } = params as {
      id_vars?: string[];
      value_name?: string;
      var_name?: string;
    };

    const unpivoted: unknown[] = [];

    for (const item of data) {
      const row = item as Record<string, unknown>;

      for (const [key, value] of Object.entries(row)) {
        if (!id_vars.includes(key)) {
          const newRow: Record<string, unknown> = {};

          // Adicionar id_vars
          for (const idVar of id_vars) {
            newRow[idVar] = row[idVar];
          }

          // Adicionar variable e value
          newRow[var_name] = key;
          newRow[value_name] = value;

          unpivoted.push(newRow);
        }
      }
    }

    return unpivoted;
  }

  // ========== Métricas e Health Check ==========

  async healthCheck(): Promise<ToolHealth> {
    try {
      // Teste simples de transformação
      const testResult = await this.execute({
        data: [{ a: 1 }, { a: 2 }],
        operations: [{ type: "filter", params: { field: "a", operator: ">", value: 0 } }],
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
        status: testResult.success ? "healthy" : "unhealthy",
        last_check: new Date(),
        avg_latency_ms: avgLatency,
        success_rate: successRate,
      };
    } catch {
      return {
        tool_name: this.name,
        status: "unhealthy",
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
    };
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE3:DataTransformer] Testing Data Transformer Tool...\n");

  async function runTests() {
    const tool = new DataTransformer();

    // Teste 1: Filter
    console.log("=== Teste 1: Filter (age > 25) ===");
    const result1 = await tool.execute({
      data: [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 20 },
        { name: "Charlie", age: 35 },
      ],
      operations: [{ type: "filter", params: { field: "age", operator: ">", value: 25 } }],
    });
    console.log(result1.success ? "✓" : "✗", JSON.stringify(result1.output, null, 2));

    // Teste 2: Map + Sort
    console.log("\n=== Teste 2: Rename + Sort ===");
    const result2 = await tool.execute({
      data: [
        { firstName: "Bob", score: 85 },
        { firstName: "Alice", score: 92 },
      ],
      operations: [
        { type: "rename", params: { mapping: { firstName: "name" } } },
        { type: "sort", params: { field: "score", order: "desc" } },
      ],
    });
    console.log(result2.success ? "✓" : "✗", JSON.stringify(result2.output, null, 2));

    // Teste 3: Group By
    console.log("\n=== Teste 3: Group By ===");
    const result3 = await tool.execute({
      data: [
        { category: "A", value: 10 },
        { category: "B", value: 20 },
        { category: "A", value: 30 },
      ],
      operations: [{ type: "group_by", params: { field: "category" } }],
    });
    console.log(result3.success ? "✓" : "✗", JSON.stringify(result3.output, null, 2));

    // Teste 4: Reduce (sum)
    console.log("\n=== Teste 4: Reduce (Sum) ===");
    const result4 = await tool.execute({
      data: [{ value: 10 }, { value: 20 }, { value: 30 }],
      operations: [{ type: "reduce", params: { operation: "sum", field: "value" } }],
    });
    console.log(result4.success ? "✓" : "✗", JSON.stringify(result4.output, null, 2));

    // Teste 5: Health Check
    console.log("\n=== Teste 5: Health Check ===");
    const health = await tool.healthCheck();
    console.log(health.status === "healthy" ? "✓" : "✗", JSON.stringify(health, null, 2));

    console.log("\n[AE3:DataTransformer] ✓ Testes concluídos");
  }

  runTests().catch(console.error);
}
