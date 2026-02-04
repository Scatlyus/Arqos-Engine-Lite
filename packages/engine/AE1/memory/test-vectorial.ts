import { VectorialMemory } from "./vectorial";
import { InMemoryStore } from "../state/in-memory-store";
import { MemoryEvent } from "./memory-types";

async function runTest() {
    console.log("--- Starting AE1 Vectorial Memory Test ---");
    const stateStore = new InMemoryStore();

    // Initialize with local BoW embedder (default in VectorialMemory.embed)
    const memory = new VectorialMemory(stateStore, {
        namespace: "test-unit"
    });

    const events: MemoryEvent[] = [
        { id: "evt_1", timestamp: new Date().toISOString(), type: "login", outcome: "success", metadata: { user: "alice" } },
        { id: "evt_2", timestamp: new Date().toISOString(), type: "error", outcome: "database_timeout", metadata: { severity: "high" } },
        { id: "evt_3", timestamp: new Date().toISOString(), type: "config", outcome: "update", metadata: { feature: "dark_mode" } },
    ];

    console.log("1. Storing events...");
    for (const event of events) {
        const text = `${event.type} ${event.outcome} ${JSON.stringify(event.metadata)}`;
        // We manually simulate what MemoryManager does
        const dimensions = 768;
        const vector = new Array(dimensions).fill(0);
        for (let i = 0; i < text.length; i++) vector[text.charCodeAt(i) % dimensions] += 1;
        const norm = Math.sqrt(vector.reduce((acc, v) => acc + v * v, 0)) || 1;
        const embedding = vector.map(v => v / norm);

        await memory.store(event.id, embedding, event.metadata || {}, event);
    }

    console.log("2. Testing Semantic Search (Local)...");

    // Query for "database failure"
    const searchResults = await memory.search("database failure session timeout", 1);
    console.log("Search Result for 'database failure':", searchResults[0]?.outcome);

    if (searchResults[0]?.id === "evt_2") {
        console.log("✅ Semantic search correctly identified the error event.");
    } else {
        console.error("❌ Semantic search failed to find the best match.");
    }

    console.log("3. Testing Persistence...");
    const memory2 = new VectorialMemory(stateStore, { namespace: "test-unit" });
    const results2 = await memory2.search("alice login", 1);
    if (results2[0]?.id === "evt_1") {
        console.log("✅ Persistence verified: records reloaded from state store.");
    } else {
        console.error("❌ Persistence failed: records not found after reload.");
    }

    console.log("4. Testing Deletion...");
    await memory.delete("evt_1");
    const results3 = await memory.search("alice login", 5);
    if (results3.find(r => r.id === "evt_1")) {
        console.error("❌ Deletion failed: evt_1 still present.");
    } else {
        console.log("✅ Deletion verified.");
    }

    console.log("5. Testing Clear...");
    await memory.clear();
    const results4 = await memory.search("database", 5);
    if (results4.length === 0) {
        console.log("✅ Clear verified.");
    } else {
        console.error("❌ Clear failed: records still present.");
    }

    console.log("--- AE1 Vectorial Memory Test Finished ---");
}

runTest().catch(console.error);
