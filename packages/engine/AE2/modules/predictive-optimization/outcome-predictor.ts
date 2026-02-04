type Scenario = {
  name: string;
  impact: number;
};

export function predictOutcomes(scenarios: Scenario[]): Record<string, number> {
  const predictions: Record<string, number> = {};

  for (const scenario of scenarios) {
    predictions[scenario.name] = Number((scenario.impact * 100).toFixed(1));
  }

  return predictions;
}
