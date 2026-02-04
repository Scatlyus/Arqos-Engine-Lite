// Semver regex
const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

export type ChangeImpact = "major" | "minor" | "patch";

export function bumpHeuristicVersion(current: string, impact: ChangeImpact = "patch"): string {
  const match = current.match(SEMVER_REGEX);
  if (!match) {
    throw new Error(`Invalid version format: ${current}. Expected X.Y.Z`);
  }

  let [_, major, minor, patch] = match.map(Number);

  switch (impact) {
    case "major":
      major++;
      minor = 0;
      patch = 0;
      break;
    case "minor":
      minor++;
      patch = 0;
      break;
    case "patch":
      patch++;
      break;
  }

  return `${major}.${minor}.${patch}`;
}

