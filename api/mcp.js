import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import jwt from "jsonwebtoken";

const transports = new Map();

export function setupMcp(app) {
    app.get('/api/mcp/sse', async (req, res) => {
        // Authenticate request via OAuth JWT
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '');
        const JWT_SECRET = process.env.OAUTH_JWT_SECRET || process.env.VAMUSS_GPT_KEY || 'fallback_secret';
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            if (!decoded.scope || !decoded.scope.includes('crm:read')) {
                return res.status(403).json({ error: 'Forbidden: Insufficient scope' });
            }
        } catch (err) {
            return res.status(401).json({ error: 'Unauthorized: Invalid token' });
        }

        const transport = new SSEServerTransport("/api/mcp/messages", res);
        const server = createMcpServer(req);
        
        await server.connect(transport);
        transports.set(transport.sessionId, { transport, server });
        
        req.on('close', () => {
            transports.delete(transport.sessionId);
        });
    });

    app.post('/api/mcp/messages', async (req, res) => {
        const sessionId = req.query.sessionId;
        const session = transports.get(sessionId);
        if (!session) {
            return res.status(404).send("Session not found");
        }
        await session.transport.handlePostMessage(req, res);
    });
}

function createMcpServer(req) {
    const server = new Server({
        name: "Vamuss CRM MCP Server",
        version: "1.0.0"
    }, {
        capabilities: {
            tools: {}
        }
    });

    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return {
            tools: [
                {
                    name: "get_metrics",
                    description: "Consulta a visão executiva e métricas do funil.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            startDate: { type: "string" },
                            endDate: { type: "string" }
                        }
                    }
                },
                {
                    name: "search_deals",
                    description: "Lista negócios filtrados.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            startDate: { type: "string" },
                            endDate: { type: "string" },
                            status: { type: "string" }
                        }
                    }
                },
                {
                    name: "get_market_signals",
                    description: "Obtém insights comerciais e de mercado.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            startDate: { type: "string" },
                            endDate: { type: "string" }
                        }
                    }
                },
                {
                    name: "get_deal_dossier",
                    description: "Raio-X profundo e individual de uma clínica.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            id: { type: "string" }
                        },
                        required: ["id"]
                    }
                },
                {
                    name: "get_content_memory",
                    description: "Consulta memória de conteúdo e ângulos.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            topic: { type: "string" },
                            limit: { type: "number" }
                        }
                    }
                }
            ]
        };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        
        // Build base URL to call existing REST endpoints
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
        const host = req.headers.host || 'localhost:3001';
        const baseUrl = `${protocol}://${host}`;
        
        const headers = {
            'Authorization': `Bearer ${process.env.VAMUSS_GPT_KEY}`,
            'Content-Type': 'application/json'
        };

        try {
            let result;
            if (name === "get_metrics") {
                const params = new URLSearchParams(args || {}).toString();
                const res = await fetch(`${baseUrl}/api/gpt/metrics?${params}`, { headers });
                result = await res.json();
            } else if (name === "search_deals") {
                const params = new URLSearchParams(args || {}).toString();
                const res = await fetch(`${baseUrl}/api/gpt/deals?${params}`, { headers });
                result = await res.json();
            } else if (name === "get_market_signals") {
                const params = new URLSearchParams(args || {}).toString();
                const res = await fetch(`${baseUrl}/api/gpt/market-signals?${params}`, { headers });
                result = await res.json();
            } else if (name === "get_deal_dossier") {
                const id = args.id;
                const res = await fetch(`${baseUrl}/api/gpt/deal-dossier/${id}`, { headers });
                result = await res.json();
            } else if (name === "get_content_memory") {
                const params = new URLSearchParams(args || {}).toString();
                const res = await fetch(`${baseUrl}/api/gpt/content-memory?${params}`, { headers });
                result = await res.json();
            } else {
                throw new Error(`Tool not found: ${name}`);
            }

            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify(result, null, 2)
                    }
                ]
            };
        } catch (err) {
            return {
                content: [
                    {
                        type: "text",
                        text: `Error executing tool: ${err.message}`
                    }
                ],
                isError: true
            };
        }
    });

    return server;
}
