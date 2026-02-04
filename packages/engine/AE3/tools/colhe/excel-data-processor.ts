import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

/**
 * Representa uma célula do Excel com metadados
 */
type CellData = {
  value: string | number | boolean | null;
  type: "string" | "number" | "boolean" | "date" | "formula" | "empty";
  row: number;
  col: number;
  formatted?: string;
};

/**
 * Representa uma planilha completa
 */
type SheetData = {
  name: string;
  rows: number;
  cols: number;
  data: CellData[][];
  headers?: string[];
};

/**
 * Opções de processamento
 */
type ProcessorOptions = {
  hasHeaders?: boolean;
  skipEmptyRows?: boolean;
  trimValues?: boolean;
  inferTypes?: boolean;
  dateFormat?: string;
  sheetName?: string;
  range?: { startRow?: number; endRow?: number; startCol?: number; endCol?: number };
};

/**
 * Formato de exportação
 */
type ExportFormat = "json" | "csv" | "tsv" | "array";

/**
 * Estatísticas de processamento
 */
type ProcessingStats = {
  totalRows: number;
  totalCols: number;
  emptyRows: number;
  processedRows: number;
  dataTypes: Record<string, number>;
  processingTime: number;
};

/**
 * AE3 Tool: ExcelDataProcessor
 *
 * **Fase**: COLHE (Data Collection & Integration)
 * **Propósito**: Extração, parsing e processamento de dados de planilhas (Excel/CSV)
 *
 * **Funcionalidades**:
 * - Parse de dados CSV/TSV (simulação de Excel para ambiente Node.js puro)
 * - Inferência automática de tipos de dados
 * - Suporte a cabeçalhos e ranges customizados
 * - Exportação em múltiplos formatos
 * - Estatísticas de processamento em tempo real
 * - Validação e limpeza de dados
 */
export class ExcelDataProcessor implements Tool {
  id = "T10";
  name = "ExcelDataProcessor";
  phase = "colhe" as const;
  version = "2.0.0";

  private executionCount = 0;
  private totalDuration = 0;
  private successCount = 0;
  private processingStats: Map<string, ProcessingStats> = new Map();

  constructor() {}

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      const rawData = this.extractRawData(input);
      const options = this.extractOptions(input);
      const format = this.extractFormat(input);

      // Parse dos dados
      const sheetData = this.parseData(rawData, options);

      // Processar e transformar
      const processed = this.processSheet(sheetData, options);

      // Exportar no formato solicitado
      const exported = this.exportData(processed, format);

      // Calcular estatísticas
      const stats = this.calculateStats(processed, startTime);

      const duration = Date.now() - startTime;
      this.totalDuration += duration;
      this.successCount++;

