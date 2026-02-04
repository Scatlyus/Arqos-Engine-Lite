import type { Observation, Reflection } from "./loop-types";

// Safety Defaults for Cold Start
const GLOBAL_DEFAULTS = {
  LATENCY_P90: 800,
  LATENCY_P99: 2000,
};

export function reflectOnObservations(observations: Observation[]): Reflection[] {
  return observations.map((observation) => {
    // Dynamic Analysis (Simplified Tomography)
    const p90 = observation.metadata?.baseline_p90 || GLOBAL_DEFAULTS.LATENCY_P90;
    const p99 = observation.metadata?.baseline_p99 || GLOBAL_DEFAULTS.LATENCY_P99;

    // Z-Score calculation (Observation vs Baseline)
    const stdDev = observation.metadata?.baseline_std || 100;
    const mean = observation.metadata?.baseline_mean || 300;
    const zScore = (observation.duration_ms - mean) / Math.max(stdDev, 1);

    const isAnomalous = zScore >= 2 || observation.duration_ms > p99;

    const reflection: Reflection = {
      observation_id: observation.event_id,
      insights: generateInsights(observation, { p90, p99, isAnomalous }),
      questions: generateQuestions(observation),
      hypotheses: generateHypotheses(observation),
      metrics: {
        zScore: Number(zScore.toFixed(2)),
        drift: 0, // Placeholder for future drift calculation
        isAnomalous
      }
    };

    return reflection;
  });
}

function generateInsights(observation: Observation, baselines: { p90: number, p99: number, isAnomalous: boolean }): string[] {
  const insights: string[] = [];
  const { p90, isAnomalous } = baselines;

  if (observation.duration_ms > p90) {
    insights.push("slow_execution");
  } else if (observation.duration_ms > 0 && observation.duration_ms < 300) {
    insights.push("fast_execution");
  }

  if (isAnomalous) {
    insights.push("anomalous_latency_spike");
  }

  if (observation.outcome) {
    const outcome = observation.outcome.toLowerCase();
    if (outcome.includes("error") || outcome.includes("fail")) {
      insights.push("failure_outcome");
    } else if (outcome.includes("success") || outcome.includes("ok")) {
      insights.push("success_outcome");
    }
  }

  return insights.length > 0 ? insights : ["insufficient_signal"];
}

function generateQuestions(observation: Observation): string[] {
  const questions: string[] = [];

  if (!observation.duration_ms) {
    questions.push("missing_duration");
  }

  if (!observation.outcome) {
    questions.push("missing_outcome");
  }

  if (observation.duration_ms > 8000) {
    questions.push("what_caused_latency_spike");
  }

  return questions;
}

function generateHypotheses(observation: Observation): string[] {
  const hypotheses: string[] = [];

  if (observation.outcome?.toLowerCase().includes("error")) {
    hypotheses.push("configuration_or_dependency_issue");
  }

  return hypotheses;
}
