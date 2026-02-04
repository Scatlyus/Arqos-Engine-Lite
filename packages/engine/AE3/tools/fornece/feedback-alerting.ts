import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

/**
 * Nível de severidade do alerta
 */
type AlertLevel = "info" | "warning" | "error" | "critical";

/**
 * Canais de entrega de alertas
 */
type AlertChannel = "console" | "email" | "slack" | "webhook" | "sms";

/**
 * Representa um alerta
 */
type Alert = {
  id: string;
  level: AlertLevel;
  title: string;
  message: string;
  channel: AlertChannel[];
  metadata?: Record<string, unknown>;
  timestamp: Date;
  acknowledged: boolean;
};

/**
 * Configuração de regras de alerta
 */
type AlertRule = {
  name: string;
  condition: (data: Record<string, unknown>) => boolean;
  level: AlertLevel;
  message: string;
  channels: AlertChannel[];
  enabled: boolean;
};

/**
 * Opções de entrega
 */
type DeliveryOptions = {
  channels?: AlertChannel[];
  throttleMs?: number;
  retryAttempts?: number;
  batchSize?: number;
};

/**
 * Estatísticas de alertas
 */
type AlertStats = {
  totalAlerts: number;
  byLevel: Record<AlertLevel, number>;
  byChannel: Record<AlertChannel, number>;
  acknowledgedCount: number;
  failedDeliveries: number;
};

/**
 * AE3 Tool: FeedbackAndAlerting
 *
 * **Fase**: FORNECE (Output & Delivery)
 * **Propósito**: Sistema inteligente de feedback e alertas multi-canal
 *
 * **Funcionalidades**:
 * - Criação e gerenciamento de alertas com múltiplos níveis de severidade
 * - Entrega multi-canal (console, email, slack, webhook, sms)
 * - Regras de alerta configuráveis e condicionais
 * - Throttling e deduplicação de alertas
 * - Rastreamento e estatísticas de entrega
 * - Sistema de reconhecimento (acknowledge) de alertas
 */
export class FeedbackAndAlerting implements Tool {
  id = "T20";
  name = "FeedbackAndAlerting";
  phase = "fornece" as const;
  version = "2.0.0";

  private executionCount = 0;
  private totalDuration = 0;
  private successCount = 0;
  private alertHistory: Map<string, Alert> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private deliveryThrottle: Map<string, number> = new Map();
  private stats: AlertStats = {
    totalAlerts: 0,
    byLevel: { info: 0, warning: 0, error: 0, critical: 0 },
    byChannel: { console: 0, email: 0, slack: 0, webhook: 0, sms: 0 },
    acknowledgedCount: 0,
    failedDeliveries: 0
  };

  constructor() {
    this.initializeDefaultRules();
  }

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.executionCount++;

    try {
      const operation = this.extractOperation(input);

      let result;
      switch (operation) {
        case "send":
          result = await this.sendAlert(input);
          break;
        case "evaluate":
          result = await this.evaluateRules(input);
          break;
        case "acknowledge":
          result = this.acknowledgeAlert(input);
          break;
        case "stats":
          result = this.getStats();
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      const duration = Date.now() - startTime;
      this.totalDuration += duration;
      this.successCount++;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: result,
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
      status: successRate > 0.95 ? "healthy" : successRate > 0.8 ? "degraded" : "down",
      last_check: new Date(),
      avg_latency_ms: Math.round(avgLatency),
      success_rate: Number(successRate.toFixed(2))
    };
  }

  /**
   * Retorna histórico de alertas
   */
  getAlertHistory(): Alert[] {
    return Array.from(this.alertHistory.values());
  }

  /**
   * Adiciona ou atualiza uma regra de alerta
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.name, rule);
  }

  /**
   * Remove uma regra de alerta
   */
  removeAlertRule(ruleName: string): boolean {
    return this.alertRules.delete(ruleName);
  }

  private initializeDefaultRules(): void {
    this.alertRules.set("high-error-rate", {
      name: "high-error-rate",
      condition: (data) => {
        const errorRate = Number(data.errorRate ?? 0);
        return errorRate > 0.1; // 10%
      },
      level: "error",
      message: "Taxa de erro elevada detectada",
      channels: ["console", "slack"],
      enabled: true
    });

    this.alertRules.set("critical-failure", {
      name: "critical-failure",
      condition: (data) => {
        return data.status === "failed" && data.severity === "critical";
      },
      level: "critical",
      message: "Falha crítica no sistema",
      channels: ["console", "email", "sms"],
      enabled: true
    });

    this.alertRules.set("low-performance", {
      name: "low-performance",
      condition: (data) => {
        const latency = Number(data.latency ?? 0);
        return latency > 5000; // 5s
      },
      level: "warning",
      message: "Performance abaixo do esperado",
      channels: ["console"],
      enabled: true
    });
  }

