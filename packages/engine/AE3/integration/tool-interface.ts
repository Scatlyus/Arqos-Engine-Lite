export interface Tool {
  id: string;
  name: string;
  phase: "recebe" | "colhe" | "processa" | "fornece";
  version: string;

  execute(input: ToolInput): Promise<ToolOutput>;
  healthCheck(): Promise<ToolHealth>;
}

export interface ToolInput {
  [key: string]: unknown;
}

export interface ToolOutput {
  tool_id: string;
  tool_name: string;
  success: boolean;
  output?: unknown;
  error?: string;
  duration_ms: number;
  timestamp: Date;
}

export interface ToolHealth {
  tool_name: string;
  status: "healthy" | "degraded" | "down";
  last_check: Date;
  avg_latency_ms: number;
  success_rate: number;
}
