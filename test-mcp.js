import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import jwt from "jsonwebtoken";
import fs from "fs";

const env = fs.existsSync(".env.local") ? fs.readFileSync(".env.local", "utf8") : "";
const envMap = Object.fromEntries(env.split(/\r?\n/).filter(Boolean).map(line => {
    const i = line.indexOf("=");
    return i > 0 ? [line.slice(0, i), line.slice(i + 1).replace(/^['\"]|['\"]$/g, "")] : [];
}));

const baseUrl = process.env.MCP_URL || "http://localhost:3001/api/mcp/sse";
const issuer = process.env.MCP_ISSUER || "https://crm-platform-ten-rose.vercel.app";
const resource = process.env.MCP_RESOURCE || `${issuer}/api/mcp/sse`;
const secret = process.env.OAUTH_JWT_SECRET || envMap.OAUTH_JWT_SECRET;
const token = process.env.ACCESS_TOKEN || (secret ? jwt.sign(
    { scope: "crm:read", sub: "9469fb08-7de5-405e-a4e7-d83cf818ea1e", aud: resource },
    secret,
    { expiresIn: "10m", issuer }
) : null);

if (!token) throw new Error("Set ACCESS_TOKEN or OAUTH_JWT_SECRET for the test.");

async function main() {
    const transport = new StreamableHTTPClientTransport(new URL(baseUrl), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } }
    });
    const client = new Client({ name: "vamuss-mcp-test", version: "1.1.0" });
    await client.connect(transport);

    console.log("OK handshake");
    const tools = await client.listTools();
    console.log("Tools:", tools.tools.map(t => t.name).join(", "));

    const metrics = await client.callTool({ name: "get_metrics", arguments: { startDate: "2026-09-01", endDate: "2026-09-30" } });
    console.log("get_metrics:", metrics.content?.[0]?.text?.slice(0, 300));

    const signals = await client.callTool({ name: "get_market_signals", arguments: {} });
    console.log("get_market_signals:", signals.content?.[0]?.text?.slice(0, 300));

    const memory = await client.callTool({ name: "get_content_memory", arguments: { limit: 2 } });
    console.log("get_content_memory:", memory.content?.[0]?.text?.slice(0, 300));

    await client.close();
    console.log("All MCP Streamable HTTP tests passed.");
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
