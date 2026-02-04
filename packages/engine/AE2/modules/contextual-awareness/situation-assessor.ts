type SituationAssessment = {
  complexity: "low" | "medium" | "high";
  risk: "low" | "medium" | "high";
};

export function assessSituation(signals: string[]): SituationAssessment {
  const complexity = signals.length > 4 ? "high" : signals.length > 2 ? "medium" : "low";
  const risk = signals.includes("anomaly") ? "high" : signals.length ? "medium" : "low";

  return { complexity, risk };
}
