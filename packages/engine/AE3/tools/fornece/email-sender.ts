import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

/**
 * Prioridade do email
 */
type EmailPriority = "high" | "normal" | "low";

/**
 * Formato do corpo do email
 */
type EmailFormat = "text" | "html" | "markdown";

/**
 * Status de entrega
 */
type DeliveryStatus = "queued" | "sent" | "delivered" | "failed" | "bounced";

/**
 * Anexo de email
 */
type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string;
  size?: number;
  encoding?: "base64" | "utf8";
};

/**
 * Configuração do email
 */
type EmailConfig = {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  from?: string;
  replyTo?: string;
  subject: string;
  body: string;
  format?: EmailFormat;
  priority?: EmailPriority;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  templateId?: string;
  templateVariables?: Record<string, string>;
  trackOpens?: boolean;
  trackClicks?: boolean;
  scheduledAt?: string | Date;
  tags?: string[];
};

/**
 * Resultado do envio
 */
type EmailResult = {
  messageId: string;
  status: DeliveryStatus;
  recipients: {
    to: string[];
    cc: string[];
    bcc: string[];
    total: number;
  };
  subject: string;
  bodyPreview: string;
  format: EmailFormat;
  priority: EmailPriority;
  attachmentCount: number;
  totalSize: number;
  sentAt: Date;
  scheduledAt?: Date;
  tracking: {
    opensEnabled: boolean;
    clicksEnabled: boolean;
    trackingId?: string;
  };
  tags: string[];
  warnings: string[];
};

/**
 * Templates de email predefinidos
 */
/**
 * Templates de email predefinidos (ATLAS Design System via @arqos/templates)
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { EmailTemplates } = require("../../../../templates/dist");

const EMAIL_TEMPLATES: Record<string, { subject: string; body: string; format: EmailFormat }> = EmailTemplates;


/**
 * Regex para validação de email
 */
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Gera um ID único para mensagem
 */
function generateMessageId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `msg_${timestamp}_${random}@arqos.local`;
}

/**
 * Gera um ID de tracking
 */
