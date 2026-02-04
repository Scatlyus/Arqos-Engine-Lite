import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";
import * as crypto from "crypto";

type WebhookPayload = {
  source?: string;
  event?: string;
  headers?: Record<string, string>;
  payload?: unknown;
  signature?: string;
  secret?: string;
  validate_signature?: boolean;
};

type WebhookEvent = {
  id: string;
  source: string;
  event: string;
  payload: unknown;
  headers: Record<string, string>;
  signature_valid: boolean;
  received_at: Date;
};

export class Webhook implements Tool {
  id = "T5";
  name = "Webhook";
  phase = "recebe" as const;
  version = "1.0.0";

  private metrics = {
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    totalDuration: 0,
    eventsReceived: 0,
    signatureValidations: 0,
    validSignatures: 0,
  };

  private eventQueue: WebhookEvent[] = [];
  private readonly MAX_QUEUE_SIZE = 1000;

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.metrics.executionCount++;

    try {
      const payload = (input.webhook ?? input) as WebhookPayload;

      // Validação básica
      const source = typeof payload.source === "string" ? payload.source : "unknown";
      const event = typeof payload.event === "string" ? payload.event : "webhook.received";
      const headers = payload.headers ?? {};

      // Validar assinatura se solicitado
      let signatureValid = true;
      if (payload.validate_signature && payload.signature && payload.secret) {
        this.metrics.signatureValidations++;
        signatureValid = this.validateSignature(
          payload.payload,
          payload.signature,
          payload.secret
        );

        if (signatureValid) {
          this.metrics.validSignatures++;
        } else {
          throw new Error("Invalid webhook signature");
        }
      }

      // Criar evento
      const webhookEvent: WebhookEvent = {
        id: this.generateEventId(),
        source,
        event,
        payload: payload.payload ?? payload,
        headers,
        signature_valid: signatureValid,
        received_at: new Date(),
      };

      // Adicionar à queue
      this.addToQueue(webhookEvent);
      this.metrics.eventsReceived++;
      this.metrics.successCount++;
      this.metrics.totalDuration += Date.now() - startTime;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: {
          event_id: webhookEvent.id,
          received: true,
          source,
          event,
          signature_valid: signatureValid,
          queue_size: this.eventQueue.length,
          processed_at: webhookEvent.received_at,
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
   * Valida assinatura HMAC-SHA256 do webhook
   */
  private validateSignature(
    payload: unknown,
    signature: string,
    secret: string
  ): boolean {
    try {
      const payloadString = typeof payload === "string"
        ? payload
        : JSON.stringify(payload);

      const hmac = crypto.createHmac("sha256", secret);
      hmac.update(payloadString);
      const expectedSignature = hmac.digest("hex");

      // Comparação segura contra timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch {
      return false;
    }
  }

  /**
   * Gera ID único para o evento
   */
  private generateEventId(): string {
    return `webhook_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Adiciona evento à queue (FIFO com limite)
   */
  private addToQueue(event: WebhookEvent): void {
    this.eventQueue.push(event);

    // Manter limite da queue
    if (this.eventQueue.length > this.MAX_QUEUE_SIZE) {
      this.eventQueue.shift(); // Remove o mais antigo
    }
  }

  /**
   * Obtém eventos da queue por filtros
   */
  getEvents(filter?: {
    source?: string;
    event?: string;
    limit?: number;
    since?: Date;
  }): WebhookEvent[] {
    let filtered = [...this.eventQueue];

    if (filter?.source) {
      filtered = filtered.filter((e) => e.source === filter.source);
    }

    if (filter?.event) {
      filtered = filtered.filter((e) => e.event === filter.event);
    }

    if (filter?.since) {
      const sinceDate = filter.since;
      filtered = filtered.filter((e) => e.received_at >= sinceDate);
    }

    if (filter?.limit) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  /**
   * Limpa eventos antigos da queue
   */
  clearOldEvents(olderThan: Date): number {
    const initialSize = this.eventQueue.length;
    this.eventQueue = this.eventQueue.filter((e) => e.received_at >= olderThan);
    return initialSize - this.eventQueue.length;
  }

  /**
   * Limpa toda a queue
   */
  clearQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Retorna estatísticas da queue
   */
  getQueueStats(): {
    size: number;
    oldestEvent?: Date;
    newestEvent?: Date;
    sourceDistribution: Record<string, number>;
    eventDistribution: Record<string, number>;
  } {
    if (this.eventQueue.length === 0) {
      return {
        size: 0,
        sourceDistribution: {},
        eventDistribution: {},
      };
    }

    const sourceDistribution: Record<string, number> = {};
    const eventDistribution: Record<string, number> = {};

    for (const event of this.eventQueue) {
      sourceDistribution[event.source] = (sourceDistribution[event.source] || 0) + 1;
      eventDistribution[event.event] = (eventDistribution[event.event] || 0) + 1;
    }

    return {
      size: this.eventQueue.length,
      oldestEvent: this.eventQueue[0]?.received_at,
      newestEvent: this.eventQueue[this.eventQueue.length - 1]?.received_at,
      sourceDistribution,
      eventDistribution,
    };
  }

  async healthCheck(): Promise<ToolHealth> {
    try {
      // Teste simples de recebimento
      const testResult = await this.execute({
        source: "health_check",
        event: "test",
        payload: { test: true },
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
        status: testResult.success ? "healthy" : "down",
        last_check: new Date(),
        avg_latency_ms: avgLatency,
        success_rate: successRate,
      };
    } catch {
      return {
        tool_name: this.name,
        status: "down",
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
      signatureValidationRate:
        this.metrics.signatureValidations > 0
          ? this.metrics.validSignatures / this.metrics.signatureValidations
          : 0,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      eventsReceived: 0,
      signatureValidations: 0,
      validSignatures: 0,
    };
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE3:Webhook] Testing Webhook Tool...\n");

  async function runTests() {
    const tool = new Webhook();

    // Teste 1: Receber webhook simples
    console.log("=== Teste 1: Webhook Simples ===");
    const result1 = await tool.execute({
      source: "github",
      event: "push",
      payload: { ref: "refs/heads/main", commits: [] },
    });
    console.log(result1.success ? "✓" : "✗", JSON.stringify(result1.output, null, 2));

    // Teste 2: Webhook com headers
    console.log("\n=== Teste 2: Webhook com Headers ===");
    const result2 = await tool.execute({
      source: "stripe",
      event: "payment.succeeded",
      headers: {
        "X-Stripe-Signature": "test_sig",
        "Content-Type": "application/json",
      },
      payload: { amount: 1000, currency: "usd" },
    });
    console.log(result2.success ? "✓" : "✗", "Received:", (result2.output as any)?.event_id);

    // Teste 3: Validação de assinatura (válida)
    console.log("\n=== Teste 3: Validação de Assinatura (Válida) ===");
    const secret = "my_secret_key";
    const payload = { test: "data" };
    const hmac = require("crypto").createHmac("sha256", secret);
    hmac.update(JSON.stringify(payload));
    const validSignature = hmac.digest("hex");

    const result3 = await tool.execute({
      source: "custom",
      event: "test",
      payload,
      signature: validSignature,
      secret,
      validate_signature: true,
    });
    console.log(result3.success ? "✓" : "✗", "Signature valid:", (result3.output as any)?.signature_valid);

    // Teste 4: Validação de assinatura (inválida)
    console.log("\n=== Teste 4: Validação de Assinatura (Inválida) ===");
    const result4 = await tool.execute({
      source: "custom",
      event: "test",
      payload: { test: "data" },
      signature: "invalid_signature_12345",
      secret,
      validate_signature: true,
    });
    console.log(result4.success ? "✗ UNEXPECTED" : "✓ EXPECTED FAIL");

    // Teste 5: Estatísticas da queue
    console.log("\n=== Teste 5: Estatísticas da Queue ===");
    const stats = tool.getQueueStats();
    console.log("✓ Queue Stats:", JSON.stringify(stats, null, 2));

    // Teste 6: Filtrar eventos
    console.log("\n=== Teste 6: Filtrar Eventos ===");
    const events = tool.getEvents({ source: "github", limit: 2 });
    console.log("✓ Filtered Events:", events.length);

    // Teste 7: Health Check
    console.log("\n=== Teste 7: Health Check ===");
    const health = await tool.healthCheck();
    console.log(health.status === "healthy" ? "✓" : "✗", "Status:", health.status);

    // Teste 8: Métricas
    console.log("\n=== Teste 8: Métricas ===");
    const metrics = tool.getMetrics();
    console.log("✓ Metrics:", JSON.stringify(metrics, null, 2));

    console.log("\n[AE3:Webhook] ✓ Testes concluídos");
  }

  runTests().catch(console.error);
}
