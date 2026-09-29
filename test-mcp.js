import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import fs from "fs";

async function main() {
    const env = fs.readFileSync(".env.local", "utf8");
    const key = env.split("\n").find(l => l.startsWith("VAMUSS_GPT_KEY=")).split("=")[1].replace(/['"]/g, "").trim();

    const transport = new SSEClientTransport(
        new URL("http://localhost:3001/api/mcp/sse"),
        { headers: { Authorization: `Bearer ${key}` } }
    );
    
    const client = new Client({ name: "test", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    
    console.log("✅ Handshake works");
    
    const tools = await client.listTools();
    console.log("✅ Tools discovered:", tools.tools.map(t => t.name).join(", "));
    
    // Execution of all 5 tools + temporal tests
    console.log("\n--- Testing Temporal get_metrics (August 2026) ---");
    let metricsAug = await client.callTool({ name: "get_metrics", arguments: { startDate: "2026-08-01", endDate: "2026-08-31" } });
    console.log(metricsAug.content[0].text.substring(0, 150) + "...");

    console.log("\n--- Testing Temporal get_metrics (September 2026) ---");
    let metricsSep = await client.callTool({ name: "get_metrics", arguments: { startDate: "2026-09-01", endDate: "2026-09-30" } });
    console.log(metricsSep.content[0].text.substring(0, 150) + "...");

    console.log("\n--- Testing search_deals ---");
    let deals = await client.callTool({ name: "search_deals", arguments: { status: "won" } });
    console.log("✅ Result length:", deals.content[0].text.length);

    console.log("\n--- Testing get_market_signals ---");
    let signals = await client.callTool({ name: "get_market_signals", arguments: {} });
    console.log("✅ Result length:", signals.content[0].text.length);

    console.log("\n--- Testing get_deal_dossier ---");
    let dossier = await client.callTool({ name: "get_deal_dossier", arguments: { id: "a2b0fb2d-0453-4876-9d3f-5616b7ff01d2" } });
    console.log("✅ Result length:", dossier.content[0].text.length);

    console.log("\n--- Testing get_content_memory ---");
    let memory = await client.callTool({ name: "get_content_memory", arguments: { limit: 2 } });
    console.log("✅ Result length:", memory.content[0].text.length);

    console.log("\n✅ All tests passed successfully.");
    process.exit(0);
}

main().catch(console.error);