  private extractOperation(input: ToolInput): "send" | "evaluate" | "acknowledge" | "stats" {
    const op = input.operation as string | undefined;

    if (op === "send" || op === "evaluate" || op === "acknowledge" || op === "stats") {
      return op;
    }

    return "send"; // default
  }

  private async sendAlert(input: ToolInput): Promise<unknown> {
    const level = this.extractLevel(input);
    const title = String(input.title ?? "Alert");
    const message = String(input.message ?? "");
    const channels = this.extractChannels(input);
    const options = this.extractOptions(input);
    const metadata = input.metadata as Record<string, unknown> | undefined;

    // Criar alerta
    const alert: Alert = {
      id: this.generateAlertId(),
      level,
      title,
      message,
      channel: channels,
      metadata,
      timestamp: new Date(),
      acknowledged: false
    };

    // Verificar throttling
    if (this.isThrottled(alert, options)) {
      return {
        sent: false,
        alert,
        reason: "throttled",
        message: "Alerta suprimido devido a throttling"
      };
    }

    // Entregar alerta em cada canal
    const deliveryResults = await this.deliverAlert(alert, channels, options);

    // Armazenar no histórico
    this.alertHistory.set(alert.id, alert);

    // Atualizar estatísticas
    this.updateStats(alert, deliveryResults);

    return {
      sent: true,
      alert,
      deliveryResults,
      stats: this.stats
    };
  }

  private async evaluateRules(input: ToolInput): Promise<unknown> {
    const data = input.data as Record<string, unknown> | undefined;

    if (!data) {
      throw new Error("Invalid input: data object is required for evaluate operation");
    }

    const triggeredAlerts: Alert[] = [];

    // Avaliar cada regra
    this.alertRules.forEach((rule) => {
      if (!rule.enabled) {
        return;
      }

      try {
        if (rule.condition(data)) {
          const alert: Alert = {
            id: this.generateAlertId(),
            level: rule.level,
            title: rule.name,
            message: rule.message,
            channel: rule.channels,
            metadata: { rule: rule.name, data },
            timestamp: new Date(),
            acknowledged: false
          };

          triggeredAlerts.push(alert);
          this.alertHistory.set(alert.id, alert);

          // Entregar alerta
          this.deliverAlert(alert, rule.channels, {});
          this.updateStats(alert, { success: rule.channels, failed: [] });
        }
      } catch (error) {
        console.error(`[FeedbackAndAlerting] Error evaluating rule ${rule.name}:`, error);
      }
    });

    return {
      evaluated: true,
      rulesChecked: this.alertRules.size,
      triggeredAlerts: triggeredAlerts.length,
      alerts: triggeredAlerts
    };
  }

  private acknowledgeAlert(input: ToolInput): unknown {
    const alertId = input.alertId as string | undefined;

    if (!alertId) {
      throw new Error("Invalid input: alertId is required for acknowledge operation");
    }

    const alert = this.alertHistory.get(alertId);

    if (!alert) {
      return {
        acknowledged: false,
        reason: "not_found",
        message: `Alerta com ID ${alertId} não encontrado`
      };
    }

    if (alert.acknowledged) {
      return {
        acknowledged: false,
        reason: "already_acknowledged",
        message: `Alerta ${alertId} já foi reconhecido anteriormente`
      };
    }

    alert.acknowledged = true;
    this.stats.acknowledgedCount++;

    return {
      acknowledged: true,
      alert
    };
  }

  private getStats(): AlertStats {
    return { ...this.stats };
  }

  private extractLevel(input: ToolInput): AlertLevel {
    const level = input.level as string | undefined;

    if (level === "info" || level === "warning" || level === "error" || level === "critical") {
      return level;
    }

    return "info";
  }

  private extractChannels(input: ToolInput): AlertChannel[] {
    const channels = input.channels as string[] | string | undefined;

    if (Array.isArray(channels)) {
      return channels.filter((c) => this.isValidChannel(c)) as AlertChannel[];
    }

    if (typeof channels === "string" && this.isValidChannel(channels)) {
      return [channels as AlertChannel];
    }

    return ["console"];
  }

