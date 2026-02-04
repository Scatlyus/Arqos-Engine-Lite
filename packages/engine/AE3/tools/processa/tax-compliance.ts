import type { Tool, ToolInput, ToolOutput, ToolHealth } from "../../integration/tool-interface";

type ComplianceResult = {
  compliant: boolean;
  issues: string[];
};

export class TaxComplianceSimulator implements Tool {
  id = "T19";
  name = "TaxComplianceSimulator";
  phase = "processa" as const;
  version = "1.0.0";

  async execute(input: ToolInput): Promise<ToolOutput> {
    const startTime = Date.now();
    const region = String(input.region ?? "BR").toUpperCase();
    const taxable = Number(input.taxable_amount ?? 0);
    const issues: string[] = [];

    if (taxable < 0) {
      issues.push("taxable_amount_negative");
    }

    const compliant = issues.length === 0;

    const result: ComplianceResult = { compliant, issues };

    return {
      tool_id: this.id,
      tool_name: this.name,
      success: true,
      output: { region, ...result },
      duration_ms: Date.now() - startTime,
      timestamp: new Date()
    };
  }

  async healthCheck(): Promise<ToolHealth> {
    return {
      tool_name: this.name,
      status: "healthy",
      last_check: new Date(),
      avg_latency_ms: 15,
      success_rate: 0.98
    };
  }
}
