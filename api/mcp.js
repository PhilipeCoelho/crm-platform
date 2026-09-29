import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import jwt from "jsonwebtoken";

const MCP_RESOURCE = "https://crm-platform-ten-rose.vercel.app/api/mcp/sse";
const MCP_METADATA = "https://crm-platform-ten-rose.vercel.app/.well-known/oauth-protected-resource";
const transports = new Map();

function getBearerToken(req) {
    const authHeader = req.headers.authorization || "";
    return authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
}

function verifyAccessToken(req, res) {
    const token = getBearerToken(req);
    const JWT_SECRET = process.env.OAUTH_JWT_SECRET || process.env.VAMUSS_GPT_KEY || "fallback_secret";

    if (!token) {
        res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${MCP_METADATA}", scope="crm:read"`);
        res.status(401).json({ error: "Unauthorized: Bearer token required" });
        return null;
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET, {
            audience: MCP_RESOURCE
        });
        if (!decoded || typeof decoded !== "object" || decoded.scope !== "crm:read") {
            res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${MCP_METADATA}", scope="crm:read"`);
            res.status(403).json({ error: "Forbidden: Insufficient scope" });
            return null;
        }
        return { token, decoded };
    } catch (err) {
        res.setHeader("WWW-Authenticate", `Bearer resource_metadata="${MCP_METADATA}", scope="crm:read"`);
        res.status(401).json({ error: "Unauthorized: Invalid token" });
        return null;
    }
}

function createMcpServer(req) {
    const authHeader = req.headers.authorization || "";
    const server = new Server(
        { name: "Vamuss CRM MCP Server", version: "1.1.0" },
        { capabilities: { tools: {} } }
    );

    const securitySchemes = [{ type: "oauth2", scopes: ["crm:read"] }];
    const readOnlyAnnotations = {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
    };

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: [
            {
                name: "get_metrics",
                description: "Use this when you need the executive sales funnel, revenue, conversion, pipeline, source, loss reasons, or period comparisons from the Vamuss CRM.",
                inputSchema: {
                    type: "object",
                    properties: {
                        startDate: { type: "string", description: "Inclusive period start in YYYY-MM-DD format." },
                        endDate: { type: "string", description: "Inclusive period end in YYYY-MM-DD format." }
                    },
                    additionalProperties: false
                },
                securitySchemes,
                annotations: readOnlyAnnotations
            },
            {
                name: "search_deals",
                description: "Use this when you need individual Vamuss CRM deals or a filtered small set of deals for investigation. Do not request thousands of records.",
                inputSchema: {
                    type: "object",
                    properties: {
                        startDate: { type: "string" },
                        endDate: { type: "string" },
                        status: { type: "string" }
                    },
                    additionalProperties: false
                },
                securitySchemes,
                annotations: readOnlyAnnotations
            },
            {
                name: "get_market_signals",
                description: "Use this when you need commercial market signals extracted from Vamuss prospects, including pains, objections, beliefs, tensions, patterns, quotes, and insights.",
                inputSchema: {
                    type: "object",
                    properties: {
                        startDate: { type: "string" },
                        endDate: { type: "string" }
                    },
                    additionalProperties: false
                },
                securitySchemes,
                annotations: readOnlyAnnotations
            },
            {
                name: "get_deal_dossier",
                description: "Use this when you need a deep read-only dossier for one specific Vamuss CRM deal.",
                inputSchema: {
                    type: "object",
                    properties: { id: { type: "string" } },
                    required: ["id"],
                    additionalProperties: false
                },
                securitySchemes,
                annotations: readOnlyAnnotations
            },
            {
                name: "get_content_memory",
                description: "Use this when you need Vamuss editorial memory: published content, themes, angles, performance, explored topics, and commercial opportunities not yet turned into content.",
                inputSchema: {
                    type: "object",
                    properties: {
                        topic: { type: "string" },
                        limit: { type: "number" }
                    },
                    additionalProperties: false
                },
                securitySchemes,
                annotations: readOnlyAnnotations
            }
        ]
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args = {} } = request.params;
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const host = req.headers.host || "crm-platform-ten-rose.vercel.app";
        const baseUrl = `${protocol}://${host}`;
        const headers = {
            Authorization: authHeader,
            "Content-Type": "application/json"
        };

        try {
            let result;
            if (name === "get_metrics") {
                const params = new URLSearchParams(args).toString();
                const response = await fetch(`${baseUrl}/api/gpt/metrics${params ? `?${params}` : ""}`, { headers });
                result = await response.json();
            } else if (name === "search_deals") {
                const params = new URLSearchParams(args).toString();
                const response = await fetch(`${baseUrl}/api/gpt/deals${params ? `?${params}` : ""}`, { headers });
                result = await response.json();
            } else if (name === "get_market_signals") {
                const params = new URLSearchParams(args).toString();
                const response = await fetch(`${baseUrl}/api/gpt/market-signals${params ? `?${params}` : ""}`, { headers });
                result = await response.json();
            } else if (name === "get_deal_dossier") {
                const response = await fetch(`${baseUrl}/api/gpt/deal-dossier/${encodeURIComponent(args.id)}`, { headers });
                result = await response.json();
            } else if (name === "get_content_memory") {
                const params = new URLSearchParams(args).toString();
                const response = await fetch(`${baseUrl}/api/gpt/content-memory${params ? `?${params}` : ""}`, { headers });
                result = await response.json();
            } else {
                throw new Error(`Tool not found: ${name}`);
            }

            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        } catch (err) {
            return {
                content: [{ type: "text", text: `Error executing tool: ${err.message}` }],
                isError: true
            };
        }
    });

    return server;
}

export function setupMcp(app) {
    // Modern MCP: Streamable HTTP. Stateless mode is intentional for Vercel/serverless.
    // ChatGPT may POST initialize/listTools/callTool to this same endpoint.
    const handleStreamable = async (req, res) => {
        if (!verifyAccessToken(req, res)) return;

        try {
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined,
                enableJsonResponse: true
            });
            const server = createMcpServer(req);

            res.on("close", () => {
                transport.close().catch(() => {});
            });

            await server.connect(transport);
            await transport.handleRequest(req, res, req.body);
        } catch (err) {
            console.error("MCP Streamable HTTP error:", err);
            if (!res.headersSent) {
                res.status(500).json({ error: "MCP internal server error" });
            }
        }
    };

    app.post("/api/mcp/sse", handleStreamable);
    app.post("/api/mcp", handleStreamable);

    // Legacy HTTP+SSE is retained for existing local/legacy clients.
    const handleLegacySse = async (req, res) => {
        if (!verifyAccessToken(req, res)) return;

        const transport = new SSEServerTransport("/api/mcp/messages", res);
        const server = createMcpServer(req);
        await server.connect(transport);
        transports.set(transport.sessionId, { transport, server });

        req.on("close", () => {
            transports.delete(transport.sessionId);
        });
    };

    app.get("/api/mcp/sse", handleLegacySse);
    app.get("/api/mcp", handleLegacySse);

    app.post("/api/mcp/messages", async (req, res) => {
        const sessionId = req.query.sessionId;
        const session = transports.get(sessionId);
        if (!session) return res.status(404).send("Session not found");
        await session.transport.handlePostMessage(req, res, req.body);
    });

    app.delete("/api/mcp/sse", (_req, res) => res.status(405).json({ error: "Method Not Allowed" }));
    app.delete("/api/mcp", (_req, res) => res.status(405).json({ error: "Method Not Allowed" }));
}
