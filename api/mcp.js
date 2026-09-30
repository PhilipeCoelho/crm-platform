import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";

const MCP_RESOURCE = "https://crm-platform-ten-rose.vercel.app/api/mcp/sse";
const MCP_METADATA = "https://crm-platform-ten-rose.vercel.app/.well-known/oauth-protected-resource";
const transports = new Map();
const streamableSessions = new Map();

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
        const scopes = typeof decoded === "object" && typeof decoded.scope === "string"
            ? decoded.scope.split(/\s+/)
            : [];
        if (!decoded || typeof decoded !== "object" || !scopes.includes("crm:read")) {
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

function isInitializeRequest(body) {
    return body && body.method === "initialize";
}

function createMcpServer(req) {
    const authHeader = req.headers.authorization || "";
    const server = new Server(
        { name: "Vamuss CRM MCP Server", version: "1.3.0" },
        { capabilities: { tools: {} } }
    );

    const securitySchemes = [{ type: "oauth2", scopes: ["crm:read"] }];
    const readOnlyAnnotations = {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false
    };
    const meta = { securitySchemes };

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
                annotations: readOnlyAnnotations,
                _meta: meta
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
                annotations: readOnlyAnnotations,
                _meta: meta
            },
            {
                name: "get_market_signals",
                description: "Obtém insights comerciais e de mercado, objeções, dores, falas reais de prospects (quotes), notas qualitativas e padrões de ganhos/perdas.",
                inputSchema: {
                    type: "object",
                    properties: {
                        startDate: { type: "string", description: "Data de início (YYYY-MM-DD)" },
                        endDate: { type: "string", description: "Data de fim (YYYY-MM-DD)" },
                        categoria: { type: "string", description: "Filtrar por categoria (ex: dor, objecao, barreira_acesso, motivo_perda, motivo_ganho)" },
                        topic: { type: "string", description: "Filtrar por tema ou assunto" },
                        search: { type: "string", description: "Busca textual livre em falas, notas e resumos" },
                        limit: { type: "number", description: "Quantidade máxima de registros (padrão: 30, máx: 50)" }
                    },
                    additionalProperties: false
                },
                securitySchemes,
                annotations: readOnlyAnnotations,
                _meta: meta
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
                annotations: readOnlyAnnotations,
                _meta: meta
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
                annotations: readOnlyAnnotations,
                _meta: meta
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
    // ChatGPT currently supports Streamable HTTP. Use the standard 2025-era
    // MCP lifecycle here so initialize creates a session and subsequent
    // tools/list and tools/call requests can reuse that authenticated session.
    // The previous implementation advertised 2026 server/discover manually,
    // but the project is pinned to the v1 SDK and could not serve the modern
    // stateless protocol after discovery. That caused ChatGPT tool refreshes
    // to fail after the initial probe.
    const handleStreamable = async (req, res) => {
        const sessionId = req.headers["mcp-session-id"];

        if (sessionId) {
            const session = streamableSessions.get(sessionId);
            if (!session) {
                return res.status(404).json({
                    jsonrpc: "2.0",
                    error: { code: -32001, message: "Session not found" },
                    id: null
                });
            }
            try {
                await session.transport.handleRequest(req, res, req.body);
            } catch (err) {
                console.error("MCP Streamable HTTP session error:", err);
                if (!res.headersSent) res.status(500).json({ error: "MCP internal server error" });
            }
            return;
        }

        if (req.method !== "POST" || !isInitializeRequest(req.body)) {
            return res.status(400).json({
                jsonrpc: "2.0",
                error: { code: -32000, message: "MCP session initialization required" },
                id: req.body?.id ?? null
            });
        }

        if (!verifyAccessToken(req, res)) return;

        try {
            let sessionTransport;
            const server = createMcpServer(req);
            sessionTransport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                enableJsonResponse: true,
                onsessioninitialized: (id) => {
                    streamableSessions.set(id, { transport: sessionTransport, server });
                }
            });

            sessionTransport.onclose = () => {
                if (sessionTransport.sessionId) {
                    streamableSessions.delete(sessionTransport.sessionId);
                }
                server.close().catch(() => {});
            };

            await server.connect(sessionTransport);
            await sessionTransport.handleRequest(req, res, req.body);
        } catch (err) {
            console.error("MCP Streamable HTTP initialize error:", err);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: "2.0",
                    error: { code: -32603, message: "MCP internal server error" },
                    id: req.body?.id ?? null
                });
            }
        }
    };

    // Primary Streamable HTTP endpoint. Keep /api/mcp/sse as the existing
    // configured URL so the current ChatGPT app does not need a new endpoint.
    app.post("/api/mcp/sse", handleStreamable);
    app.post("/api/mcp", handleStreamable);

    // Streamable HTTP GET/DELETE requests are routed through the same session.
    const handleStreamableSessionRequest = async (req, res) => {
        const sessionId = req.headers["mcp-session-id"];
        if (!sessionId || !streamableSessions.has(sessionId)) {
            return res.status(404).json({ error: "Session not found" });
        }
        try {
            await streamableSessions.get(sessionId).transport.handleRequest(req, res, req.body);
        } catch (err) {
            console.error("MCP Streamable HTTP session request error:", err);
            if (!res.headersSent) res.status(500).json({ error: "MCP internal server error" });
        }
    };

    app.get("/api/mcp/sse", handleStreamableSessionRequest);
    app.delete("/api/mcp/sse", handleStreamableSessionRequest);
    app.get("/api/mcp", handleStreamableSessionRequest);
    app.delete("/api/mcp", handleStreamableSessionRequest);

    // Legacy HTTP+SSE is retained under /api/mcp/messages for existing clients.
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

    app.post("/api/mcp/legacy-sse", handleLegacySse);
    app.get("/api/mcp/legacy-sse", handleLegacySse);

    app.post("/api/mcp/messages", async (req, res) => {
        const sessionId = req.query.sessionId;
        const session = transports.get(sessionId);
        if (!session) return res.status(404).send("Session not found");
        await session.transport.handlePostMessage(req, res, req.body);
    });
}