function generateTrackingId(): string {
  return `trk_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

export class EmailSender implements Tool {
  id = "T31";
  name = "EmailSender";
  phase = "fornece" as const;
  version = "1.0.0";

  private metrics = {
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    totalDuration: 0,
    totalEmailsSent: 0,
    totalRecipients: 0,
    totalAttachments: 0,
    totalSize: 0,
    byPriority: { high: 0, normal: 0, low: 0 },
    byFormat: { text: 0, html: 0, markdown: 0 },
    byTemplate: new Map<string, number>(),
  };

  // Simulated rate limiting
  private rateLimitWindow = 60000; // 1 minute
  private rateLimitMax = 100;
  private recentSends: number[] = [];

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.metrics.executionCount++;

    try {
      // Check rate limit
      this.checkRateLimit();

      const config = this.parseConfig(input);
      const result = await this.sendEmail(config);

      this.metrics.successCount++;
      this.metrics.totalDuration += Date.now() - startTime;
      this.metrics.totalEmailsSent++;
      this.metrics.totalRecipients += result.recipients.total;
      this.metrics.totalAttachments += result.attachmentCount;
      this.metrics.totalSize += result.totalSize;
      this.metrics.byPriority[result.priority]++;
      this.metrics.byFormat[result.format]++;

      if (config.templateId) {
        const count = this.metrics.byTemplate.get(config.templateId) || 0;
        this.metrics.byTemplate.set(config.templateId, count + 1);
      }

      // Record for rate limiting
      this.recentSends.push(Date.now());

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: result,
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
   * Verifica rate limit
   */
  private checkRateLimit(): void {
    const now = Date.now();
    this.recentSends = this.recentSends.filter((t) => now - t < this.rateLimitWindow);

    if (this.recentSends.length >= this.rateLimitMax) {
      throw new Error(`Rate limit exceeded: max ${this.rateLimitMax} emails per minute`);
    }
  }

  /**
   * Parseia e valida a configuração
   */
  private parseConfig(input: ToolInput): EmailConfig {
    const warnings: string[] = [];

    // Validar destinatários
    const to = this.normalizeRecipients(input.to);
    if (to.length === 0) {
      throw new Error("At least one recipient (to) is required");
    }

    // Validar emails
    for (const email of to) {
      if (!this.validateEmail(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }
    }

    const cc = this.normalizeRecipients(input.cc);
    const bcc = this.normalizeRecipients(input.bcc);

    for (const email of [...cc, ...bcc]) {
      if (!this.validateEmail(email)) {
        throw new Error(`Invalid email address: ${email}`);
      }
    }

    // Validar subject
    let subject = String(input.subject || "").trim();
    if (!subject && !input.templateId) {
      throw new Error("Subject is required");
    }

    // Validar body
    let body = String(input.body || "").trim();
    if (!body && !input.templateId) {
      throw new Error("Body is required");
    }

    // Aplicar template se especificado
    const templateId = input.templateId as string | undefined;
    if (templateId) {
      const template = EMAIL_TEMPLATES[templateId];
      if (!template) {
        throw new Error(`Template not found: ${templateId}. Available: ${Object.keys(EMAIL_TEMPLATES).join(", ")}`);
      }

      const variables = (input.templateVariables || input.variables || {}) as Record<string, string>;
      // Add default variables
      variables.year = variables.year || new Date().getFullYear().toString();

      subject = this.applyTemplate(template.subject, variables);
      body = this.applyTemplate(template.body, variables);

      return {
        to,
        cc,
        bcc,
        from: input.from as string | undefined,
        replyTo: input.replyTo as string | undefined,
        subject,
        body,
        format: template.format,
        priority: (input.priority as EmailPriority) || "normal",
        attachments: input.attachments as EmailAttachment[] | undefined,
        headers: input.headers as Record<string, string> | undefined,
        templateId,
        templateVariables: variables,
        trackOpens: input.trackOpens !== false,
        trackClicks: input.trackClicks !== false,
        scheduledAt: input.scheduledAt as string | Date | undefined,
        tags: (input.tags as string[]) || [],
      };
    }

    return {
      to,
      cc,
      bcc,
      from: input.from as string | undefined,
      replyTo: input.replyTo as string | undefined,
      subject,
      body,
      format: (input.format as EmailFormat) || "text",
      priority: (input.priority as EmailPriority) || "normal",
      attachments: input.attachments as EmailAttachment[] | undefined,
      headers: input.headers as Record<string, string> | undefined,
      trackOpens: input.trackOpens !== false,
      trackClicks: input.trackClicks !== false,
      scheduledAt: input.scheduledAt as string | Date | undefined,
      tags: (input.tags as string[]) || [],
    };
  }

  /**
   * Normaliza lista de destinatários
   */
  private normalizeRecipients(input: unknown): string[] {
    if (!input) return [];
    if (typeof input === "string") {
      return input
        .split(/[,;]/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0);
    }
    if (Array.isArray(input)) {
      return input.map((e) => String(e).trim()).filter((e) => e.length > 0);
    }
    return [];
  }

  /**
   * Valida formato de email
   */
  private validateEmail(email: string): boolean {
    return EMAIL_REGEX.test(email);
  }

  /**
   * Aplica variáveis ao template
   */
  private applyTemplate(template: string, variables: Record<string, string>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
      result = result.replace(pattern, value);
    }

    // Remove conditional blocks for undefined variables
    result = result.replace(/\{\{#if \w+\}\}[\s\S]*?\{\{\/if\}\}/g, "");

    return result;
  }

  /**
   * Envia o email (simulado)
   */
  private async sendEmail(config: EmailConfig): Promise<EmailResult> {
    const warnings: string[] = [];
    const messageId = generateMessageId();

    // Calcular tamanho total
    let totalSize = config.subject.length + config.body.length;

    // Processar anexos
    const attachments = config.attachments || [];
    let attachmentCount = 0;

    for (const attachment of attachments) {
      if (!attachment.filename) {
        warnings.push("Attachment without filename was skipped");
        continue;
      }
      attachmentCount++;
      totalSize += attachment.size || attachment.content?.length || 0;
    }

    // Verificar tamanho máximo (25MB simulado)
    const maxSize = 25 * 1024 * 1024;
    if (totalSize > maxSize) {
      throw new Error(`Email size (${this.formatSize(totalSize)}) exceeds maximum allowed (${this.formatSize(maxSize)})`);
    }

    // Simular delay de envio baseado em prioridade
    const delays: Record<EmailPriority, number> = { high: 10, normal: 50, low: 100 };
    await this.delay(delays[config.priority || "normal"]);

    // Preparar resultado
    const toList = Array.isArray(config.to) ? config.to : [config.to];
    const ccList = Array.isArray(config.cc) ? config.cc : config.cc ? [config.cc] : [];
    const bccList = Array.isArray(config.bcc) ? config.bcc : config.bcc ? [config.bcc] : [];

    // Gerar preview do body
    const bodyPreview = this.generatePreview(config.body, config.format || "text");

    // Tracking
    const tracking = {
      opensEnabled: config.trackOpens !== false,
      clicksEnabled: config.trackClicks !== false,
      trackingId: config.trackOpens || config.trackClicks ? generateTrackingId() : undefined,
    };

    // Scheduled
    let scheduledAt: Date | undefined;
    if (config.scheduledAt) {
      scheduledAt = typeof config.scheduledAt === "string" ? new Date(config.scheduledAt) : config.scheduledAt;
      if (scheduledAt <= new Date()) {
        warnings.push("Scheduled time is in the past, sending immediately");
        scheduledAt = undefined;
      }
    }

    const result: EmailResult = {
      messageId,
      status: scheduledAt ? "queued" : "sent",
      recipients: {
        to: toList,
        cc: ccList,
        bcc: bccList,
        total: toList.length + ccList.length + bccList.length,
      },
      subject: config.subject,
      bodyPreview,
      format: config.format || "text",
      priority: config.priority || "normal",
      attachmentCount,
      totalSize,
      sentAt: new Date(),
      scheduledAt,
      tracking,
      tags: config.tags || [],
      warnings,
    };

    return result;
  }

  /**
   * Gera preview do corpo do email
   */
  private generatePreview(body: string, format: EmailFormat): string {
    let text = body;

    if (format === "html") {
      // Remove HTML tags
      text = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    }

    // Limitar a 150 caracteres
    if (text.length > 150) {
      text = text.substring(0, 147) + "...";
    }

    return text;
  }

  /**
   * Formata tamanho em bytes para legível
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ========== Health Check & Metrics ==========

  async healthCheck(): Promise<ToolHealth> {
    try {
      // Teste básico de envio
      const testResult = await this.execute({
        to: "test@example.com",
        subject: "Health Check",
        body: "This is a health check email",
      });

      const avgLatency =
        this.metrics.successCount > 0 ? this.metrics.totalDuration / this.metrics.successCount : 0;

      const successRate =
        this.metrics.executionCount > 0 ? this.metrics.successCount / this.metrics.executionCount : 1;

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
    const templateStats: Record<string, number> = {};
    for (const [template, count] of this.metrics.byTemplate) {
      templateStats[template] = count;
    }

    return {
      executionCount: this.metrics.executionCount,
      successCount: this.metrics.successCount,
      failureCount: this.metrics.failureCount,
      totalEmailsSent: this.metrics.totalEmailsSent,
      totalRecipients: this.metrics.totalRecipients,
      totalAttachments: this.metrics.totalAttachments,
      totalSize: this.metrics.totalSize,
      totalSizeFormatted: this.formatSize(this.metrics.totalSize),
      averageDuration:
        this.metrics.successCount > 0 ? this.metrics.totalDuration / this.metrics.successCount : 0,
      successRate:
        this.metrics.executionCount > 0 ? this.metrics.successCount / this.metrics.executionCount : 0,
      byPriority: { ...this.metrics.byPriority },
      byFormat: { ...this.metrics.byFormat },
      byTemplate: templateStats,
      rateLimitStatus: {
        current: this.recentSends.length,
        max: this.rateLimitMax,
        windowMs: this.rateLimitWindow,
      },
    };
  }

  resetMetrics(): void {
    this.metrics = {
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      totalEmailsSent: 0,
      totalRecipients: 0,
      totalAttachments: 0,
      totalSize: 0,
      byPriority: { high: 0, normal: 0, low: 0 },
      byFormat: { text: 0, html: 0, markdown: 0 },
      byTemplate: new Map(),
    };
    this.recentSends = [];
  }

  /**
   * Lista templates disponíveis
   */
  getAvailableTemplates(): string[] {
    return Object.keys(EMAIL_TEMPLATES);
  }

  /**
   * Retorna detalhes de um template
   */
  getTemplateInfo(templateId: string): { subject: string; format: EmailFormat; variables: string[] } | null {
    const template = EMAIL_TEMPLATES[templateId];
    if (!template) return null;

    // Extract variables from template
    const variables: string[] = [];
    const pattern = /\{\{(\w+)\}\}/g;
    let match;

    while ((match = pattern.exec(template.subject + template.body)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return {
      subject: template.subject,
      format: template.format,
      variables,
    };
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE3:EmailSender] Testing Email Sender Tool...\n");

  async function runTests() {
    const tool = new EmailSender();
    let passed = 0;
    let failed = 0;

    // Teste 1: Email simples
    console.log("=== Teste 1: Email Simples ===");
    try {
      const result1 = await tool.execute({
        to: "user@example.com",
        subject: "Test Email",
        body: "This is a test email message.",
      });

      if (result1.success && result1.output) {
        const out = result1.output as EmailResult;
        console.log("✓ Email enviado");
        console.log(`  Message ID: ${out.messageId}`);
        console.log(`  Status: ${out.status}`);
        console.log(`  Recipients: ${out.recipients.total}`);
        passed++;
      } else {
        console.log("✗ Falha:", result1.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 2: Múltiplos destinatários
    console.log("\n=== Teste 2: Múltiplos Destinatários ===");
    try {
      const result2 = await tool.execute({
        to: ["user1@example.com", "user2@example.com"],
        cc: "manager@example.com",
        bcc: "admin@example.com",
        subject: "Team Update",
        body: "Important update for the team.",
        priority: "high",
      });

      if (result2.success && result2.output) {
        const out = result2.output as EmailResult;
        console.log("✓ Email enviado");
        console.log(`  To: ${out.recipients.to.join(", ")}`);
        console.log(`  CC: ${out.recipients.cc.join(", ")}`);
        console.log(`  BCC: ${out.recipients.bcc.join(", ")}`);
        console.log(`  Priority: ${out.priority}`);
        passed++;
      } else {
        console.log("✗ Falha:", result2.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 3: Template de boas-vindas
    console.log("\n=== Teste 3: Template de Boas-vindas ===");
    try {
      const result3 = await tool.execute({
        to: "newuser@example.com",
        templateId: "welcome",
        templateVariables: {
          userName: "João Silva",
          appName: "Arqos Engine",
          loginUrl: "https://app.arqos.io/login",
        },
      });

      if (result3.success && result3.output) {
        const out = result3.output as EmailResult;
        console.log("✓ Template aplicado");
        console.log(`  Subject: ${out.subject}`);
        console.log(`  Format: ${out.format}`);
        console.log(`  Preview: ${out.bodyPreview.substring(0, 80)}...`);
        passed++;
      } else {
        console.log("✗ Falha:", result3.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 4: Email com anexos
    console.log("\n=== Teste 4: Email com Anexos ===");
    try {
      const result4 = await tool.execute({
        to: "client@example.com",
        subject: "Documents Attached",
        body: "Please find the attached documents.",
        attachments: [
          { filename: "report.pdf", content: "base64content...", contentType: "application/pdf", size: 1024 },
          { filename: "data.csv", content: "col1,col2\nval1,val2", contentType: "text/csv", size: 256 },
        ],
      });

      if (result4.success && result4.output) {
        const out = result4.output as EmailResult;
        console.log("✓ Email com anexos");
        console.log(`  Attachments: ${out.attachmentCount}`);
        console.log(`  Total Size: ${tool.getMetrics().totalSizeFormatted}`);
        passed++;
      } else {
        console.log("✗ Falha:", result4.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 5: Email HTML com tracking
    console.log("\n=== Teste 5: Email HTML com Tracking ===");
    try {
      const result5 = await tool.execute({
        to: "subscriber@example.com",
        subject: "Newsletter",
        body: "<h1>Newsletter</h1><p>Check out our latest <a href='https://example.com'>updates</a>!</p>",
        format: "html",
        trackOpens: true,
        trackClicks: true,
        tags: ["newsletter", "monthly"],
      });

      if (result5.success && result5.output) {
        const out = result5.output as EmailResult;
        console.log("✓ Email HTML enviado");
        console.log(`  Format: ${out.format}`);
        console.log(`  Tracking ID: ${out.tracking.trackingId}`);
        console.log(`  Tags: ${out.tags.join(", ")}`);
        passed++;
      } else {
        console.log("✗ Falha:", result5.error);
        failed++;
      }
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 6: Validação de erros - email inválido
    console.log("\n=== Teste 6: Validação - Email Inválido ===");
    try {
      const result6 = await tool.execute({
        to: "invalid-email",
        subject: "Test",
        body: "Test",
      });

      if (!result6.success) {
        console.log("✓ Erro capturado:", result6.error);
        passed++;
      } else {
        console.log("✗ Deveria ter falhado");
        failed++;
      }
    } catch (e) {
      console.log("✓ Exceção capturada");
      passed++;
    }

    // Teste 7: Validação de erros - sem subject
    console.log("\n=== Teste 7: Validação - Sem Subject ===");
    try {
      const result7 = await tool.execute({
        to: "user@example.com",
        body: "Test body",
      });

      if (!result7.success) {
        console.log("✓ Erro capturado:", result7.error);
        passed++;
      } else {
        console.log("✗ Deveria ter falhado");
        failed++;
      }
    } catch (e) {
      console.log("✓ Exceção capturada");
      passed++;
    }

    // Teste 8: Template inexistente
    console.log("\n=== Teste 8: Template Inexistente ===");
    try {
      const result8 = await tool.execute({
        to: "user@example.com",
        templateId: "nonexistent",
      });

      if (!result8.success) {
        console.log("✓ Erro capturado:", result8.error);
        passed++;
      } else {
        console.log("✗ Deveria ter falhado");
        failed++;
      }
    } catch (e) {
      console.log("✓ Exceção capturada");
      passed++;
    }

    // Teste 9: Health Check
    console.log("\n=== Teste 9: Health Check ===");
    try {
      const health = await tool.healthCheck();
      console.log(health.status === "healthy" ? "✓" : "✗", "Status:", health.status);
      console.log(`  Success Rate: ${(health.success_rate * 100).toFixed(1)}%`);
      console.log(`  Avg Latency: ${health.avg_latency_ms.toFixed(2)}ms`);
      if (health.status === "healthy") passed++;
      else failed++;
    } catch (e) {
      console.log("✗ Erro:", e);
      failed++;
    }

    // Teste 10: Métricas e Templates
    console.log("\n=== Teste 10: Métricas e Templates ===");
    const metrics = tool.getMetrics();
    const templates = tool.getAvailableTemplates();
    const welcomeInfo = tool.getTemplateInfo("welcome");

    console.log(`  Emails enviados: ${metrics.totalEmailsSent}`);
    console.log(`  Recipients: ${metrics.totalRecipients}`);
    console.log(`  Por prioridade: high=${metrics.byPriority.high}, normal=${metrics.byPriority.normal}`);
    console.log(`  Por formato: text=${metrics.byFormat.text}, html=${metrics.byFormat.html}`);
    console.log(`  Templates: ${templates.join(", ")}`);
    console.log(`  Welcome vars: ${welcomeInfo?.variables.join(", ")}`);
    passed++;

    // Resumo
    console.log("\n" + "=".repeat(50));
    console.log(`[AE3:EmailSender] Testes: ${passed} passed, ${failed} failed`);
    console.log("=".repeat(50));

    if (failed === 0) {
      console.log("✓ Todos os testes passaram!");
    }
  }

  runTests().catch(console.error);
}
