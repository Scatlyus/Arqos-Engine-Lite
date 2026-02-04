export interface MemoryEvent {
  id: string;
  timestamp: string;
  type: string;
  outcome?: string;
  duration_ms?: number;
  metadata?: Record<string, unknown>;
}

export interface MemoryQuery {
  type?: "semantic" | "timeframe";
  text?: string;
  timeframe?: "recent" | "all";
  limit?: number;
}

export interface MemoryInsights {
  total_events: number;
  recent_patterns: string[];
  memory_usage_mb: number;
}
