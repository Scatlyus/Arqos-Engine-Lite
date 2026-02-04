import { Arqos } from "@arqos/engine/AE0/Arqos";
import { createServer } from "@arqos/maestro-gateway";
import dotenv from "dotenv";

dotenv.config();

/**
 * Maestro Hub - Unified Entry Point
 * Orchestrates Engine + Gateway + UI
 */
async function bootstrap() {
    console.log("-----------------------------------------");
    console.log("   AQROS MAESTRO EDITION - LOADING...    ");
    console.log("-----------------------------------------");

    const mode = (process.env.ARQOS_MODE as any) || "lite";
    const port = parseInt(process.env.PORT_API || "5050", 10);

    try {
        // 1. Initialize Engine
        console.log(`[Hub] Initializing Arqos Engine in ${mode} mode...`);
        const engine = await Arqos.init({ mode });

        // 2. Initialize Gateway
        console.log(`[Hub] Starting Maestro Gateway on port ${port}...`);
        const app = await createServer({ engine });

        app.listen(port, () => {
            console.log("-----------------------------------------");
            console.log(`✅ MAESTRO HUB READY on :${port}`);
            console.log(`Mode: ${mode.toUpperCase()}`);
            console.log("-----------------------------------------");
        });

    } catch (error) {
        console.error("❌ CRITICAL: Hub bootstrap failed!");
        console.error(error);
        process.exit(1);
    }
}

// Handle unhandled rejections
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
});

bootstrap();
