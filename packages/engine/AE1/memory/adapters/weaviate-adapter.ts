import type { VectorRecord, VectorStoreAdapter } from "../vectorial";

interface WeaviateAdapterOptions {
    host: string;
    apiKey?: string;
    className?: string;
    timeoutMs?: number;
}

export class WeaviateAdapter implements VectorStoreAdapter {
    private readonly host: string;
    private readonly apiKey?: string;
    private readonly className: string;
    private readonly timeoutMs: number;

    constructor(options: WeaviateAdapterOptions) {
        this.host = options.host.replace(/\/+$/, "");
        this.apiKey = options.apiKey;
        this.className = options.className ?? "MemoryEvent";
        this.timeoutMs = options.timeoutMs ?? 5000;
    }

    async upsert(record: VectorRecord): Promise<void> {
        const body = {
            class: this.className,
            id: this.uuidFromId(record.id),
            vector: record.embedding,
            properties: {
                original_id: record.id,
                metadata: JSON.stringify(record.metadata),
                event: JSON.stringify(record.event),
                stored_at: record.stored_at,
            },
        };

        await this.request("POST", `/v1/objects`, body);
    }

    async query(embedding: number[], limit: number): Promise<VectorRecord[]> {
        const gqlQuery = `
      {
        Get {
          ${this.className} (
            limit: ${Math.max(1, limit)}
            nearVector: {
              vector: [${embedding.join(",")}]
            }
          ) {
            original_id
            metadata
            event
            stored_at
            _additional {
              id
              distance
              vector
            }
          }
        }
      }
    `;

        const response = await this.request<any>("POST", "/v1/graphql", { query: gqlQuery });
        const results = response?.data?.Get?.[this.className] ?? [];

        return results.map((item: any) => {
            const metadata = JSON.parse(item.metadata ?? "{}");
            const event = JSON.parse(item.event ?? "{}");

            return {
                id: item.original_id || item._additional.id,
                embedding: item._additional.vector ?? embedding,
                metadata,
                event,
                stored_at: item.stored_at
            };
        });
    }

    async healthCheck(): Promise<{ status: "healthy" | "degraded" | "unavailable"; message?: string }> {
        try {
            await this.request("GET", "/v1/.well-known/ready");
            return { status: "healthy" };
        } catch (error) {
            return { status: "unavailable", message: error instanceof Error ? error.message : "unknown" };
        }
    }

    private async request<T>(method: string, path: string, body?: Record<string, unknown>): Promise<T> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const headers: Record<string, string> = {
                "Content-Type": "application/json",
            };

            if (this.apiKey) {
                headers["Authorization"] = `Bearer ${this.apiKey}`;
            }

            const response = await fetch(`${this.host}${path}`, {
                method,
                headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Weaviate ${method} ${path} failed: ${response.status} ${text}`);
            }

            if (response.status === 204) return {} as T;
            return (await response.json()) as T;
        } finally {
            clearTimeout(timeout);
        }
    }

    /**
     * Helper to ensure ID is a valid UUID per Weaviate requirements
     */
    private uuidFromId(id: string): string {
        // Simple regex to check if it's already a UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(id)) return id;

        // Otherwise generate a deterministic UUID-v4-like string from hash
        let hash = 0;
        for (let i = 0; i < id.length; i++) {
            hash = (hash << 5) - hash + id.charCodeAt(i);
            hash |= 0;
        }

        const h = Math.abs(hash).toString(16).padEnd(8, '0');
        return `${h}-0000-4000-8000-000000000000`;
    }
}
