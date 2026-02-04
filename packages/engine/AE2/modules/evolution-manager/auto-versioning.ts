type VersionInfo = {
  next_version: string;
};

export function autoVersion(currentVersion: string): VersionInfo {
  const parts = currentVersion.split(".").map((value) => Number(value));
  const [major, minor, patch] = [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
  const next = [major, minor, patch + 1].join(".");

  return { next_version: next };
}
