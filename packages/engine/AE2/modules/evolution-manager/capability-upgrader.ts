type UpgradePlan = {
  upgrades: string[];
};

export function upgradeCapabilities(gaps: string[]): UpgradePlan {
  if (!gaps.length) {
    return { upgrades: ["no_action"] };
  }

  return { upgrades: gaps.map((gap) => `upgrade_${gap}`) };
}
