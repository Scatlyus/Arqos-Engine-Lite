export interface Observation {
  event_id: string;
  timestamp: string;
  type: string;
  outcome?: string;
  duration_ms: number;
  metadata?: Record<string, any>;
}

export interface Reflection {
  observation_id: string;
  insights: string[];
  questions: string[];
  hypotheses: string[];
  metrics?: {
    zScore: number;
    drift: number;
    isAnomalous: boolean;
  };
}

export interface Pattern {
  id: string;
  type: "correlation" | "trend" | "cluster" | "anomaly";
  description: string;
  confidence: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface HeuristicSuggestion {
  pattern_id: string;
  suggested_action: string;
  confidence: number;
  requires_review: boolean;
}
