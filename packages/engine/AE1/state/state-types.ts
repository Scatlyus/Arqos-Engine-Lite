export interface ExecutionLog {
  id: string;
  timestamp: string;
  type: string;
  outcome?: string;
  duration_ms?: number;
}

export interface CognitiveContext {
  recent_patterns: unknown[];
  heuristic_suggestions: unknown[];
  memory_insights: unknown;
  risk_indicators?: unknown[];
}
