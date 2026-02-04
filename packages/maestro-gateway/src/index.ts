import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import { Arqos } from "@arqos/engine";

interface GatewayOptions {
    engine: Arqos;
}

/**
 * Maestro Gateway - Express API Server
 */
export async function createServer(options: GatewayOptions) {
    const { engine } = options;
    const app = express();

    app.use(cors());
    app.use(express.json());
    app.use(morgan("combined"));

    // --- Core Routes ---

    /**
     * @route GET /healthz
     * @desc Liveness probe
     */
    app.get("/healthz", (req: Request, res: Response) => {
        res.status(200).json({ status: "alive", timestamp: new Date().toISOString() });
    });

    /**
     * @route GET /api/v1/status
     * @desc Get engine status and mode
     */
    app.get("/api/v1/status", (req: Request, res: Response) => {
        res.json({
            mode: engine.config.mode,
            version: "1.5.0",
            uptime: process.uptime()
        });
    });

    /**
     * @route POST /api/v1/decide
     * @desc Execute a strategic decision flow
     */
    app.post("/api/v1/decide", async (req: Request, res: Response) => {
        const { context, goal } = req.body;
        try {
            const result = await engine.decisionEngine.decide({ context, goal });
            res.json({ success: true, result });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    /**
     * @route GET /api/v1/memory
     * @desc Search semantic memory (AE1)
     */
    app.get("/api/v1/memory", async (req: Request, res: Response) => {
        const { text, limit } = req.query;
        try {
            const results = await engine.memory.retrieve({
                type: "semantic",
                text: text as string,
                limit: parseInt(limit as string) || 5
            });
            res.json({ success: true, results });
        } catch (error: any) {
            res.status(500).json({ success: false, error: error.message });
        }
    });

    return app;
}
