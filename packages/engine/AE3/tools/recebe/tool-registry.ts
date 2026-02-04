import type { Tool } from "../../integration/tool-interface";

export interface RegisteredTool {
  name: string;
  phase: "recebe" | "colhe" | "processa" | "fornece";
  status: "healthy" | "degraded" | "down";
  metrics: { avg_latency_ms: number; success_rate: number };
  factory?: () => Tool;
}

export class ToolRegistry {
  private tools: RegisteredTool[] = [];
  private toolMap = new Map<string, RegisteredTool>();

  constructor(private mode: "lite" | "fullstack") {}

  async registerTool(
    name: string,
    phase: RegisteredTool["phase"],
    factory?: () => Tool
  ): Promise<void> {
    const tool: RegisteredTool = {
      name,
      phase,
      status: "healthy",
      metrics: { avg_latency_ms: 0, success_rate: 1 },
      factory
    };
    this.tools.push(tool);
    this.toolMap.set(name, tool);
    console.log(`[AE3:ToolRegistry] Registering tool: ${name} (${phase})`);
  }

  async registerPlugin(_tool: Tool): Promise<void> {
    // Placeholder for plugin registration.
  }

  hasTool(name: string): boolean {
    return this.tools.some((tool) => tool.name === name);
  }

  createTool(name: string): Tool {
    const tool = this.toolMap.get(name);
    if (!tool || !tool.factory) {
      throw new Error(`[AE3:ToolRegistry] Tool factory not found: ${name}`);
    }
    return tool.factory();
  }

  getAllTools(): RegisteredTool[] {
    return [...this.tools];
  }

  count(): number {
    return this.tools.length;
  }
}
