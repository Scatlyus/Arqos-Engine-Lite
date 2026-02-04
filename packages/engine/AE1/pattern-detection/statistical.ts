import type { Observation, Pattern } from "../cognition-loop/loop-types";
// import { v4 as uuidv4 } from "uuid"; // using internal fallback

// ============================================================
// MAIN FUNCTION
// ============================================================

export function detectStatisticalPatterns(observations: Observation[]): Pattern[] {
  // Constraint: Need minimum data points for statistical significance
  if (observations.length < 10) {
    return [];
  }

  const patterns: Pattern[] = [];

  // 1. Regression Analysis (Duration Trend)
  const trendPattern = analyzeDurationTrend(observations);
  if (trendPattern) {
    patterns.push(trendPattern);
  }

  // 2. Correlation Analysis (Type vs Failure Rate)
  const correlationPatterns = analyzeTypeOutcomeCorrelation(observations);
  patterns.push(...correlationPatterns);

  // 3. Clustering (Duration Distribution)
  const clusterPatterns = analyzeDurationClustering(observations);
  patterns.push(...clusterPatterns);

  return patterns;
}

// ============================================================
// ALGORITHMS
// ============================================================

/**
 * Algo 1: Linear Regression on Duration over time
 * Detects if system is getting slower or faster
 */
function analyzeDurationTrend(observations: Observation[]): Pattern | null {
  // Filter valid durations
  const validData = observations
    .filter(obs => obs.duration_ms > 0)
    .map((obs, index) => ({ x: index, y: obs.duration_ms }));

  if (validData.length < 10) return null;

  // Calculate Simple Linear Regression (Least Squares)
  const n = validData.length;
  const sumX = validData.reduce((acc, p) => acc + p.x, 0);
  const sumY = validData.reduce((acc, p) => acc + p.y, 0);
  const sumXY = validData.reduce((acc, p) => acc + (p.x * p.y), 0);
  const sumXX = validData.reduce((acc, p) => acc + (p.x * p.x), 0);

  const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

  // Threshold: significant slope indicating trend
  const SIGNIFICANCE_THRESHOLD = 5.0; // +/- 5ms change per execution average

  if (Math.abs(slope) > SIGNIFICANCE_THRESHOLD) {
    const trend = slope > 0 ? "degrading" : "improving";
    // Confidence based on how steep the slope is relative to variance (simplified here)
    const confidence = Math.min(Math.abs(slope) / 20, 0.95);

    return {
      id: uuidv4(),
      type: "trend",
      description: `Performance is ${trend} (slope: ${slope.toFixed(2)}ms/exec)`,
      confidence: parseFloat(confidence.toFixed(2)),
      timestamp: new Date().toISOString(),
      metadata: { slope, sample_size: n }
    };
  }

  return null;
}

/**
 * Algo 2: Correlation Analysis
 * Detects if specific event types are correlated with failures
 */
function analyzeTypeOutcomeCorrelation(observations: Observation[]): Pattern[] {
  const patterns: Pattern[] = [];
  const typeStats = new Map<string, { total: number; failures: number }>();

  // Aggregate stats
  for (const obs of observations) {
    if (!typeStats.has(obs.type)) {
      typeStats.set(obs.type, { total: 0, failures: 0 });
    }
    const stats = typeStats.get(obs.type)!;
    stats.total++;

    const outcome = (obs.outcome || "").toLowerCase();
    if (outcome.includes("error") || outcome.includes("fail") || outcome.includes("timeout")) {
      stats.failures++;
    }
  }

  // Analyze high failure rates
  for (const [type, stats] of typeStats) {
    if (stats.total < 5) continue; // Minimum sample size per type

    const failureRate = stats.failures / stats.total;

    // Threshold: > 30% failure rate is a pattern
    if (failureRate > 0.3) {
      patterns.push({
        id: uuidv4(),
        type: "correlation",
        description: `High failure rate (${(failureRate * 100).toFixed(1)}%) detected for event type '${type}'`,
        confidence: parseFloat(Math.min(0.5 + (failureRate / 2), 0.99).toFixed(2)),
        timestamp: new Date().toISOString(),
        metadata: { type, failureRate, total: stats.total }
      });
    }
  }

  return patterns;
}

/**
 * Algo 3: K-Means Clustering (simplified 1D) on Duration
 * Detects if executions fall into distinct performance buckets
 */
function analyzeDurationClustering(observations: Observation[]): Pattern[] {
  const durations = observations
    .map(o => o.duration_ms)
    .filter(d => d > 0)
    .sort((a, b) => a - b);

  if (durations.length < 10) return [];

  // Check for multimodal distribution (simple heuristic: variance analysis)
  // or simply detecting outliers.

  // Let's implement simple Outlier Detection (IQR method)
  const q1 = durations[Math.floor(durations.length / 4)];
  const q3 = durations[Math.floor(durations.length * (3 / 4))];
  const iqr = q3 - q1;
  const upperFence = q3 + (1.5 * iqr);

  const outliers = durations.filter(d => d > upperFence);

  if (outliers.length > 0 && outliers.length < durations.length * 0.2) {
    // If we have outliers but they are less than 20% of data
    return [{
      id: uuidv4(),
      type: "anomaly",
      description: `Detected ${outliers.length} performance anomalies (> ${upperFence}ms)`,
      confidence: 0.85,
      timestamp: new Date().toISOString(),
      metadata: {
        outlier_count: outliers.length,
        threshold: upperFence,
        max_outlier: Math.max(...outliers)
      }
    }];
  }

  return [];
}

// Fallback for UUID if package is missing (though it usually is present or we can use crypto)
function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
