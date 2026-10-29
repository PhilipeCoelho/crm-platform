import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getVideoMetadata } from './video_intelligence.js';

/**
 * Normaliza e valida URLs do Instagram (Reels, Posts de vídeo, TV)
 */
export function normalizeInstagramUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
        return { isValid: false, error: 'URL vazio ou inválido.' };
    }

    const trimmed = rawUrl.trim();

    // Regex para capturar shortcode de reels, p, tv e shares
    const match = trimmed.match(/(?:instagram\.com\/(?:reel|reels|p|tv)\/|instagram\.com\/share\/reel\/)([A-Za-z0-9_-]+)/i);

    if (!match || !match[1]) {
        return {
            isValid: false,
            error: 'O URL fornecido não é um link válido de Reel ou publicação do Instagram (ex: https://www.instagram.com/reel/CODE/).'
        };
    }

    const shortcode = match[1];
    const canonicalUrl = `https://www.instagram.com/reel/${shortcode}/`;

    return {
        isValid: true,
        shortcode,
        canonicalUrl,
        platform: 'instagram'
    };
}

// Bloqueio de chamadas concorrentes para evitar cobranças/downloads duplicados
const inFlightResolutions = new Map();

/**
 * Descarrega o stream de vídeo do CDN e valida a integridade do ficheiro local
 */
