type DecisionReview = {
  findings: string[];
};

export function reviewDecisions(decisions: string[]): DecisionReview {
  if (!decisions.length) {
    return { findings: ["no_decisions"] };
  }

  const findings = decisions.length > 3 ? ["overcommitment_risk"] : ["decisions_ok"];
  return { findings };
}
