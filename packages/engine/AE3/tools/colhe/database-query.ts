import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type QueryAction = "select" | "insert" | "update" | "delete";

type QueryFilter = {
  field: string;
  op?: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";
  value?: unknown;
};

type QueryRequest = {
  table: string;
  action: QueryAction;
  columns?: string[];
  filters?: QueryFilter[];
  limit?: number;
  offset?: number;
  sort?: { field: string; direction?: "asc" | "desc" };
  values?: Record<string, unknown>;
};

type QueryResult = {
  table: string;
  action: QueryAction;
  rows: Record<string, unknown>[];
  affected: number;
  runtime_ms: number;
  metadata: {
    total_rows: number;
    limit?: number;
    offset?: number;
  };
};

export class DatabaseQuery implements Tool {
  id = "T25";
  name = "DatabaseQuery";
  phase = "colhe" as const;
  version = "2.0.0";

  private executionCount = 0;
  private successCount = 0;
  private totalDuration = 0;
  private tables: Map<string, Record<string, unknown>[]> = new Map([
    [
      "customers",
      [
        { id: 1, name: "Ana", segment: "enterprise", spend: 12000, active: true },
        { id: 2, name: "Ravi", segment: "smb", spend: 800, active: true },
        { id: 3, name: "Lia", segment: "smb", spend: 320, active: false }
      ]
    ],
    [
      "orders",
      [
        { id: "o-100", customer_id: 1, total: 980, status: "paid" },
        { id: "o-101", customer_id: 2, total: 150, status: "pending" }
      ]
    ]
  ]);

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount += 1;

