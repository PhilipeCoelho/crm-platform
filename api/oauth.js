import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { randomUUID } from 'node:crypto';

const ISSUER = "https://crm-platform-ten-rose.vercel.app";
const MCP_RESOURCE = `${ISSUER}/api/mcp/sse`;
const MCP_METADATA = `${ISSUER}/.well-known/oauth-protected-resource`;
const AUTH_ENDPOINT = `${ISSUER}/api/oauth/authorize`;
const TOKEN_ENDPOINT = `${ISSUER}/api/oauth/token`;
const REGISTRATION_ENDPOINT = `${ISSUER}/api/oauth/register`;

function getSecret() {
    return process.env.OAUTH_JWT_SECRET || process.env.VAMUSS_GPT_KEY || 'fallback_secret';
}

function isAllowedRedirectUri(value) {
    try {
        const url = new URL(value);
        if (url.protocol !== 'https:') return false;
        return url.hostname === 'chatgpt.com' || url.hostname.endsWith('.chatgpt.com');
    } catch {
        return false;
    }
}

export function setupOAuth(app) {
    const JWT_SECRET = getSecret();

    const sendServerMetadata = (_req, res) => {
        res.json({
            issuer: ISSUER,
            authorization_endpoint: AUTH_ENDPOINT,
            token_endpoint: TOKEN_ENDPOINT,
            registration_endpoint: REGISTRATION_ENDPOINT,
            response_types_supported: ['code'],
            grant_types_supported: ['authorization_code', 'refresh_token'],
            code_challenge_methods_supported: ['S256'],
            scopes_supported: ['crm:read'],
            client_id_metadata_document_supported: true,
            token_endpoint_auth_methods_supported: ['none']
        });
    };

    app.get('/.well-known/oauth-authorization-server', sendServerMetadata);
    app.get('/.well-known/openid-configuration', sendServerMetadata);
    app.get('/api/oauth/.well-known/oauth-authorization-server', sendServerMetadata);

    const sendResourceMetadata = (_req, res) => {
        res.json({
            resource: MCP_RESOURCE,
            authorization_servers: [ISSUER],
            scopes_supported: ['crm:read'],
            bearer_methods_supported: ['header'],
            resource_documentation: 'https://vamuss.pt/'
        });
    };

    // Root metadata plus path-specific variants used by MCP clients during discovery.
    app.get('/.well-known/oauth-protected-resource', sendResourceMetadata);
    app.get('/.well-known/oauth-protected-resource/api/mcp/sse', sendResourceMetadata);
    app.get('/api/mcp/sse/.well-known/oauth-protected-resource', sendResourceMetadata);
    app.get('/api/mcp/.well-known/oauth-protected-resource', sendResourceMetadata);
    app.get('/api/oauth/.well-known/oauth-protected-resource', sendResourceMetadata);

    // Dynamic client registration. ChatGPT can also use CIMD; this endpoint exists for
    // clients/builders that explicitly choose DCR.
    app.post('/api/oauth/register', (req, res) => {
        const body = req.body || {};
        const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
        if (!redirectUris.length || redirectUris.some(uri => !isAllowedRedirectUri(uri))) {
            return res.status(400).json({
                error: 'invalid_client_metadata',
                error_description: 'redirect_uris must contain valid HTTPS ChatGPT callback URLs'
            });
        }

        const clientId = `vamuss-${randomUUID()}`;
        return res.status(201).json({
            client_id: clientId,
            client_id_issued_at: Math.floor(Date.now() / 1000),
            redirect_uris: redirectUris,
            token_endpoint_auth_method: 'none',
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            scope: 'crm:read'
        });
    });

    app.get('/api/oauth/authorize', (req, res) => {
        const {
            client_id,
            redirect_uri,
            response_type,
            scope,
            state,
            code_challenge,
            code_challenge_method,
            resource
        } = req.query;

        if (response_type !== 'code') {
            return res.status(400).send("Unsupported response_type. Must be 'code'.");
        }
        if (!redirect_uri || !isAllowedRedirectUri(redirect_uri)) {
            return res.status(400).send('Invalid redirect_uri.');
        }
        if (!code_challenge || code_challenge_method !== 'S256') {
            return res.status(400).send('PKCE S256 is required.');
        }
        if (resource && resource !== MCP_RESOURCE) {
            return res.status(400).send('Invalid resource.');
        }
        if (scope && scope !== 'crm:read') {
            return res.status(400).send('Only crm:read is supported.');
        }

        const html = `
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <title>Autorizar Vamuss CRM</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background:#f9fafb; display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; }
                    .card { background:#fff; padding:32px; border-radius:14px; box-shadow:0 4px 24px rgba(0,0,0,.10); width:min(420px, calc(100vw - 48px)); text-align:center; }
                    h1 { font-size:20px; margin:0 0 14px; } p { color:#4b5563; font-size:14px; line-height:1.5; margin:0 0 24px; }
                    .btn { width:100%; border:0; border-radius:8px; padding:13px 20px; background:#111827; color:white; font-size:15px; font-weight:600; cursor:pointer; }
                </style>
            </head>
            <body>
                <div class="card">
                    <h1>Conectar Vamuss CRM</h1>
                    <p>O aplicativo <strong>${String(client_id || 'ChatGPT').replace(/[<>"']/g, '')}</strong> solicita acesso <strong>somente leitura</strong> ao CRM Vamuss.</p>
                    <form method="POST" action="/api/oauth/authorize">
                        <input type="hidden" name="client_id" value="${String(client_id || '').replace(/"/g, '&quot;')}">
                        <input type="hidden" name="redirect_uri" value="${String(redirect_uri).replace(/"/g, '&quot;')}">
                        <input type="hidden" name="scope" value="crm:read">
                        <input type="hidden" name="state" value="${String(state || '').replace(/"/g, '&quot;')}">
                        <input type="hidden" name="code_challenge" value="${String(code_challenge).replace(/"/g, '&quot;')}">
                        <input type="hidden" name="code_challenge_method" value="S256">
                        <input type="hidden" name="resource" value="${MCP_RESOURCE}">
                        <button class="btn" type="submit">Autorizar acesso</button>
                    </form>
                </div>
            </body>
            </html>
        `;
        return res.send(html);
    });

    app.post('/api/oauth/authorize', (req, res) => {
        const body = req.body || {};
        const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, resource } = body;

        if (!redirect_uri || !isAllowedRedirectUri(redirect_uri)) return res.status(400).send('Invalid redirect_uri.');
        if (!code_challenge || code_challenge_method !== 'S256') return res.status(400).send('PKCE S256 is required.');
        if (resource !== MCP_RESOURCE) return res.status(400).send('Invalid resource.');
        if (scope && scope !== 'crm:read') return res.status(400).send('Only crm:read is supported.');

        const authCodePayload = {
            client_id: client_id || 'chatgpt',
            redirect_uri,
            scope: 'crm:read',
            code_challenge,
            code_challenge_method: 'S256',
            resource: MCP_RESOURCE
        };

        const code = jwt.sign(authCodePayload, JWT_SECRET, {
            expiresIn: '10m',
            issuer: ISSUER,
            audience: MCP_RESOURCE
        });

        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (state) redirectUrl.searchParams.set('state', state);
        return res.redirect(redirectUrl.toString());
    });

    app.post('/api/oauth/token', (req, res) => {
        const body = req.body || {};
        const { grant_type, code, redirect_uri, client_id, code_verifier, refresh_token, resource } = body;

        if (!grant_type) return res.status(400).json({ error: 'invalid_request', error_description: 'Missing grant_type' });

        if (grant_type === 'authorization_code') {
            try {
                if (!code_verifier) throw new Error('Missing code_verifier');
                const decoded = jwt.verify(code, JWT_SECRET, { issuer: ISSUER, audience: MCP_RESOURCE });

                if (decoded.resource !== MCP_RESOURCE) throw new Error('Invalid resource');
                if (decoded.code_challenge_method !== 'S256') throw new Error('Invalid PKCE method');
                const hash = crypto.createHash('sha256').update(code_verifier).digest('base64url');
                if (hash !== decoded.code_challenge) throw new Error('PKCE verification failed');
                if (decoded.redirect_uri !== redirect_uri || decoded.client_id !== client_id) throw new Error('Mismatching redirect_uri or client_id');
                if (resource !== MCP_RESOURCE) throw new Error('Invalid resource');

                const accessToken = jwt.sign(
                    { scope: 'crm:read', sub: '9469fb08-7de5-405e-a4e7-d83cf818ea1e', aud: MCP_RESOURCE },
                    JWT_SECRET,
                    { expiresIn: '2h', issuer: ISSUER }
                );
                const newRefreshToken = jwt.sign(
                    { scope: 'crm:read', type: 'refresh', sub: '9469fb08-7de5-405e-a4e7-d83cf818ea1e', aud: MCP_RESOURCE },
                    JWT_SECRET,
                    { expiresIn: '30d', issuer: ISSUER }
                );

                return res.json({
                    access_token: accessToken,
                    token_type: 'Bearer',
                    expires_in: 7200,
                    refresh_token: newRefreshToken,
                    scope: 'crm:read'
                });
            } catch (err) {
                return res.status(400).json({ error: 'invalid_grant', error_description: err.message || 'Invalid or expired authorization code' });
            }
        }

        if (grant_type === 'refresh_token') {
            try {
                const decoded = jwt.verify(refresh_token, JWT_SECRET, { issuer: ISSUER, audience: MCP_RESOURCE });
                if (decoded.type !== 'refresh' || decoded.scope !== 'crm:read') throw new Error('Invalid refresh token');
                if (resource !== MCP_RESOURCE) throw new Error('Invalid resource');

                const newAccessToken = jwt.sign(
                    { scope: 'crm:read', sub: decoded.sub, aud: MCP_RESOURCE },
                    JWT_SECRET,
                    { expiresIn: '2h', issuer: ISSUER }
                );
                const newRefreshToken = jwt.sign(
                    { scope: 'crm:read', type: 'refresh', sub: decoded.sub, aud: MCP_RESOURCE },
                    JWT_SECRET,
                    { expiresIn: '30d', issuer: ISSUER }
                );

                return res.json({
                    access_token: newAccessToken,
                    token_type: 'Bearer',
                    expires_in: 7200,
                    refresh_token: newRefreshToken,
                    scope: 'crm:read'
                });
            } catch (err) {
                return res.status(400).json({ error: 'invalid_grant', error_description: err.message || 'Invalid or expired refresh token' });
            }
        }

        return res.status(400).json({ error: 'unsupported_grant_type' });
    });
}
