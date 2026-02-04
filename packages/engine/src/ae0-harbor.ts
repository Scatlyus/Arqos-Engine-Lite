import { bootstrap, AE0Context } from '../AE0/bootstrap';
import { EnginePaths } from './core/paths';

/**
 * Wrapper for testing bootstrapping with environment injection
 */
export async function bootstrapLite({ env }: { env: any }): Promise<AE0Context> {
    const originalEnv = { ...process.env };

    try {
        const engineRoot = EnginePaths.getRoot();
        process.env.ARQOS_ENGINE_ROOT = engineRoot;
        process.env.ARQOS_SCHEMAS_PATH = EnginePaths.getSchemasPath();
        process.env.ARQOS_CONTRACTS_PATH = EnginePaths.getContractsPath();

        // Inject custom env
        Object.assign(process.env, env);

        const mode = env.ARQOS_MODE || 'lite';
        return await bootstrap(mode);
    } finally {
        process.env = originalEnv;
    }
}
