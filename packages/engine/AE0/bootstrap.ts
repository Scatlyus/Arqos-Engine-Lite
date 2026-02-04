// AE0 bootstrap orchestrator (core)
import { validateContracts } from "./validators/contract-validator";
import { validateSchemas } from "./validators/schema-validator";
import { validateMode } from "./validators/mode-validator";
import { resolveDependencies } from "./validators/dependency-resolver";
import { resolveUnlockOrder } from "./unlock/unlock-sequencer";
import { initializeEventStream } from "./event-stream/event-bus";
import { startHealthMonitoring } from "../health/health-monitor";
import * as path from "path";
import { EnginePaths } from "../src/core/paths";
import { ArqosError } from "@arqos/utils";

export type AE0Context = {
  mode: "lite" | "fullstack";
  state: Record<string, unknown>;
};

export async function bootstrap(mode: "lite" | "fullstack"): Promise<AE0Context> {
  console.log(`[AE0] Starting bootstrap in ${mode} mode...`);

  validateMode(mode);

  const engineRoot = EnginePaths.getRoot();
  const schemasPath = EnginePaths.getSchemasPath();
  const contractsPath = EnginePaths.getContractsPath();

  try {
    await validateSchemas(schemasPath, engineRoot);
  } catch (err: any) {
    throw new ArqosError(
      `[AE0] fail-fast: validation failed: ${err.message}`,
      'ARQOS_FAIL_FAST',
      err
    );
  }

  await validateContracts(contractsPath);
  await resolveDependencies(engineRoot);

  await initializeEventStream(mode);
  await resolveUnlockOrder(["AE2", "AE1", "AE3"]);
  startHealthMonitoring();

  console.log("[AE0] Bootstrap complete ✓");

  return {
    mode,
    state: {}
  };
}
