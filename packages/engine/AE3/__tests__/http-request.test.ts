import { HTTPRequest } from "../tools/recebe/http-request";

describe("AE3 HTTPRequest Tool", () => {
  let tool: HTTPRequest;

  beforeEach(() => {
    tool = new HTTPRequest();
    tool.resetMetrics();
  });

  describe("Basic Properties", () => {
    it("deve ter propriedades corretas", () => {
      expect(tool.id).toBe("T4");
      expect(tool.name).toBe("HTTPRequest");
      expect(tool.phase).toBe("recebe");
      expect(tool.version).toBe("1.0.0");
    });
  });

  describe("Input Validation", () => {
    it("deve rejeitar requisição sem URL", async () => {
      const result = await tool.execute({});

      expect(result.success).toBe(false);
      expect(result.error).toContain("url is required");
    });

    it("deve rejeitar URL inválida", async () => {
      const result = await tool.execute({
        url: "not-a-valid-url",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid URL format");
    });

    it("deve rejeitar método HTTP inválido", async () => {
      const result = await tool.execute({
        url: "https://example.com",
        method: "INVALID",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid HTTP method");
    });
  });

  describe("GET Requests", () => {
    it("deve realizar GET request simples", async () => {
      const result = await tool.execute({
        url: "https://jsonplaceholder.typicode.com/posts/1",
        method: "GET",
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      const output = result.output as any;
      expect(output?.response?.status_code).toBe(200);
      expect(result.duration_ms).toBeGreaterThan(0);
    }, 10000);

    it("deve incluir headers customizados na requisição", async () => {
      const result = await tool.execute({
        url: "https://httpbin.org/headers",
        method: "GET",
        headers: {
          "X-Custom-Header": "TestValue",
        },
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
    }, 10000);
  });

  describe("POST Requests", () => {
    it("deve realizar POST request com body JSON", async () => {
      const result = await tool.execute({
        url: "https://jsonplaceholder.typicode.com/posts",
        method: "POST",
        body: {
          title: "Test",
          body: "Test body",
          userId: 1,
        },
      });

      expect(result.success).toBe(true);
      expect(result.output).toBeDefined();
      const output = result.output as any;
      expect(output?.response?.status_code).toBe(201);
    }, 10000);
  });

  describe("Error Handling", () => {
    it("deve tratar erro 404 sem retry", async () => {
      const result = await tool.execute({
        url: "https://jsonplaceholder.typicode.com/posts/99999999",
        method: "GET",
        retries: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 404");
    }, 10000);

    it("deve aplicar retry em erros 5xx", async () => {
      const startTime = Date.now();

      const result = await tool.execute({
        url: "https://httpbin.org/status/500",
        method: "GET",
        retries: 2,
        retry_delay_ms: 500,
      });

      const duration = Date.now() - startTime;

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 500");
      // Verificar que houve retry (tempo deve ser > 1s devido aos delays)
      expect(duration).toBeGreaterThan(1000);
    }, 15000);

    it("deve respeitar timeout", async () => {
      const result = await tool.execute({
        url: "https://httpbin.org/delay/10",
        method: "GET",
        timeout_ms: 2000,
        retries: 0,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("timeout");
    }, 15000);
  });

  describe("Metrics", () => {
    it("deve rastrear métricas de execução", async () => {
      // Executar algumas requisições
      await tool.execute({
        url: "https://jsonplaceholder.typicode.com/posts/1",
        method: "GET",
      });

      await tool.execute({
        url: "https://jsonplaceholder.typicode.com/posts/2",
        method: "GET",
      });

      const metrics = tool.getMetrics();

      expect(metrics.executionCount).toBe(2);
      expect(metrics.successCount).toBeGreaterThan(0);
      expect(metrics.averageDuration).toBeGreaterThan(0);
      expect(metrics.successRate).toBeGreaterThan(0);
    }, 15000);

    it("deve resetar métricas", () => {
      const metrics = tool.getMetrics();
      expect(metrics.executionCount).toBe(0);

      tool.resetMetrics();

      const metricsAfter = tool.getMetrics();
      expect(metricsAfter.executionCount).toBe(0);
      expect(metricsAfter.successCount).toBe(0);
    });
  });

  describe("Health Check", () => {
    it("deve retornar status healthy quando operacional", async () => {
      const health = await tool.healthCheck();

      expect(health.tool_name).toBe("HTTPRequest");
      expect(health.status).toBe("healthy");
      expect(health.last_check).toBeInstanceOf(Date);
    }, 15000);
  });

  describe("Persistence", () => {
    it("deve gravar métricas no sink quando fornecido", async () => {
      const mockSink = {
        record: jest.fn().mockResolvedValue(undefined)
      };
      // @ts-ignore - Mock doesn't need to implement full MetricsSink interface if we only use record
      const toolWithSink = new HTTPRequest(mockSink);

      await toolWithSink.execute({
        url: "https://jsonplaceholder.typicode.com/posts/1",
        method: "GET"
      });

      expect(mockSink.record).toHaveBeenCalled();
      expect(mockSink.record).toHaveBeenCalledWith(expect.objectContaining({
        tool_id: "T4",
        metricData: expect.objectContaining({
          success: true,
          url: "https://jsonplaceholder.typicode.com/posts/1"
        })
      }));
    }, 10000);
  });
});