  private isValidChannel(channel: string): boolean {
    return ["console", "email", "slack", "webhook", "sms"].includes(channel);
  }

  private extractOptions(input: ToolInput): DeliveryOptions {
    const opts = (input.options as DeliveryOptions | undefined) || {};

    return {
      channels: opts.channels,
      throttleMs: opts.throttleMs ?? 60000, // 1 minuto padrão
      retryAttempts: opts.retryAttempts ?? 3,
      batchSize: opts.batchSize ?? 10
    };
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private isThrottled(alert: Alert, options: DeliveryOptions): boolean {
    const throttleKey = `${alert.level}_${alert.title}`;
    const lastSent = this.deliveryThrottle.get(throttleKey);
    const now = Date.now();

    if (lastSent && now - lastSent < (options.throttleMs || 60000)) {
      return true;
    }

    this.deliveryThrottle.set(throttleKey, now);
    return false;
  }

  private async deliverAlert(
    alert: Alert,
    channels: AlertChannel[],
    options: DeliveryOptions
  ): Promise<{ success: AlertChannel[]; failed: AlertChannel[] }> {
    const success: AlertChannel[] = [];
    const failed: AlertChannel[] = [];

    for (const channel of channels) {
      try {
        await this.deliverToChannel(alert, channel, options);
        success.push(channel);
      } catch (error) {
        failed.push(channel);
        console.error(`[FeedbackAndAlerting] Failed to deliver to ${channel}:`, error);
      }
    }

    return { success, failed };
  }

  private async deliverToChannel(alert: Alert, channel: AlertChannel, options: DeliveryOptions): Promise<void> {
    switch (channel) {
      case "console":
        this.deliverToConsole(alert);
        break;
      case "email":
        await this.deliverToEmail(alert, options);
        break;
      case "slack":
        await this.deliverToSlack(alert, options);
        break;
      case "webhook":
        await this.deliverToWebhook(alert, options);
        break;
      case "sms":
        await this.deliverToSMS(alert, options);
        break;
    }
  }

  private deliverToConsole(alert: Alert): void {
    const prefix = this.getLevelPrefix(alert.level);
    console.log(`${prefix} [${alert.level.toUpperCase()}] ${alert.title}`);
    console.log(`  Message: ${alert.message}`);
    console.log(`  Time: ${alert.timestamp.toISOString()}`);
    if (alert.metadata) {
      console.log(`  Metadata:`, alert.metadata);
    }
  }

  private async deliverToEmail(alert: Alert, options: DeliveryOptions): Promise<void> {
    // Simulação de envio de email
    // Em produção, integraria com serviço real (SendGrid, AWS SES, etc.)
    await this.simulateDelivery("email", alert, options);
  }

  private async deliverToSlack(alert: Alert, options: DeliveryOptions): Promise<void> {
    // Simulação de envio para Slack
    // Em produção, usaria Slack API ou webhook
    await this.simulateDelivery("slack", alert, options);
  }

  private async deliverToWebhook(alert: Alert, options: DeliveryOptions): Promise<void> {
    // Simulação de webhook
    // Em produção, faria HTTP POST para endpoint configurado
    await this.simulateDelivery("webhook", alert, options);
  }

  private async deliverToSMS(alert: Alert, options: DeliveryOptions): Promise<void> {
    // Simulação de SMS
    // Em produção, integraria com Twilio, AWS SNS, etc.
    await this.simulateDelivery("sms", alert, options);
  }

  private async simulateDelivery(channel: string, alert: Alert, options: DeliveryOptions): Promise<void> {
    // Simulação de latência de rede
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 10);
    });
  }

  private getLevelPrefix(level: AlertLevel): string {
    switch (level) {
      case "info":
        return "ℹ️";
      case "warning":
        return "⚠️";
      case "error":
        return "❌";
      case "critical":
        return "🚨";
    }
  }

  private updateStats(alert: Alert, deliveryResults: { success: AlertChannel[]; failed: AlertChannel[] }): void {
    this.stats.totalAlerts++;
    this.stats.byLevel[alert.level]++;

    deliveryResults.success.forEach((channel) => {
      this.stats.byChannel[channel]++;
    });

    this.stats.failedDeliveries += deliveryResults.failed.length;
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE3:FeedbackAndAlerting] Testando FeedbackAndAlerting...\n");

  async function runTests() {
    const feedback = new FeedbackAndAlerting();

    // Teste 1: Enviar alerta simples
    console.log("=== Teste 1: Enviar Alerta Simples ===");
    const result1 = await feedback.execute({
      operation: "send",
      level: "info",
      title: "Sistema Inicializado",
      message: "O sistema foi inicializado com sucesso",
      channels: ["console"]
    });

    if (result1.success) {
      const out = result1.output as any;
      console.log("Alerta enviado:", out.sent);
      console.log("ID:", out.alert.id);
      console.log("");
    }

    // Teste 2: Alerta de warning multi-canal
    console.log("=== Teste 2: Alerta Warning Multi-Canal ===");
    const result2 = await feedback.execute({
      operation: "send",
      level: "warning",
      title: "CPU Alto",
      message: "Uso de CPU acima de 80% detectado",
      channels: ["console", "slack"],
      metadata: { cpu: 85, threshold: 80 }
    });

    if (result2.success) {
      const out = result2.output as any;
      console.log("Alerta enviado:", out.sent);
      console.log("Canais de sucesso:", out.deliveryResults.success);
      console.log("");
    }

    // Teste 3: Alerta crítico
    console.log("=== Teste 3: Alerta Crítico ===");
    const result3 = await feedback.execute({
      operation: "send",
      level: "critical",
      title: "Falha de Banco de Dados",
      message: "Conexão com banco de dados perdida",
      channels: ["console", "email", "sms"]
    });

    if (result3.success) {
      const out = result3.output as any;
      console.log("Alerta crítico enviado");
      console.log("Estatísticas atualizadas:");
      console.log("  Total de alertas:", out.stats.totalAlerts);
      console.log("  Por nível:", out.stats.byLevel);
      console.log("");
    }

    // Teste 4: Avaliar regras
    console.log("=== Teste 4: Avaliar Regras de Alerta ===");
    const result4 = await feedback.execute({
      operation: "evaluate",
      data: {
        errorRate: 0.15,
        latency: 6000,
        status: "running"
      }
    });

    if (result4.success) {
      const out = result4.output as any;
      console.log("Regras verificadas:", out.rulesChecked);
      console.log("Alertas disparados:", out.triggeredAlerts);
      if (out.triggeredAlerts > 0) {
        console.log("Alertas:");
        out.alerts.forEach((alert: { title: string; level: string }) => {
          console.log(`  - [${alert.level}] ${alert.title}`);
        });
      }
      console.log("");
    }

    // Teste 5: Reconhecer alerta
    console.log("=== Teste 5: Reconhecer Alerta ===");
    const history = feedback.getAlertHistory();
    if (history.length > 0) {
      const alertId = history[0].id;
      const result5 = await feedback.execute({
        operation: "acknowledge",
        alertId
      });

      if (result5.success) {
        const out = result5.output as any;
        console.log("Alerta reconhecido:", out.acknowledged);
        console.log("ID reconhecido:", out.alert?.id);
        console.log("");
      }
    }

    // Teste 6: Estatísticas
    console.log("=== Teste 6: Estatísticas Gerais ===");
    const result6 = await feedback.execute({
      operation: "stats"
    });

    if (result6.success) {
      const stats = result6.output as any;
      console.log("Total de alertas:", stats.totalAlerts);
      console.log("Alertas reconhecidos:", stats.acknowledgedCount);
      console.log("Por nível:");
      Object.entries(stats.byLevel).forEach(([level, count]) => {
        console.log(`  - ${level}: ${count}`);
      });
      console.log("Por canal:");
      Object.entries(stats.byChannel).forEach(([channel, count]) => {
        if ((count as number) > 0) {
          console.log(`  - ${channel}: ${count}`);
        }
      });
      console.log("Falhas de entrega:", stats.failedDeliveries);
    }

    // Teste 7: Health check
    console.log("\n=== Teste 7: Health Check ===");
    const health = await feedback.healthCheck();
    console.log("Status:", health.status);
    console.log("Latência média:", health.avg_latency_ms, "ms");
    console.log("Taxa de sucesso:", (health.success_rate * 100).toFixed(0), "%");

    console.log("\n[AE3:FeedbackAndAlerting] ✓ Testes concluídos");
  }

  runTests().catch(console.error);
}