      // Armazenar estatísticas
      this.processingStats.set(`exec_${this.executionCount}`, stats);

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: {
          data: exported,
          stats,
          metadata: {
            sheetName: sheetData.name,
            format,
            hasHeaders: options.hasHeaders ?? false,
            rowCount: processed.data.length,
            colCount: processed.cols
          }
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
      status: successRate > 0.95 ? "healthy" : successRate > 0.8 ? "degraded" : "unhealthy",
      last_check: new Date(),
      avg_latency_ms: Math.round(avgLatency),
      success_rate: Number(successRate.toFixed(2))
    };
  }

  /**
   * Retorna estatísticas agregadas de todas as execuções
   */
  getAggregatedStats(): {
    totalExecutions: number;
    totalRowsProcessed: number;
    avgProcessingTime: number;
    dataTypeDistribution: Record<string, number>;
  } {
    let totalRows = 0;
    let totalTime = 0;
    const typeDistribution: Record<string, number> = {};

    this.processingStats.forEach((stat) => {
      totalRows += stat.processedRows;
      totalTime += stat.processingTime;

      Object.entries(stat.dataTypes).forEach(([type, count]) => {
        typeDistribution[type] = (typeDistribution[type] || 0) + count;
      });
    });

    return {
      totalExecutions: this.processingStats.size,
      totalRowsProcessed: totalRows,
      avgProcessingTime: this.processingStats.size > 0 ? totalTime / this.processingStats.size : 0,
      dataTypeDistribution: typeDistribution
    };
  }

  private extractRawData(input: ToolInput): string {
    if (typeof input.data === "string") {
      return input.data;
    }
    if (typeof input.text === "string") {
      return input.text;
    }
    if (typeof input.payload === "string") {
      return input.payload;
    }

    throw new Error("Invalid input: expected string data (CSV/TSV format)");
  }

  private extractOptions(input: ToolInput): ProcessorOptions {
    const opts = (input.options as ProcessorOptions | undefined) || {};

    return {
      hasHeaders: opts.hasHeaders ?? true,
      skipEmptyRows: opts.skipEmptyRows ?? true,
      trimValues: opts.trimValues ?? true,
      inferTypes: opts.inferTypes ?? true,
      dateFormat: opts.dateFormat,
      sheetName: opts.sheetName ?? "Sheet1",
      range: opts.range
    };
  }

  private extractFormat(input: ToolInput): ExportFormat {
    const format = (input as { format?: string }).format;
    if (format === "json" || format === "csv" || format === "tsv" || format === "array") {
      return format;
    }
    return "json";
  }

  private parseData(rawData: string, options: ProcessorOptions): SheetData {
    // Detectar delimitador (CSV ou TSV)
    const delimiter = rawData.includes("\t") ? "\t" : ",";

    // Split por linhas
    const lines = rawData.split(/\r?\n/).filter((line) => {
      if (options.skipEmptyRows) {
        return line.trim().length > 0;
      }
      return true;
    });

    if (lines.length === 0) {
      throw new Error("No data found in input");
    }

    // Parse das linhas
    const rows: string[][] = [];
    for (const line of lines) {
      const cells = this.parseLine(line, delimiter, options.trimValues);
      rows.push(cells);
    }

    // Aplicar range se especificado
    const filteredRows = this.applyRange(rows, options.range);

    // Extrair headers se solicitado
    let headers: string[] | undefined;
    let dataRows = filteredRows;

    if (options.hasHeaders && filteredRows.length > 0) {
      headers = filteredRows[0];
      dataRows = filteredRows.slice(1);
    }

    // Converter para CellData
    const cellData = this.convertToCellData(dataRows, options);

    return {
      name: options.sheetName || "Sheet1",
      rows: cellData.length,
      cols: cellData.length > 0 ? cellData[0].length : 0,
      data: cellData,
      headers
    };
  }

  private parseLine(line: string, delimiter: string, trim: boolean = true): string[] {
    // Parser simples para CSV (não lida com aspas complexas)
    const cells = line.split(delimiter);
    return trim ? cells.map((c) => c.trim()) : cells;
  }

  private applyRange(
    rows: string[][],
    range?: { startRow?: number; endRow?: number; startCol?: number; endCol?: number }
  ): string[][] {
    if (!range) {
      return rows;
    }

    const startRow = range.startRow ?? 0;
    const endRow = range.endRow ?? rows.length;
    const startCol = range.startCol ?? 0;
    const endCol = range.endCol;

    return rows.slice(startRow, endRow).map((row) => {
      if (endCol !== undefined) {
        return row.slice(startCol, endCol);
      }
      return row.slice(startCol);
    });
  }

  private convertToCellData(rows: string[][], options: ProcessorOptions): CellData[][] {
    return rows.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        const type = options.inferTypes ? this.inferType(cell) : "string";
        const value = this.convertValue(cell, type);

        return {
          value,
          type,
          row: rowIndex,
          col: colIndex,
          formatted: cell
        };
      })
    );
  }

  private inferType(value: string): CellData["type"] {
    if (value === "" || value === null) {
      return "empty";
    }

    // Número
    if (/^-?\d+(\.\d+)?$/.test(value)) {
      return "number";
    }

    // Boolean
    if (value.toLowerCase() === "true" || value.toLowerCase() === "false") {
      return "boolean";
    }

    // Data (formato ISO ou brasileiro)
    if (/^\d{4}-\d{2}-\d{2}/.test(value) || /^\d{2}\/\d{2}\/\d{4}/.test(value)) {
      return "date";
    }

    // Fórmula (Excel)
    if (value.startsWith("=")) {
      return "formula";
    }

    return "string";
  }

  private convertValue(value: string, type: CellData["type"]): string | number | boolean | null {
    switch (type) {
      case "number":
        return parseFloat(value);
      case "boolean":
        return value.toLowerCase() === "true";
      case "empty":
        return null;
      case "date":
      case "formula":
      case "string":
      default:
        return value;
    }
  }

  private processSheet(sheetData: SheetData, options: ProcessorOptions): SheetData {
    // Nesta versão, apenas retornamos os dados processados
    // Futuras versões podem adicionar transformações adicionais
    return sheetData;
  }

  private exportData(sheetData: SheetData, format: ExportFormat): unknown {
    switch (format) {
      case "json":
        return this.exportAsJSON(sheetData);
      case "csv":
        return this.exportAsCSV(sheetData);
      case "tsv":
        return this.exportAsTSV(sheetData);
      case "array":
        return this.exportAsArray(sheetData);
      default:
        return this.exportAsJSON(sheetData);
    }
  }

  private exportAsJSON(sheetData: SheetData): Record<string, unknown>[] | unknown[][] {
    if (sheetData.headers) {
      // Exportar como array de objetos
      return sheetData.data.map((row) => {
        const obj: Record<string, unknown> = {};
        row.forEach((cell, index) => {
          const header = sheetData.headers![index] || `col_${index}`;
          obj[header] = cell.value;
        });
        return obj;
      });
    } else {
      // Exportar como array de arrays
      return sheetData.data.map((row) => row.map((cell) => cell.value));
    }
  }

  private exportAsCSV(sheetData: SheetData): string {
    const rows: string[] = [];

    if (sheetData.headers) {
      rows.push(sheetData.headers.join(","));
    }

    sheetData.data.forEach((row) => {
      const values = row.map((cell) => {
        const val = cell.value === null ? "" : String(cell.value);
        // Escape aspas
        return val.includes(",") ? `"${val.replace(/"/g, '""')}"` : val;
      });
      rows.push(values.join(","));
    });

    return rows.join("\n");
  }

  private exportAsTSV(sheetData: SheetData): string {
    const rows: string[] = [];

    if (sheetData.headers) {
      rows.push(sheetData.headers.join("\t"));
    }

    sheetData.data.forEach((row) => {
      const values = row.map((cell) => (cell.value === null ? "" : String(cell.value)));
      rows.push(values.join("\t"));
    });

    return rows.join("\n");
  }

  private exportAsArray(sheetData: SheetData): unknown[][] {
    return sheetData.data.map((row) => row.map((cell) => cell.value));
  }

  private calculateStats(sheetData: SheetData, startTime: number): ProcessingStats {
    const dataTypes: Record<string, number> = {};
    let emptyRows = 0;

    sheetData.data.forEach((row) => {
      const isEmpty = row.every((cell) => cell.type === "empty");
      if (isEmpty) {
        emptyRows++;
      }

      row.forEach((cell) => {
        dataTypes[cell.type] = (dataTypes[cell.type] || 0) + 1;
      });
    });

    return {
      totalRows: sheetData.rows,
      totalCols: sheetData.cols,
      emptyRows,
      processedRows: sheetData.rows - emptyRows,
      dataTypes,
      processingTime: Date.now() - startTime
    };
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE3:ExcelDataProcessor] Testando ExcelDataProcessor...\n");

  async function runTests() {
    const processor = new ExcelDataProcessor();

    // Teste 1: CSV simples com headers
    console.log("=== Teste 1: CSV Simples com Headers ===");
    const csvData1 = `nome,idade,email
João Silva,30,joao@email.com
Maria Santos,25,maria@email.com
Pedro Oliveira,35,pedro@email.com`;

    const result1 = await processor.execute({
      data: csvData1,
      options: { hasHeaders: true, inferTypes: true }
    });

    if (result1.success) {
      console.log("Formato:", result1.output.metadata.format);
      console.log("Linhas processadas:", result1.output.metadata.rowCount);
      console.log("Colunas:", result1.output.metadata.colCount);
      console.log("Dados (primeiras 2 linhas):");
      console.log(JSON.stringify((result1.output.data as unknown[]).slice(0, 2), null, 2));
      console.log("Stats:", result1.output.stats);
    }

    // Teste 2: TSV sem headers
    console.log("\n=== Teste 2: TSV Sem Headers ===");
    const tsvData = `100\t200\t300
400\t500\t600
700\t800\t900`;

    const result2 = await processor.execute({
      text: tsvData,
      options: { hasHeaders: false, inferTypes: true }
    });

    if (result2.success) {
      console.log("Dados numéricos processados:");
      console.log(result2.output.data);
      console.log("Tipos detectados:", result2.output.stats.dataTypes);
    }

    // Teste 3: CSV com tipos mistos
    console.log("\n=== Teste 3: CSV com Tipos Mistos ===");
    const mixedData = `produto,preco,disponivel,data
Notebook,2500.50,true,2026-01-15
Mouse,45.90,false,2026-01-16
Teclado,150.00,true,2026-01-17`;

    const result3 = await processor.execute({
      data: mixedData,
      options: { hasHeaders: true, inferTypes: true },
      format: "json"
    });

    if (result3.success) {
      console.log("Dados com tipos inferidos:");
      console.log(JSON.stringify(result3.output.data, null, 2));
      console.log("\nDistribuição de tipos:", result3.output.stats.dataTypes);
    }

    // Teste 4: Exportação em CSV
    console.log("\n=== Teste 4: Exportação em CSV ===");
    const result4 = await processor.execute({
      data: mixedData,
      options: { hasHeaders: true },
      format: "csv"
    });

    if (result4.success) {
      console.log("CSV exportado:");
      console.log(result4.output.data);
    }

    // Teste 5: Range customizado
    console.log("\n=== Teste 5: Range Customizado (linhas 1-2, colunas 0-2) ===");
    const largeData = `A,B,C,D,E
1,2,3,4,5
6,7,8,9,10
11,12,13,14,15
16,17,18,19,20`;

    const result5 = await processor.execute({
      data: largeData,
      options: {
        hasHeaders: true,
        range: { startRow: 0, endRow: 3, startCol: 0, endCol: 3 }
      }
    });

    if (result5.success) {
      console.log("Dados com range aplicado:");
      console.log(JSON.stringify(result5.output.data, null, 2));
      console.log("Dimensões:", result5.output.metadata.rowCount, "x", result5.output.metadata.colCount);
    }

    // Teste 6: Health check e estatísticas agregadas
    console.log("\n=== Teste 6: Health Check e Estatísticas Agregadas ===");
    const health = await processor.healthCheck();
    console.log("Status:", health.status);
    console.log("Latência média:", health.avg_latency_ms, "ms");
    console.log("Taxa de sucesso:", (health.success_rate * 100).toFixed(0), "%");

    const aggregated = processor.getAggregatedStats();
    console.log("\nEstatísticas agregadas:");
    console.log("  Total de execuções:", aggregated.totalExecutions);
    console.log("  Total de linhas processadas:", aggregated.totalRowsProcessed);
    console.log("  Tempo médio de processamento:", aggregated.avgProcessingTime.toFixed(2), "ms");
    console.log("  Distribuição de tipos:");
    Object.entries(aggregated.dataTypeDistribution).forEach(([type, count]) => {
      console.log(`    - ${type}: ${count}`);
    });

    console.log("\n[AE3:ExcelDataProcessor] ✓ Testes concluídos");
  }

  runTests().catch(console.error);
}
