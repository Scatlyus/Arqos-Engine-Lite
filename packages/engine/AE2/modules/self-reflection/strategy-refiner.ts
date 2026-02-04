type StrategyRefinement = {
  adjustments: string[];
};

export function refineStrategy(findings: string[]): StrategyRefinement {
  const adjustments = findings.includes("overcommitment_risk")
    ? ["reduce_parallelism", "tighten_scope"]
    : ["maintain_strategy"];

  return { adjustments };
}
