import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { randomUUID } from 'node:crypto';

const ISSUER = "https://crm-platform-ten-rose.vercel.app";
const MCP_RESOURCE = `${ISSUER}/api/mcp/sse`;
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

function normalizeScopes(value) {
    if (Array.isArray(value)) return value.flatMap(normalizeScopes);
    return String(value || '').split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
}

function hasRequiredScope(value) {
    return normalizeScopes(value).includes('crm:read');
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
            scopes_supported: ['crm:read', 'offline_access'],
            client_id_metadata_document_supported: true,
            token_endpoint_auth_methods_supported: ['none']
        });
    };

    app.get('/.well-known/oauth-authorization-server', sendServerMetadata);
    // OAuth 2.1 only: do not advertise an OIDC discovery document because this server
    // does not implement userinfo/id_token endpoints.
    app.get('/api/oauth/.well-known/oauth-authorization-server', sendServerMetadata);

    const sendResourceMetadata = (_req, res) => {
        res.json({
            resource: MCP_RESOURCE,
            authorization_servers: [ISSUER],
            scopes_supported: ['crm:read', 'offline_access'],
            bearer_methods_supported: ['header'],
            resource_documentation: 'https://vamuss.pt/'
        });
    };

    app.get('/.well-known/oauth-protected-resource', sendResourceMetadata);
    app.get('/.well-known/oauth-protected-resource/api/mcp/sse', sendResourceMetadata);
    app.get('/api/mcp/sse/.well-known/oauth-protected-resource', sendResourceMetadata);
    app.get('/api/mcp/.well-known/oauth-protected-resource', sendResourceMetadata);
    app.get('/api/oauth/.well-known/oauth-protected-resource', sendResourceMetadata);

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
            scope: 'crm:read offline_access'
        });
    });

    app.get('/api/oauth/authorize', (req, res) => {
        const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method, resource } = req.query;
        if (response_type !== 'code') return res.status(400).send("Unsupported response_type. Must be 'code'.");
        if (!redirect_uri || !isAllowedRedirectUri(redirect_uri)) return res.status(400).send('Invalid redirect_uri.');
        if (!code_challenge || code_challenge_method !== 'S256') return res.status(400).send('PKCE S256 is required.');
        if (resource && resource !== MCP_RESOURCE) return res.status(400).send('Invalid resource.');
        if (scope && !hasRequiredScope(scope)) return res.status(400).send('Scope crm:read is required.');

        const requestedScopes = normalizeScopes(scope);
        const grantedScopes = ['crm:read'];
        if (requestedScopes.includes('offline_access')) grantedScopes.push('offline_access');
        const grantedScope = grantedScopes.join(' ');

        const html = `
            <!DOCTYPE html><html lang="pt-BR"><head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>Autorizar Vamuss CRM</title>
            <style>
            body { font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; background:#f9fafb; display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; }
            .card { background:#fff; padding:32px; border-radius:14px; box-shadow:0 4px 24px rgba(0,0,0,.10); width:min(420px,calc(100vw - 48px)); text-align:center; }
            h1 { font-size:20px; margin:0 0 14px; } p { color:#4b5563; font-size:14px; line-height:1.5; margin:0 0 24px; }
            .btn { width:100%; border:0; border-radius:8px; padding:13px 20px; background:#111827; color:white; font-size:15px; font-weight:600; cursor:pointer; }
            </style></head><body><div class="card">
            <h1>Conectar Vamuss CRM</h1>
            <p>O aplicativo <strong>${String(client_id || 'ChatGPT').replace(/[<>"']/g, '')}</strong> solicita acesso <strong>somente leitura</strong> ao CRM Vamuss.</p>
            <form method="POST" action="/api/oauth/authorize">
            <input type="hidden" name="client_id" value="${String(client_id || '').replace(/"/g, '&quot;')}">
            <input type="hidden" name="redirect_uri" value="${String(redirect_uri).replace(/"/g, '&quot;')}">
            <input type="hidden" name="scope" value="${grantedScope}">
            <input type="hidden" name="state" value="${String(state || '').replace(/"/g, '&quot;')}">
            <input type="hidden" name="code_challenge" value="${String(code_challenge).replace(/"/g, '&quot;')}">
            <input type="hidden" name="code_challenge_method" value="S256">
            <input type="hidden" name="resource" value="${MCP_RESOURCE}">
            <button class="btn" type="submit">Autorizar acesso</button></form>
            </div></body></html>`;
        return res.send(html);
    });

    app.post('/api/oauth/authorize', (req, res) => {
        const body = req.body || {};
        const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method, resource } = body;
        if (!redirect_uri || !isAllowedRedirectUri(redirect_uri)) return res.status(400).send('Invalid redirect_uri.');
        if (!code_challenge || code_challenge_method !== 'S256') return res.status(400).send('PKCE S256 is required.');
        if (resource !== MCP_RESOURCE) return res.status(400).send('Invalid resource.');
        if (scope && !hasRequiredScope(scope)) return res.status(400).send('Scope crm:read is required.');

        const requestedScopes = normalizeScopes(scope);
        const grantedScopes = ['crm:read'];
        if (requestedScopes.includes('offline_access')) grantedScopes.push('offline_access');
        const grantedScope = grantedScopes.join(' ');

        const authCodePayload = {
            client_id: client_id || 'chatgpt', redirect_uri, scope: grantedScope,
            code_challenge, code_challenge_method: 'S256', resource: MCP_RESOURCE
        };
        const code = jwt.sign(authCodePayload, JWT_SECRET, { expiresIn:'10m', issuer:ISSUER, audience:MCP_RESOURCE });
        const redirectUrl = new URL(redirect_uri);
        redirectUrl.searchParams.set('code', code);
        if (state) redirectUrl.searchParams.set('state', state);
        return res.redirect(redirectUrl.toString());
    });

    app.post('/api/oauth/token', (req, res) => {
        const body = req.body || {};
        const { grant_type, code, redirect_uri, client_id, code_verifier, refresh_token, resource } = body;
        if (!grant_type) return res.status(400).json({ error:'invalid_request', error_description:'Missing grant_type' });

        if (grant_type === 'authorization_code') {
            try {
                if (!code_verifier) throw new Error('Missing code_verifier');
                const decoded = jwt.verify(code, JWT_SECRET, { issuer:ISSUER, audience:MCP_RESOURCE });
                if (decoded.resource !== MCP_RESOURCE) throw new Error('Invalid resource');
                if (decoded.code_challenge_method !== 'S256') throw new Error('Invalid PKCE method');
                if (!hasRequiredScope(decoded.scope)) throw new Error('Missing crm:read scope');
                const hash = crypto.createHash('sha256').update(code_verifier).digest('base64url');
                if (hash !== decoded.code_challenge) throw new Error('PKCE verification failed');
                if (decoded.redirect_uri !== redirect_uri || decoded.client_id !== client_id) throw new Error('Mismatching redirect_uri or client_id');
                if (resource !== MCP_RESOURCE) throw new Error('Invalid resource');

                const scope = decoded.scope || 'crm:read';
                const accessToken = jwt.sign({ scope, sub:'9469fb08-7de5-405e-a4e7-d83cf818ea1e', aud:MCP_RESOURCE }, JWT_SECRET, { expiresIn:'2h', issuer:ISSUER });
                const newRefreshToken = jwt.sign({ scope, type:'refresh', sub:'9469fb08-7de5-405e-a4e7-d83cf818ea1e', aud:MCP_RESOURCE }, JWT_SECRET, { expiresIn:'30d', issuer:ISSUER });
                return res.json({ access_token:accessToken, token_type:'Bearer', expires_in:7200, refresh_token:newRefreshToken, scope });
            } catch (err) {
                return res.status(400).json({ error:'invalid_grant', error_description:err.message || 'Invalid or expired authorization code' });
            }
        }

        if (grant_type === 'refresh_token') {
            try {
                if (!refresh_token) throw new Error('Missing refresh_token');
                const decoded = jwt.verify(refresh_token, JWT_SECRET, { issuer:ISSUER, audience:MCP_RESOURCE });
                if (decoded.type !== 'refresh' || !hasRequiredScope(decoded.scope)) throw new Error('Invalid refresh token');
                if (resource !== MCP_RESOURCE) throw new Error('Invalid resource');
                const scope = decoded.scope || 'crm:read';
                const newAccessToken = jwt.sign({ scope, sub:decoded.sub, aud:MCP_RESOURCE }, JWT_SECRET, { expiresIn:'2h', issuer:ISSUER });
                const newRefreshToken = jwt.sign({ scope, type:'refresh', sub:decoded.sub, aud:MCP_RESOURCE }, JWT_SECRET, { expiresIn:'30d', issuer:ISSUER });
                return res.json({ access_token:newAccessToken, token_type:'Bearer', expires_in:7200, refresh_token:newRefreshToken, scope });
            } catch (err) {
                return res.status(400).json({ error:'invalid_grant', error_description:err.message || 'Invalid or expired refresh token' });
            }
        }
        return res.status(400).json({ error:'unsupported_grant_type' });
    });
}
