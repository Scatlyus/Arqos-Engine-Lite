import { ArqosError, withRetry, MetricsSink } from "@arqos/utils";
import { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type HttpRequestPayload = {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeout_ms?: number;
  retries?: number;
  retry_delay_ms?: number;
};

export class HTTPRequest implements Tool {
  id = "T4";
  name = "HTTPRequest";
  phase = "recebe" as const;
  version = "1.0.0";

  private metricsSink?: MetricsSink;

  private metrics = {
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    totalDuration: 0,
  };

  constructor(sink?: MetricsSink) {
    this.metricsSink = sink;
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.metrics.executionCount++;

    try {
      const payload = (input.request ?? input) as HttpRequestPayload;

      // Validação
      const url = typeof payload.url === "string" ? payload.url.trim() : "";
      if (!url) {
        throw new Error("Invalid input: url is required");
      }

      // Validar URL format
      try {
        new URL(url);
      } catch {
        throw new Error(`Invalid URL format: ${url} `);
      }

      const method = String(payload.method ?? "GET").toUpperCase();
      const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
      if (!validMethods.includes(method)) {
        throw new Error(`Invalid HTTP method: ${method} `);
      }

      const headers = payload.headers ?? {};
      const body = payload.body;
      const timeout = payload.timeout_ms ?? 30000; // 30s default
      const retries = payload.retries ?? 2; // 2 retries default
      const retryDelay = payload.retry_delay_ms ?? 1000; // 1s default

      // Executar request com retry usando o utilitário centralizado
      const response = await withRetry(
        () => this.makeRequest(url, method, headers, body, timeout),
        {
          retries,
          delay: retryDelay,
          shouldRetry: (error: unknown) => {
            // Não fazer retry em erros 4xx (client errors)
            if (error instanceof Error && error.message.includes("HTTP 4")) {
              return false;
            }
            return true;
          },
          onRetry: (attempt: number, error: unknown, nextDelay: number) => {
            const msg = error instanceof Error ? error.message : String(error);
            console.log(
              `[AE3:HTTP] Tentativa ${attempt} falhou: ${msg}.` +
              `Retentando em ${nextDelay}ms...`
            );
          }
        }
      );

      const duration = Date.now() - startTime;
      this.metrics.successCount++;
      this.metrics.totalDuration += duration;

      if (this.metricsSink) {
        this.metricsSink.record({
          tool_id: this.id,
          metricData: {
            duration_ms: duration,
            success: true,
            status_code: response.status,
            url
          },
          timestamp: new Date()
        });
      }

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: {
          request: { url, method, headers, body, timeout_ms: timeout },
          response: {
            status_code: response.status,
            status_text: response.statusText,
            headers: response.headers,
            body: response.data
          }
        },
        duration_ms: duration,
        timestamp: new Date()
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failureCount++;
      const message = error instanceof Error ? error.message : "Unknown error";

      if (this.metricsSink) {
        this.metricsSink.record({
          tool_id: this.id,
          metricData: {
            duration_ms: duration,
            success: false,
            error: message
          },
          timestamp: new Date()
        });
      }

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

  /**
   * Realiza requisição HTTP real com fetch API e timeout
   */
  private async makeRequest(
    url: string,
    method: string,
    headers: Record<string, string>,
    body: unknown,
    timeout: number
  ): Promise<{ status: number; statusText: string; headers: Record<string, string>; data: unknown }> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const requestInit: RequestInit = {
        method,
        headers,
        signal: controller.signal,
      };

      // Adicionar body para métodos que suportam
      if (body && ["POST", "PUT", "PATCH"].includes(method)) {
        requestInit.body = typeof body === "string" ? body : JSON.stringify(body);

        // Garantir Content-Type se não fornecido
        if (!headers["Content-Type"] && !headers["content-type"]) {
          requestInit.headers = {
            ...headers,
            "Content-Type": "application/json",
          };
        }
      }

      const response = await fetch(url, requestInit);

      // Coletar headers da resposta
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Parsear body da resposta
      let data: unknown;
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else if (contentType.includes("text/")) {
        data = await response.text();
      } else {
        // Binary data (arraybuffer)
        const buffer = await response.arrayBuffer();
        data = Buffer.from(buffer).toString("base64");
      }

      // Verificar status HTTP
      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status} ${response.statusText}: ${JSON.stringify(data).substring(0, 200)} `
        );
      }

      return {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data,
      };
    } catch (error: unknown) {
      if (isAbortError(error)) {
        throw new ArqosError(`Request timeout after ${timeout} ms`, "ETIMEDOUT", error instanceof Error ? error : undefined);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }


  /**
   * Health check - testa conectividade com endpoint público
   */
  async healthCheck(): Promise<ToolHealth> {
    try {
      const result = await this.execute({
        url: "https://httpbin.org/status/200",
        method: "GET",
        timeout_ms: 5000,
        retries: 1,
      });

      const avgLatency = this.metrics.successCount > 0
        ? this.metrics.totalDuration / this.metrics.successCount
        : 0;

      const successRate = this.metrics.executionCount > 0
        ? this.metrics.successCount / this.metrics.executionCount
        : 0;

      return {
        tool_name: this.name,
        status: result.success ? "healthy" : "down",
        last_check: new Date(),
        avg_latency_ms: avgLatency,
        success_rate: successRate,
      };
    } catch (err) {
      console.error(`[AE3:HTTP] Health check failed:`, err);
      return {
        tool_name: this.name,
        status: "down",
        last_check: new Date(),
        avg_latency_ms: 0,
        success_rate: 0,
      };
    }
  }

  /**
   * Retorna métricas de uso
   */
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

  /**
   * Reseta métricas (útil para testes)
   */
  resetMetrics(): void {
    this.metrics = {
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
    };
  }
}


function isAbortError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false;

  const err = error as Record<string, unknown>;

  return (
    err.name === "AbortError" ||
    err.code === "ETIMEDOUT" ||
    String(err).includes("AbortError") ||
    String(err).includes("aborted")
  );
}

// ========== CLI para testes ==========


if (require.main === module) {
  console.log("[AE3:HTTP-Request] Testing HTTP Request Tool...\n");

  async function runTests() {
    const tool = new HTTPRequest();

    // Teste 1: GET request simples
    console.log("=== Teste 1: GET Request (JSONPlaceholder) ===");
    const result1 = await tool.execute({
      url: "https://jsonplaceholder.typicode.com/posts/1",
      method: "GET",
    });
    console.log(result1.success ? "✓" : "✗", "Status:", result1.success);
    console.log("Duration:", result1.duration_ms, "ms");
    if (result1.output) {
      console.log("Data preview:", JSON.stringify(result1.output).substring(0, 100) + "...");
    }

    // Teste 2: POST request com body
    console.log("\n=== Teste 2: POST Request com Body ===");
    const result2 = await tool.execute({
      url: "https://jsonplaceholder.typicode.com/posts",
      method: "POST",
      body: {
        title: "Test Post",
        body: "This is a test from Arqos Engine",
        userId: 1,
      },
    });
    console.log(result2.success ? "✓" : "✗", "Status:", result2.success);
    if (result2.output) {
      console.log("Created:", JSON.stringify(result2.output).substring(0, 150));
    }

    // Teste 3: Request com headers customizados
    console.log("\n=== Teste 3: Request com Headers Customizados ===");
    const result3 = await tool.execute({
      url: "https://httpbin.org/headers",
      method: "GET",
      headers: {
        "X-Custom-Header": "ArqosEngine",
        "User-Agent": "AE3-HTTP-Request-Tool/1.0",
      },
    });
    console.log(result3.success ? "✓" : "✗", "Status:", result3.success);

    // Teste 4: Timeout (deve falhar)
    console.log("\n=== Teste 4: Timeout (Esperado Falhar) ===");
    const result4 = await tool.execute({
      url: "https://httpbin.org/delay/10",
      method: "GET",
      timeout_ms: 2000, // 2s timeout para endpoint que demora 10s
      retries: 0,
    });
    console.log(result4.success ? "✗ UNEXPECTED" : "✓ EXPECTED FAIL");
    if (result4.error) {
      console.log("Error:", result4.error);
    }

    // Teste 5: Retry em erro 5xx
    console.log("\n=== Teste 5: Retry em Erro 500 ===");
    const result5 = await tool.execute({
      url: "https://httpbin.org/status/500",
      method: "GET",
      retries: 2,
      retry_delay_ms: 500,
    });
    console.log(result5.success ? "✗ UNEXPECTED" : "✓ EXPECTED FAIL");
    if (result5.error) {
      console.log("Error:", result5.error);
    }

    // Teste 6: Health check
    console.log("\n=== Teste 6: Health Check ===");
    const health = await tool.healthCheck();
    console.log(health.status === "healthy" ? "✓" : "✗", "Status:", health.status);

    // Teste 7: Métricas
    console.log("\n=== Teste 7: Métricas de Uso ===");
    const metrics = tool.getMetrics();
    console.log("✓ Métricas:", JSON.stringify(metrics, null, 2));

    console.log("\n[AE3:HTTP-Request] ✓ Testes concluídos");
  }

  runTests().catch(console.error);
}
