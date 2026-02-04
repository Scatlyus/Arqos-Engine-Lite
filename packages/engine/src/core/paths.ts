import * as path from 'path';

/**
 * Centralized path resolution utility for Arqos Engine.
 * Enforces Axioma_017 (Deterministic Path Resolution).
 */
export class EnginePaths {
    private static root: string | null = null;

    /**
     * Resolves the engine root directory.
     * Priority: ARQOS_ENGINE_ROOT env > package root.
     */
    public static getRoot(): string {
        if (this.root) return this.root;

        if (process.env.ARQOS_ENGINE_ROOT) {
            this.root = path.resolve(process.env.ARQOS_ENGINE_ROOT);
            return this.root;
        }

        // Default fallback: assume we are in packages/engine or a subfolder
        // We walk up until we find a package.json that identifies as @arqos/engine
        // For now, a simpler fallback based on common structure:
        this.root = path.resolve(__dirname, '..', '..');
        return this.root;
    }

    /**
     * Resolves a path relative to the engine root.
     */
    public static resolveFromRoot(...parts: string[]): string {
        return path.join(this.getRoot(), ...parts);
    }

    /**
     * Standardized path for schemas.
     */
    public static getSchemasPath(): string {
        return process.env.ARQOS_SCHEMAS_PATH || this.resolveFromRoot('schemas');
    }

    /**
     * Standardized path for contracts.
     */
    public static getContractsPath(): string {
        return process.env.ARQOS_CONTRACTS_PATH || this.resolveFromRoot('interfaces');
    }
}
