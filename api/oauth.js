import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import express from 'express';

// Minimal stateless OAuth 2.1 Server for MCP
export function setupOAuth(app) {
    const JWT_SECRET = process.env.OAUTH_JWT_SECRET || process.env.VAMUSS_GPT_KEY || 'fallback_secret';
    
    // 1. Authorization Server & Protected Resource Metadata
    const sendServerMetadata = (req, res) => {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;
        
        res.json({
            issuer: baseUrl,
            authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
            token_endpoint: `${baseUrl}/api/oauth/token`,
            response_types_supported: ["code"],
            grant_types_supported: ["authorization_code", "refresh_token"],
            code_challenge_methods_supported: ["S256"],
            scopes_supported: ["crm:read"],
            token_endpoint_auth_methods_supported: ["none", "client_secret_post", "client_secret_basic"]
        });
    };

    app.get('/.well-known/oauth-authorization-server', sendServerMetadata);
    app.get('/.well-known/openid-configuration', sendServerMetadata);
    app.get('/api/oauth/.well-known/oauth-authorization-server', sendServerMetadata);

    // RFC 9728 Protected Resource Metadata (MCP OAuth 2.1)
    const sendResourceMetadata = (req, res) => {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.headers.host;
        const baseUrl = `${protocol}://${host}`;

        res.json({
            resource: `${baseUrl}/api/mcp/sse`,
            authorization_servers: [baseUrl],
            scopes_supported: ["crm:read"],
            bearer_methods_supported: ["header"]
        });
    };

    app.get('/.well-known/oauth-protected-resource', sendResourceMetadata);
    app.get('/api/oauth/.well-known/oauth-protected-resource', sendResourceMetadata);

    // 2. Authorization Endpoint (GET - render form)
    app.get('/api/oauth/authorize', (req, res) => {
        const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;

        if (response_type !== 'code') {
            return res.status(400).send("Unsupported response_type. Must be 'code'.");
        }
        
        // Render a simple HTML approval form
        const html = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <title>Autorizar Vamuss CRM (MCP)</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f9fafb; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; }
                    .card { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 400px; text-align: center; }
                    h1 { font-size: 20px; color: #111827; margin-bottom: 16px; }
                    p { color: #4B5563; font-size: 14px; margin-bottom: 24px; line-height: 1.5; }
                    .btn { background: #000; color: #fff; border: none; padding: 12px 24px; border-radius: 6px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.2s; }
                    .btn:hover { background: #333; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Conectar Vamuss CRM</h1>
                    <p>O aplicativo <strong>${client_id || 'ChatGPT'}</strong> está solicitando acesso somente leitura (<strong>${scope || 'crm:read'}</strong>) aos dados do seu CRM estratégico.</p>
                    <form method="POST" action="/api/oauth/authorize">
                        <input type="hidden" name="client_id" value="${client_id || ''}">
                        <input type="hidden" name="redirect_uri" value="${redirect_uri || ''}">
                        <input type="hidden" name="scope" value="${scope || 'crm:read'}">
                        <input type="hidden" name="state" value="${state || ''}">
                        <input type="hidden" name="code_challenge" value="${code_challenge || ''}">
                        <input type="hidden" name="code_challenge_method" value="${code_challenge_method || 'S256'}">
                        <button type="submit" class="btn">Autorizar Acesso</button>
                    </form>
                </div>
            </body>
            </html>
        `;
        res.send(html);
    });

    // 3. Authorization Endpoint (POST - process approval)
    app.post('/api/oauth/authorize', (req, res) => {
        const body = req.body || {};
        const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } = body;
        
        if (!redirect_uri) {
            return res.status(400).send("Missing redirect_uri");
        }
        
        // Em um sistema multiusuário, validaríamos a sessão aqui. Como é single-user, apenas emitimos o código.
        const authCodePayload = {
            client_id,
            redirect_uri,
            scope: 'crm:read', // Força read-only
            code_challenge,
            code_challenge_method
        };
        
        const code = jwt.sign(authCodePayload, JWT_SECRET, { expiresIn: '10m' });
        
        // Redireciona de volta para o cliente
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (state) {
            redirectUrl.searchParams.set('state', state);
        }
        
        res.redirect(redirectUrl.toString());
    });

    // 4. Token Endpoint
    app.post('/api/oauth/token', (req, res) => {
        const body = req.body || {};
        const { grant_type, code, redirect_uri, client_id, code_verifier, refresh_token } = body;
        
        if (!grant_type) {
            return res.status(400).json({ error: 'invalid_request', error_description: 'Missing grant_type' });
        }
        
        if (grant_type === 'authorization_code') {
            try {
                // Valida o código
                const decoded = jwt.verify(code, JWT_SECRET);
                
                // Valida PKCE se fornecido (ChatGPT usa S256)
                if (decoded.code_challenge) {
                    if (decoded.code_challenge_method === 'S256') {
                        const hash = crypto.createHash('sha256').update(code_verifier).digest('base64url');
                        if (hash !== decoded.code_challenge) {
                            return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
                        }
                    } else if (code_verifier !== decoded.code_challenge) {
                        return res.status(400).json({ error: 'invalid_grant', error_description: 'PKCE verification failed' });
                    }
                }
                
                if (decoded.redirect_uri !== redirect_uri || decoded.client_id !== client_id) {
                    return res.status(400).json({ error: 'invalid_grant', error_description: 'Mismatching redirect_uri or client_id' });
                }
                
                // Gera os tokens finais
                const accessToken = jwt.sign({ scope: 'crm:read', sub: '9469fb08-7de5-405e-a4e7-d83cf818ea1e' }, JWT_SECRET, { expiresIn: '2h' });
                const refreshToken = jwt.sign({ scope: 'crm:read', type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });
                
                return res.json({
                    access_token: accessToken,
                    token_type: 'Bearer',
                    expires_in: 7200,
                    refresh_token: refreshToken,
                    scope: 'crm:read'
                });
            } catch (err) {
                return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired authorization code' });
            }
        } else if (grant_type === 'refresh_token') {
            try {
                const decoded = jwt.verify(refresh_token, JWT_SECRET);
                if (decoded.type !== 'refresh') throw new Error('Invalid token type');
                
                const newAccessToken = jwt.sign({ scope: 'crm:read', sub: '9469fb08-7de5-405e-a4e7-d83cf818ea1e' }, JWT_SECRET, { expiresIn: '2h' });
                // Return a new refresh token to implement rotation, or keep the old one
                const newRefreshToken = jwt.sign({ scope: 'crm:read', type: 'refresh' }, JWT_SECRET, { expiresIn: '30d' });

                return res.json({
                    access_token: newAccessToken,
                    token_type: 'Bearer',
                    expires_in: 7200,
                    refresh_token: newRefreshToken,
                    scope: 'crm:read'
                });
            } catch (err) {
                return res.status(400).json({ error: 'invalid_grant', error_description: 'Invalid or expired refresh token' });
            }
        }
        
        return res.status(400).json({ error: 'unsupported_grant_type' });
    });
}
