import type { Pattern, HeuristicSuggestion } from "./loop-types";

const ACTION_MAP: Record<string, string[]> = {
  latency_spike: ["defer", "batch", "switch_provider"],
  anomalous_latency_spike: ["circuit_breaker", "investigate_latency"],
  slow_execution: ["investigate_latency", "optimize_tool"],
  fast_execution: ["preserve_current_strategy"],
  failure_outcome: ["add_failure_guardrails", "backoff"],
  success_outcome: ["increase_confidence"],
  validation_related: ["strengthen_input_validation"],
  insufficient_signal: ["collect_more_data"],
  semantic_drift: ["tighten_prompt", "pin_context", "reduce_k"],
};

export interface ScoredSuggestion extends HeuristicSuggestion {
  confidence_breakdown: {
    pattern: number;
    history: number;
    sample: number;
  };
}

export function suggestHeuristics(patterns: Pattern[]): HeuristicSuggestion[] {
  return patterns.flatMap((pattern) => {
    const actions = inferActions(pattern.id);
    const patternStrength = pattern.confidence;
    const histAccuracy = 0.8; // Baseline for new suggestions
    const sampleSize = (pattern.metadata?.sample_size as number) || 10;

    const finalConfidence = scoreConfidence({
      patternStrength,
      histAccuracy,
      sampleSize
    });

    return actions.map(action => ({
      pattern_id: pattern.id,
      suggested_action: action,
      confidence: finalConfidence,
      requires_review: finalConfidence < 0.6,
    }));
  });
}

function scoreConfidence(metrics: { patternStrength: number; histAccuracy: number; sampleSize: number }): number {
  const w1 = 0.5;  // Pattern Strength
  const w2 = 0.35; // Historical Accuracy
  const w3 = 0.15; // Sample Size Weight

  const score = w1 * metrics.patternStrength +
    w2 * metrics.histAccuracy +
    w3 * Math.min(1, metrics.sampleSize / 50);

  return Number(score.toFixed(2));
}

function inferActions(patternId: string): string[] {
  const actions: string[] = [];
  for (const key of Object.keys(ACTION_MAP)) {
    if (patternId.includes(key)) {
      actions.push(...ACTION_MAP[key]);
    }
  }
  return actions.length > 0 ? actions : ["review_pattern"];
}
