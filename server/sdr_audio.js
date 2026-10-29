/**
 * server/sdr_audio.js
 * ============================================================================
 * VAMUSS SDR — PROCESSADOR DE ÁUDIO INBOUND (WHISPER) (UPGRADE GROK)
 * ============================================================================
 * Transcreve mensagens de voz recebidas no WhatsApp com OpenAI Whisper em pt-PT.
 * 
 * Regras Invioláveis:
 * 1. O agente NUNCA envia voice notes automáticos em nome do Philipe.
 * 2. O agente SEMPRE responde por texto.
 * 3. O áudio transcrito é encaminhado diretamente para o classificador de
 *    intenções e classificador de interlocutor como se fosse texto escrito.
 * 4. Se a transcrição tiver ruído ou baixa confiança, o agente pede confirmação:
 *    "Percebi que [resumo curto]. É isto?"
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

/**
 * Transcreve um ficheiro de áudio usando a API OpenAI Whisper
 * 
 * @param {Object} params
 * @param {string|Buffer} params.audioBufferOrPath - Caminho do ficheiro ou buffer de áudio
 * @param {string} [params.mimeType='audio/ogg'] - Tipo MIME (ex: audio/ogg, audio/mp4)
 * @returns {Promise<Object>} { success: boolean, text: string, confidence: number, error?: string }
 */
export async function transcribeInboundAudio({
    audioBufferOrPath,
    mimeType = 'audio/ogg'
}) {
    const openaiApiKey = process.env.OPENAI_API_KEY;

    if (!openaiApiKey) {
        console.warn('⚠️ [SDR Audio] OPENAI_API_KEY ausente. Transcrição de áudio não disponível.');
        return {
            success: false,
            text: '',
            confidence: 0,
            error: 'OPENAI_API_KEY ausente'
        };
    }

    try {
        let buffer;
        let filename = 'whatsapp_audio.ogg';

        if (typeof audioBufferOrPath === 'string') {
            if (!fs.existsSync(audioBufferOrPath)) {
                return { success: false, text: '', confidence: 0, error: 'Ficheiro de áudio não encontrado' };
            }
            buffer = fs.readFileSync(audioBufferOrPath);
            filename = path.basename(audioBufferOrPath);
        } else if (Buffer.isBuffer(audioBufferOrPath)) {
            buffer = audioBufferOrPath;
        } else {
            return { success: false, text: '', confidence: 0, error: 'Formato de áudio inválido' };
        }

        const formData = new FormData();
        const blob = new Blob([buffer], { type: mimeType });
        formData.append('file', blob, filename);
        formData.append('model', 'whisper-1');
        formData.append('language', 'pt');
        formData.append('temperature', '0.2');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: formData,
            signal: AbortSignal.timeout(15000)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Whisper API HTTP ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const transcribedText = (data.text || '').trim();

        // Avaliação de confiança simples baseada no tamanho e conteúdo
        const isVeryShortOrNoisy = transcribedText.length < 5 || /\[inaud[ií]vel\]/i.test(transcribedText);
        const confidence = isVeryShortOrNoisy ? 0.45 : 0.90;

        return {
            success: true,
            text: transcribedText,
            confidence,
            requiresClarification: isVeryShortOrNoisy,
            clarificationPrompt: isVeryShortOrNoisy
                ? `Percebi que disse "${transcribedText}". É isto que pretendia transmitir?`
                : null
        };
    } catch (err) {
        console.warn('⚠️ [SDR Audio] Erro na transcrição Whisper:', err.message);
        return {
            success: false,
            text: '',
            confidence: 0,
            error: err.message
        };
    }
}