    try {
      const request = this.normalizeRequest(input);
      const table = this.ensureTable(request.table);

      let result: QueryResult;
      switch (request.action) {
        case "insert":
          result = this.handleInsert(request, table);
          break;
        case "update":
          result = this.handleUpdate(request, table);
          break;
        case "delete":
          result = this.handleDelete(request, table);
          break;
        case "select":
        default:
          result = this.handleSelect(request, table);
          break;
      }

      result.runtime_ms = Date.now() - startTime;
      this.successCount += 1;
      this.totalDuration += result.runtime_ms;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: result,
        duration_ms: result.runtime_ms,
        timestamp: new Date()
      };
    } catch (error) {
      this.totalDuration += Date.now() - startTime;
      return {
        tool_id: this.id,
        tool_name: this.name,
        success: false,
        error: error instanceof Error ? error.message : "DatabaseQuery failed",
        duration_ms: Date.now() - startTime,
        timestamp: new Date()
      };
    }
  }

  async healthCheck(): Promise<ToolHealth> {
    const avgLatency = this.executionCount ? Math.round(this.totalDuration / this.executionCount) : 14;
    const successRate = this.executionCount ? this.successCount / this.executionCount : 1;

    return {
      tool_name: this.name,
      status: successRate > 0.9 ? "healthy" : "degraded",
      last_check: new Date(),
      avg_latency_ms: avgLatency,
      success_rate: Number(successRate.toFixed(2))
    };
  }

  private normalizeRequest(input: ToolInput): QueryRequest {
    const action = String(input.action ?? "select").toLowerCase();
    const table = String(input.table ?? input.collection ?? "default").trim();
    return {
      table,
      action: this.isAction(action) ? action : "select",
      columns: Array.isArray(input.columns) ? input.columns.map((col) => String(col)) : undefined,
      filters: this.normalizeFilters(input.filters),
      limit: this.clampNumber(input.limit, 1, 500, 50),
      offset: this.clampNumber(input.offset, 0, 100000, 0),
      sort: input.sort && typeof input.sort === "object" ? (input.sort as QueryRequest["sort"]) : undefined,
      values: input.values && typeof input.values === "object" ? (input.values as Record<string, unknown>) : undefined
    };
  }

  private normalizeFilters(filters: unknown): QueryFilter[] | undefined {
    if (!Array.isArray(filters)) return undefined;
    return filters
      .map((filter) => {
        if (!filter || typeof filter !== "object") return null;
        return {
          field: String((filter as QueryFilter).field ?? ""),
          op: ((filter as QueryFilter).op ?? "eq") as QueryFilter["op"],
          value: (filter as QueryFilter).value
        };
      })
      .filter((filter): filter is QueryFilter => Boolean(filter && filter.field));
  }

  private ensureTable(table: string): Record<string, unknown>[] {
    if (!this.tables.has(table)) {
      this.tables.set(table, []);
    }
    return this.tables.get(table) ?? [];
  }

  private handleSelect(request: QueryRequest, table: Record<string, unknown>[]): QueryResult {
    const filtered = this.applyFilters(table, request.filters);
    const sorted = this.applySort(filtered, request.sort);
    const offset = request.offset ?? 0;
    const limit = request.limit ?? 50;
    const sliced = sorted.slice(offset, offset + limit);
    const rows = request.columns ? sliced.map((row) => this.pickColumns(row, request.columns ?? [])) : sliced;

    return {
      table: request.table,
      action: request.action,
      rows,
      affected: rows.length,
      runtime_ms: 0,
      metadata: {
        total_rows: filtered.length,
        limit,
        offset
      }
    };
  }

  private handleInsert(request: QueryRequest, table: Record<string, unknown>[]): QueryResult {
    const values = request.values ?? {};
    const row = { ...values };
    table.push(row);
    return {
      table: request.table,
      action: request.action,
      rows: [row],
      affected: 1,
      runtime_ms: 0,
      metadata: { total_rows: table.length }
    };
  }

  private handleUpdate(request: QueryRequest, table: Record<string, unknown>[]): QueryResult {
    const values = request.values ?? {};
    const filtered = this.applyFilters(table, request.filters);
    for (const row of filtered) {
      Object.assign(row, values);
    }
    return {
      table: request.table,
      action: request.action,
      rows: filtered,
      affected: filtered.length,
      runtime_ms: 0,
      metadata: { total_rows: table.length }
    };
  }

  private handleDelete(request: QueryRequest, table: Record<string, unknown>[]): QueryResult {
    const filtered = new Set(this.applyFilters(table, request.filters));
    const remaining = table.filter((row) => !filtered.has(row));
    this.tables.set(request.table, remaining);
    return {
      table: request.table,
      action: request.action,
      rows: [],
      affected: filtered.size,
      runtime_ms: 0,
      metadata: { total_rows: remaining.length }
    };
  }

  private applyFilters(rows: Record<string, unknown>[], filters?: QueryFilter[]): Record<string, unknown>[] {
    if (!filters || !filters.length) return [...rows];
    return rows.filter((row) => filters.every((filter) => this.evaluateFilter(row, filter)));
  }

  private evaluateFilter(row: Record<string, unknown>, filter: QueryFilter): boolean {
    const value = row[filter.field];
    const target = filter.value;
    switch (filter.op ?? "eq") {
      case "neq":
        return value !== target;
      case "gt":
        return Number(value) > Number(target);
      case "gte":
        return Number(value) >= Number(target);
      case "lt":
        return Number(value) < Number(target);
      case "lte":
        return Number(value) <= Number(target);
      case "in":
        return Array.isArray(target) ? target.includes(value) : false;
      case "contains":
        return typeof value === "string" && typeof target === "string" ? value.includes(target) : false;
      case "eq":
      default:
        return value === target;
    }
  }

  private applySort(rows: Record<string, unknown>[], sort?: QueryRequest["sort"]): Record<string, unknown>[] {
    if (!sort?.field) return [...rows];
    const direction = sort.direction === "desc" ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = a[sort.field];
      const bv = b[sort.field];
      if (av === bv) return 0;
      return av > bv ? direction : -direction;
    });
  }

  private pickColumns(row: Record<string, unknown>, columns: string[]): Record<string, unknown> {
    const selected: Record<string, unknown> = {};
    for (const column of columns) {
      selected[column] = row[column];
    }
    return selected;
  }

  private isAction(value: string): value is QueryAction {
    return value === "select" || value === "insert" || value === "update" || value === "delete";
  }

  private clampNumber(value: unknown, min: number, max: number, fallback: number): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(min, Math.min(max, num));
  }
}

if (require.main === module) {
  const tool = new DatabaseQuery();
  console.log("[AE3:DatabaseQuery] Testing DatabaseQuery...\n");

  tool
    .execute({
      table: "customers",
      action: "select",
      filters: [{ field: "segment", op: "eq", value: "smb" }],
      sort: { field: "spend", direction: "desc" },
      limit: 2
    })
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      console.log("\n[AE3:DatabaseQuery] ✓ Tests completed");
    })
    .catch((error) => {
      console.error("[AE3:DatabaseQuery] Test failed", error);
    });
}