async function downloadAndValidateVideo(videoCdnUrl, shortcode) {
    const uploadDir = path.join(process.cwd(), 'uploads', 'content_videos');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filename = `reel_${shortcode}_${Date.now()}_${randomUUID().slice(0, 6)}.mp4`;
    const localFilePath = path.join(uploadDir, filename);

    console.log(`⬇️ [Video Resolver] A descarregar vídeo do CDN para: ${filename}`);

    const response = await fetch(videoCdnUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        throw new Error(`Falha no download do CDN do vídeo: HTTP ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 50 * 1024) {
        throw new Error(`O arquivo descarregado tem apenas ${buffer.length} bytes, insuficiente para um vídeo real.`);
    }

    fs.writeFileSync(localFilePath, buffer);

    // Validação real com ffprobe
    const metadata = getVideoMetadata(localFilePath);
    if (!metadata || metadata.duration <= 0) {
        // Se ffprobe não conseguiu ler duração, limpar arquivo inválido
        try { if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath); } catch {}
        throw new Error('O ficheiro descarregado não pôde ser validado como vídeo válido (duração inválida ou metadados corrompidos).');
    }

    return {
        filename,
        localFilePath,
        videoFileUrl: `/uploads/content_videos/${filename}`,
        fileSize: buffer.length,
        metadata
    };
}

/**
 * Consulta a API do Apify para extrair o vídeo de um Reel público
 */
async function queryApifyForReel(canonicalUrl, shortcode, token, actorId) {
    const encodedActorId = actorId.replace('/', '~');
    const endpoint = `https://api.apify.com/v2/acts/${encodedActorId}/run-sync-get-dataset-items?token=${token}&timeout=120`;

    // Payloads específicos conforme o ator selecionado
    let payload;
    if (actorId.includes('easyapi') || actorId.includes('downloader') || actorId.includes('saver')) {
        payload = { links: [canonicalUrl] };
    } else if (actorId.includes('coregent')) {
        payload = { startUrls: [{ url: canonicalUrl }], resultsLimit: 1 };
    } else {
        payload = { directUrls: [canonicalUrl], resultsType: 'posts', resultsLimit: 1 };
    }

    console.log(`📡 [Video Resolver] A chamar Apify Actor (${actorId}) para: ${canonicalUrl}`);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [Video Resolver] Erro Apify (${response.status}):`, errorText);

        if (response.status === 401) {
            throw new Error('APIFY_API_TOKEN inválido ou expirado. Verifica a tua chave no Apify Console.');
        } else if (response.status === 402) {
            throw new Error('Créditos insuficientes na conta Apify para executar a recuperação.');
        } else if (response.status === 404) {
            throw new Error(`Actor Apify '${actorId}' não encontrado.`);
        } else {
            throw new Error(`Erro na API do Apify (${response.status}): ${errorText.slice(0, 150)}`);
        }
    }

    const items = await response.json();
    if (!Array.isArray(items) || items.length === 0) {
        throw new Error('O scraper do Apify não devolveu resultados para este URL. O Reel pode ser privado ou inexistente.');
    }

    const item = items[0];

    // Verificar se o item devolveu erro interno da plataforma
    if (item.type === 'error' || item.error === true) {
        throw new Error(item.errorMessage || item.message || 'Publicação não encontrada no Instagram ou perfil privado.');
    }

    // 1. Formato de download direto (ex: easyapi/instagram-reels-downloader)
    let directVideoUrl = null;
    if (item.result?.medias && Array.isArray(item.result.medias) && item.result.medias.length > 0) {
        const videoMedia = item.result.medias.find(m => m.type === 'video' || (m.url && m.url.includes('.mp4'))) || item.result.medias[0];
        if (videoMedia?.url) directVideoUrl = videoMedia.url;
    }

    // 2. Formato padrão de outros scrapers (videoUrl, video_url, downloadUrl)
    if (!directVideoUrl) {
        directVideoUrl = 
            item.videoUrl || 
            item.video_url || 
            item.downloadUrl || 
            item.savedUrl ||
            item.videoUrlHd ||
            item.media?.videoUrl ||
            item.media?.url ||
            (Array.isArray(item.sidecarChildren) && item.sidecarChildren[0]?.videoUrl);
    }

    if (!directVideoUrl) {
        if (item.isPrivate) {
            throw new Error('Esta publicação é de um perfil privado do Instagram. O sistema apenas consegue recuperar Reels de perfis públicos.');
        }
        if (item.type === 'Sidecar' || item.type === 'Image') {
            throw new Error('A publicação recuperada é uma imagem ou carrossel de fotos, não um vídeo Reel.');
        }
        throw new Error('O scraper acedeu à publicação mas não devolveu um endereço de vídeo direto para download.');
    }

    return {
        videoCdnUrl: directVideoUrl,
        caption: item.caption || item.text || item.result?.title || '',
        author: item.ownerUsername || item.author || item.owner?.username || '',
        likes: item.likesCount || item.likes || item.result?.like_count || 0,
        thumbnailUrl: item.thumbnailUrl || item.displayUrl || item.imageUrl || item.result?.thumbnail || null
    };
}

/**
 * Função Principal: Resolve um Reel por URL público
 * Retorna o vídeo pronto e persistido em `uploads/content_videos/` com metadados verificados
 */
export async function resolveVideoFromUrl(rawUrl, options = {}) {
    // 1. Normalizar e validar o URL
    const norm = normalizeInstagramUrl(rawUrl);
    if (!norm.isValid) {
        return {
            success: false,
            code: 'INVALID_URL',
            error: norm.error,
            statusType: 'erro_recuperacao'
        };
    }

    const { shortcode, canonicalUrl } = norm;

    // 2. Verificar se já existe resolução em andamento para este shortcode (prevenção de duplo clique)
    if (inFlightResolutions.has(shortcode)) {
        console.log(`⏳ [Video Resolver] Resolução já em curso para ${shortcode}, aguardando promessa existente...`);
        try {
            return await inFlightResolutions.get(shortcode);
        } catch (existingErr) {
            return {
                success: false,
                code: 'CONCURRENT_ERROR',
                error: existingErr.message,
                statusType: 'erro_recuperacao'
            };
        }
    }

    // 3. Verificar configuração do Apify
    const apifyToken = process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN || '';
    const actorId = process.env.APIFY_INSTAGRAM_ACTOR_ID || 'easyapi/instagram-reels-downloader';

    if (!apifyToken) {
        return {
            success: false,
            code: 'MISSING_APIFY_TOKEN',
            statusType: 'erro_recuperacao',
            error: 'Configuração necessária: APIFY_API_TOKEN não está configurada no ficheiro .env.',
            setupGuide: {
                title: 'Ativação da Recuperação Automática de Reels por URL',
                description: 'Para analisar Reels diretamente a partir de links públicos sem upload manual, configura o token gratuito da Apify:',
                steps: [
                    '1. Cria ou acede à tua conta no Apify: https://console.apify.com/sign-up (5$ de crédito gratuito renovado todo mês).',
                    '2. Abre o menu Integrations > API Tokens: https://console.apify.com/account/integrations',
                    '3. Copia o teu "Personal API token".',
                    '4. Adiciona a linha no teu arquivo .env: APIFY_API_TOKEN=apify_api_... e reinicia o servidor.',
                    '5. Opcional: Define APIFY_INSTAGRAM_ACTOR_ID=apify/instagram-reel-scraper (ou coregent/instagram-posts-scraper).'
                ],
                accountUrl: 'https://console.apify.com/account/integrations'
            }
        };
    }

    // 4. Executar fluxo de resolução protegido
    const resolutionPromise = (async () => {
        try {
            // A. Obter URL do vídeo via Apify
            const reelData = await queryApifyForReel(canonicalUrl, shortcode, apifyToken, actorId);

            // B. Descarregar o ficheiro e validar com ffprobe
            const downloaded = await downloadAndValidateVideo(reelData.videoCdnUrl, shortcode);

            return {
                success: true,
                code: 'SUCCESS',
                statusType: 'video_recuperado',
                videoFileUrl: downloaded.videoFileUrl,
                localFilePath: downloaded.localFilePath,
                fileName: downloaded.filename,
                fileSize: downloaded.fileSize,
                metadata: downloaded.metadata,
                postDetails: {
                    canonicalUrl,
                    shortcode,
                    caption: reelData.caption,
                    author: reelData.author,
                    likes: reelData.likes,
                    thumbnailUrl: reelData.thumbnailUrl
                }
            };
        } catch (err) {
            console.error(`❌ [Video Resolver] Falha ao recuperar vídeo de ${canonicalUrl}:`, err.message);
            return {
                success: false,
                code: 'RETRIEVAL_FAILED',
                statusType: 'erro_recuperacao',
                error: err.message
            };
        }
    })();

    inFlightResolutions.set(shortcode, resolutionPromise);

    try {
        return await resolutionPromise;
    } finally {
        inFlightResolutions.delete(shortcode);
    }
}
