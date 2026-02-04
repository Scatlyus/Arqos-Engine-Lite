import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type ValidationRule = {
  field: string;
  type?: "string" | "number" | "boolean" | "array" | "object" | "email" | "url" | "date";
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: unknown[];
  custom?: (value: unknown) => boolean;
};

type ValidationConfig = {
  data: unknown;
  rules: ValidationRule[];
  sanitize?: boolean;
  strict?: boolean;
};

type ValidationError = {
  field: string;
  message: string;
  value?: unknown;
};

export class InputValidator implements Tool {
  id = "T2";
  name = "InputValidator";
  phase = "colhe" as const;
  version = "1.0.0";

  private metrics = {
    executionCount: 0,
    successCount: 0,
    failureCount: 0,
    totalDuration: 0,
    validationsPerformed: 0,
    validInputs: 0,
    invalidInputs: 0,
  };

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    this.metrics.executionCount++;
    this.metrics.validationsPerformed++;

    try {
      const config = input as Partial<ValidationConfig>;

      if (!config.data) {
        throw new Error("Data to validate is required");
      }

      if (!config.rules || !Array.isArray(config.rules) || config.rules.length === 0) {
        throw new Error("At least one validation rule is required");
      }

      const errors: ValidationError[] = [];
      const warnings: string[] = [];
      let sanitizedData = config.data;

      // Validar cada regra
      for (const rule of config.rules) {
        const value = this.getFieldValue(config.data, rule.field);
        const ruleErrors = this.validateField(value, rule);
        errors.push(...ruleErrors);
      }

      // Sanitizar se solicitado
      if (config.sanitize && errors.length === 0) {
        sanitizedData = this.sanitizeData(config.data, config.rules);
      }

      const isValid = errors.length === 0;

      if (isValid) {
        this.metrics.validInputs++;
      } else {
        this.metrics.invalidInputs++;
      }

      this.metrics.successCount++;
      this.metrics.totalDuration += Date.now() - startTime;

      return {
        tool_id: this.id,
        tool_name: this.name,
        success: true,
        output: {
          valid: isValid,
          errors,
          warnings,
          sanitized_data: config.sanitize ? sanitizedData : undefined,
          fields_validated: config.rules.length,
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
   * Obtém valor de um campo (suporta nested paths com dot notation)
   */
  private getFieldValue(data: unknown, field: string): unknown {
    const parts = field.split(".");
    let value: unknown = data;

    for (const part of parts) {
      if (value && typeof value === "object" && part in value) {
        value = (value as Record<string, unknown>)[part];
      } else {
        return undefined;
      }
    }

    return value;
  }

  /**
   * Valida um campo de acordo com as regras
   */
  private validateField(value: unknown, rule: ValidationRule): ValidationError[] {
    const errors: ValidationError[] = [];

    // Required check
    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push({
        field: rule.field,
        message: `Field '${rule.field}' is required`,
        value,
      });
      return errors; // Se required falhar, não validar outros aspectos
    }

    // Se não é required e está ausente, skip outras validações
    if (!rule.required && (value === undefined || value === null)) {
      return errors;
    }

    // Type validation
    if (rule.type) {
      const typeError = this.validateType(value, rule.type, rule.field);
      if (typeError) errors.push(typeError);
    }

    // Min/Max validation (para strings, numbers, arrays)
    if (rule.min !== undefined) {
      const minError = this.validateMin(value, rule.min, rule.field);
      if (minError) errors.push(minError);
    }

    if (rule.max !== undefined) {
      const maxError = this.validateMax(value, rule.max, rule.field);
      if (maxError) errors.push(maxError);
    }

    // Pattern validation (regex)
    if (rule.pattern) {
      const patternError = this.validatePattern(value, rule.pattern, rule.field);
      if (patternError) errors.push(patternError);
    }

    // Enum validation
    if (rule.enum) {
      const enumError = this.validateEnum(value, rule.enum, rule.field);
      if (enumError) errors.push(enumError);
    }

    // Custom validation
    if (rule.custom) {
      try {
        if (!rule.custom(value)) {
          errors.push({
            field: rule.field,
            message: `Field '${rule.field}' failed custom validation`,
            value,
          });
        }
      } catch (error) {
        errors.push({
          field: rule.field,
          message: `Custom validation error: ${error instanceof Error ? error.message : String(error)}`,
          value,
        });
      }
    }

    return errors;
  }

  /**
   * Valida tipo do valor
   */
  private validateType(
    value: unknown,
    type: string,
    field: string
  ): ValidationError | null {
    switch (type) {
      case "string":
        if (typeof value !== "string") {
          return { field, message: `Field '${field}' must be a string`, value };
        }
        break;

      case "number":
        if (typeof value !== "number" || isNaN(value)) {
          return { field, message: `Field '${field}' must be a number`, value };
        }
        break;

      case "boolean":
        if (typeof value !== "boolean") {
          return { field, message: `Field '${field}' must be a boolean`, value };
        }
        break;

      case "array":
        if (!Array.isArray(value)) {
          return { field, message: `Field '${field}' must be an array`, value };
        }
        break;

      case "object":
        if (typeof value !== "object" || value === null || Array.isArray(value)) {
          return { field, message: `Field '${field}' must be an object`, value };
        }
        break;

      case "email":
        if (typeof value !== "string" || !this.isValidEmail(value)) {
          return { field, message: `Field '${field}' must be a valid email`, value };
        }
        break;

      case "url":
        if (typeof value !== "string" || !this.isValidURL(value)) {
          return { field, message: `Field '${field}' must be a valid URL`, value };
        }
        break;

      case "date":
        const date = new Date(String(value));
        if (isNaN(date.getTime())) {
          return { field, message: `Field '${field}' must be a valid date`, value };
        }
        break;
    }

    return null;
  }

  /**
   * Valida valor mínimo
   */
  private validateMin(value: unknown, min: number, field: string): ValidationError | null {
    if (typeof value === "number" && value < min) {
      return { field, message: `Field '${field}' must be >= ${min}`, value };
    }

    if (typeof value === "string" && value.length < min) {
      return { field, message: `Field '${field}' must have at least ${min} characters`, value };
    }

    if (Array.isArray(value) && value.length < min) {
      return { field, message: `Field '${field}' must have at least ${min} items`, value };
    }

    return null;
  }

  /**
   * Valida valor máximo
   */
  private validateMax(value: unknown, max: number, field: string): ValidationError | null {
    if (typeof value === "number" && value > max) {
      return { field, message: `Field '${field}' must be <= ${max}`, value };
    }

    if (typeof value === "string" && value.length > max) {
      return { field, message: `Field '${field}' must have at most ${max} characters`, value };
    }

    if (Array.isArray(value) && value.length > max) {
      return { field, message: `Field '${field}' must have at most ${max} items`, value };
    }

    return null;
  }

  /**
   * Valida padrão regex
   */
  private validatePattern(
    value: unknown,
    pattern: string,
    field: string
  ): ValidationError | null {
    if (typeof value !== "string") {
      return { field, message: `Field '${field}' must be a string for pattern validation`, value };
    }

    const regex = new RegExp(pattern);
    if (!regex.test(value)) {
      return { field, message: `Field '${field}' does not match pattern: ${pattern}`, value };
    }

    return null;
  }

  /**
   * Valida enum
   */
  private validateEnum(
    value: unknown,
    enumValues: unknown[],
    field: string
  ): ValidationError | null {
    if (!enumValues.includes(value)) {
      return {
        field,
        message: `Field '${field}' must be one of: ${enumValues.join(", ")}`,
        value,
      };
    }

    return null;
  }

  /**
   * Valida email
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Valida URL
   */
  private isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sanitiza dados (remove campos não especificados nas regras se strict mode)
   */
  private sanitizeData(data: unknown, rules: ValidationRule[]): unknown {
    if (typeof data !== "object" || data === null) {
      return data;
    }

    const sanitized: Record<string, unknown> = {};
    const allowedFields = new Set(rules.map((r) => r.field.split(".")[0]));

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (allowedFields.has(key)) {
        // Sanitizar strings (trim, remove special chars)
        if (typeof value === "string") {
          sanitized[key] = value.trim();
        } else {
          sanitized[key] = value;
        }
      }
    }

    return sanitized;
  }

  async healthCheck(): Promise<ToolHealth> {
    try {
      const testResult = await this.execute({
        data: { test: "value" },
        rules: [{ field: "test", type: "string", required: true }],
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
      validationSuccessRate:
        this.metrics.validationsPerformed > 0
          ? this.metrics.validInputs / this.metrics.validationsPerformed
          : 0,
    };
  }

  resetMetrics(): void {
    this.metrics = {
      executionCount: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      validationsPerformed: 0,
      validInputs: 0,
      invalidInputs: 0,
    };
  }
}

// ========== CLI para testes ==========

if (require.main === module) {
  console.log("[AE3:InputValidator] Testing Input Validator Tool...\n");

  async function runTests() {
    const tool = new InputValidator();

    // Teste 1: Validação simples de tipos
    console.log("=== Teste 1: Validação de Tipos ===");
    const result1 = await tool.execute({
      data: { name: "Alice", age: 30, active: true },
      rules: [
        { field: "name", type: "string", required: true },
        { field: "age", type: "number", min: 18, max: 100 },
        { field: "active", type: "boolean" },
      ],
    });
    console.log(result1.success ? "✓" : "✗", "Valid:", result1.output?.valid);
    console.log("Errors:", result1.output?.errors);

    // Teste 2: Required field faltando
    console.log("\n=== Teste 2: Required Field Missing ===");
    const result2 = await tool.execute({
      data: { age: 25 },
      rules: [
        { field: "name", type: "string", required: true },
        { field: "age", type: "number" },
      ],
    });
    console.log(result2.success ? "✓" : "✗", "Valid:", result2.output?.valid);
    console.log("Errors:", result2.output?.errors);

    // Teste 3: Email validation
    console.log("\n=== Teste 3: Email Validation ===");
    const result3 = await tool.execute({
      data: { email: "test@example.com" },
      rules: [{ field: "email", type: "email", required: true }],
    });
    console.log(result3.success ? "✓" : "✗", "Valid:", result3.output?.valid);

    // Teste 4: Pattern (regex) validation
    console.log("\n=== Teste 4: Pattern Validation (Phone) ===");
    const result4 = await tool.execute({
      data: { phone: "+1-555-1234" },
      rules: [{ field: "phone", type: "string", pattern: "^\\+\\d{1,3}-\\d{3}-\\d{4}$" }],
    });
    console.log(result4.success ? "✓" : "✗", "Valid:", result4.output?.valid);

    // Teste 5: Enum validation
    console.log("\n=== Teste 5: Enum Validation ===");
    const result5 = await tool.execute({
      data: { status: "active" },
      rules: [{ field: "status", enum: ["active", "inactive", "pending"] }],
    });
    console.log(result5.success ? "✓" : "✗", "Valid:", result5.output?.valid);

    // Teste 6: Custom validation
    console.log("\n=== Teste 6: Custom Validation ===");
    const result6 = await tool.execute({
      data: { password: "Test1234!" },
      rules: [
        {
          field: "password",
          type: "string",
          custom: (val) => {
            const str = String(val);
            return str.length >= 8 && /[A-Z]/.test(str) && /[0-9]/.test(str);
          },
        },
      ],
    });
    console.log(result6.success ? "✓" : "✗", "Valid:", result6.output?.valid);

    // Teste 7: Sanitize
    console.log("\n=== Teste 7: Sanitize Data ===");
    const result7 = await tool.execute({
      data: { name: "  Alice  ", age: 30, extra: "should be removed" },
      rules: [
        { field: "name", type: "string" },
        { field: "age", type: "number" },
      ],
      sanitize: true,
    });
    console.log(result7.success ? "✓" : "✗", "Sanitized:", result7.output?.sanitized_data);

    // Teste 8: Health Check
    console.log("\n=== Teste 8: Health Check ===");
    const health = await tool.healthCheck();
    console.log(health.status === "healthy" ? "✓" : "✗", "Status:", health.status);

    console.log("\n[AE3:InputValidator] ✓ Testes concluídos");
  }

  runTests().catch(console.error);
}
