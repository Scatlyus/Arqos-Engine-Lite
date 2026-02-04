type Scenario = {
  name: string;
  impact: number;
};

export function simulateScenarios(objectives: string[]): Scenario[] {
  if (!objectives.length) {
    return [{ name: "baseline", impact: 0 }];
  }

  return objectives.map((objective, index) => ({
    name: `scenario_${index + 1}_${objective.replace(/\s+/g, "_")}`,
    impact: Number((0.2 + index * 0.1).toFixed(2))
  }));
}
