import 'dotenv/config';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || process.env.VAMUSS_GPT_KEY || '';

/**
 * Verifica disponibilidade do ffmpeg e ffprobe
 */
export function checkFfmpegAvailable() {
    try {
        execSync('ffmpeg -version', { stdio: 'pipe' });
        execSync('ffprobe -version', { stdio: 'pipe' });
        return true;
    } catch {
        return false;
    }
}

/**
 * Extrai metadados do vídeo usando ffprobe
 */
export function getVideoMetadata(videoPath) {
    try {
        const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
        const output = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
        const data = JSON.parse(output);

        const videoStream = data.streams?.find(s => s.codec_type === 'video');
        const audioStream = data.streams?.find(s => s.codec_type === 'audio');

        const duration = parseFloat(data.format?.duration || videoStream?.duration || '0');
        const width = parseInt(videoStream?.width || '0', 10);
        const height = parseInt(videoStream?.height || '0', 10);
        const hasAudio = Boolean(audioStream);

        return {
            duration,
            width,
            height,
            aspectRatio: width && height ? (width / height < 0.7 ? '9:16 (Vertical)' : width / height > 1.3 ? '16:9 (Horizontal)' : '1:1 (Quadrado)') : 'desconhecido',
            hasAudio,
            sizeBytes: fs.statSync(videoPath).size
        };
    } catch (err) {
        console.warn('⚠️ [Video Intelligence] Aviso ao ler metadados com ffprobe:', err.message);
        return {
            duration: 0,
            width: 0,
            height: 0,
            aspectRatio: 'desconhecido',
            hasAudio: true,
            sizeBytes: fs.existsSync(videoPath) ? fs.statSync(videoPath).size : 0
        };
    }
}

/**
 * Extrai o áudio do vídeo em formato MP3 mono 16kHz (ideal para o Whisper)
 */
export function extractAudioFromVideo(videoPath, outputAudioPath) {
    try {
        const cmd = `ffmpeg -y -i "${videoPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k "${outputAudioPath}"`;
        execSync(cmd, { stdio: 'pipe' });
        return fs.existsSync(outputAudioPath) && fs.statSync(outputAudioPath).size > 0;
    } catch (err) {
        console.warn('⚠️ [Video Intelligence] Falha na extração de áudio:', err.message);
        return false;
    }
}

/**
 * Transcreve áudio com OpenAI Whisper
 */
export async function transcribeAudioWithWhisper(audioPath) {
    if (!OPENAI_API_KEY) {
        throw new Error('Chave OpenAI não configurada para transcrição Whisper.');
    }

    if (!fs.existsSync(audioPath) || fs.statSync(audioPath).size === 0) {
        return { hasSpeech: false, fullText: '', segments: [], firstWords: '' };
    }

    const audioBuffer = fs.readFileSync(audioPath);
    const blob = new Blob([audioBuffer], { type: 'audio/mpeg' });

    const formData = new FormData();
    formData.append('file', blob, 'audio.mp3');
    formData.append('model', 'whisper-1');
    formData.append('response_format', 'verbose_json');

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        body: formData
    });

    if (!resp.ok) {
        const errText = await resp.text();
        console.warn('⚠️ [Video Intelligence] Erro na API do Whisper:', errText);
        return { hasSpeech: false, fullText: '', segments: [], firstWords: '' };
    }

    const data = await resp.json();
    const fullText = (data.text || '').trim();

    // Se o Whisper não detetou fala
    if (!fullText || fullText.length < 2) {
        return { hasSpeech: false, fullText: '', segments: [], firstWords: '' };
    }

    const rawSegments = Array.isArray(data.segments) ? data.segments : [];
    const segments = rawSegments.map(s => ({
        start: parseFloat(s.start.toFixed(2)),
        end: parseFloat(s.end.toFixed(2)),
        text: (s.text || '').trim()
    }));

    // Primeiras palavras nos primeiros segundos
    const earlySegments = segments.filter(s => s.start <= 3.5);
    const firstWords = earlySegments.map(s => s.text).join(' ').trim() || segments[0]?.text || fullText.slice(0, 80);

    return {
        hasSpeech: true,
        language: data.language || 'pt',
        duration: data.duration,
        fullText,
        segments,
        firstWords
    };
}

/**
 * Extrai fotogramas estratégicos (priorizando o gancho de abertura 0-3s)
 */
export function extractStrategicKeyframes(videoPath, duration, outputDir, maxFrames = 7) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const validDuration = duration > 1 ? duration : 30; // fallback se duração não for conhecida
    const timestamps = [];

    // Foco prioritário na Abertura e Gancho (0s - 3s)
    timestamps.push({ label: '0.2s (Abertura / Primeiro Frame)', sec: 0.2 });
    if (validDuration >= 2) timestamps.push({ label: '1.5s (Gancho Visual / Legenda)', sec: 1.5 });
    if (validDuration >= 3.5) timestamps.push({ label: '3.0s (Retenção / Transição do Gancho)', sec: 3.0 });

    // Progressão narrativa ao longo do vídeo
    const remainingSlots = maxFrames - timestamps.length;
    const interval = (validDuration - 3.5) / (remainingSlots + 1);

    for (let i = 1; i <= remainingSlots; i++) {
        const sec = Math.min(validDuration - 0.5, 3.5 + (interval * i));
        timestamps.push({
            label: `${sec.toFixed(1)}s (Desenvolvimento / ${Math.round((sec / validDuration) * 100)}%)`,
            sec: parseFloat(sec.toFixed(2))
        });
    }

    const extractedFrames = [];

    for (let i = 0; i < timestamps.length; i++) {
        const item = timestamps[i];
        const frameFileName = `frame_${i}_${item.sec}s.jpg`;
        const framePath = path.join(outputDir, frameFileName);

        try {
            // Extrai frame com redimensionamento máx 640px de largura e compressão JPEG rápida
            const cmd = `ffmpeg -y -ss ${item.sec} -i "${videoPath}" -vframes 1 -vf "scale='min(640,iw)':-2" -q:v 3 "${framePath}"`;
            execSync(cmd, { stdio: 'pipe' });

            if (fs.existsSync(framePath) && fs.statSync(framePath).size > 0) {
                const base64 = fs.readFileSync(framePath).toString('base64');
                extractedFrames.push({
                    index: i + 1,
                    timestampSec: item.sec,
                    timestampLabel: item.label,
                    base64,
                    path: framePath
                });
            }
        } catch (frameErr) {
            console.warn(`⚠️ [Video Intelligence] Aviso ao extrair frame em ${item.sec}s:`, frameErr.message);
        }
    }

    return extractedFrames;
}

/**
 * Remove ficheiros temporários com segurança
 */
export function cleanupFiles(filePaths = []) {
    for (const fp of filePaths) {
        try {
            if (fp && fs.existsSync(fp)) {
                fs.unlinkSync(fp);
            }
        } catch {
            // Silencioso
        }
    }
}

/**
 * Analisa o vídeo multimodalmente (Frames Visuais + Transcrição Falada Whisper) com GPT-4o-mini
 */
export async function analyzeVideoMultimodal({
    videoPath,
    metadata,
    transcriptResult,
    keyframes,
    hookLibrary = [],
    notes = '',
    platform = 'Reel'
}) {
    if (!OPENAI_API_KEY) {
        throw new Error('Chave da OpenAI não configurada.');
    }

    const availableHooksText = Array.isArray(hookLibrary) && hookLibrary.length > 0
        ? hookLibrary.slice(0, 15).map((h, i) => `${i + 1}. [${h.category}] "${h.text}"`).join('\n')
        : 'Sugerir ganchos originais da Vamuss.';

    const transcriptSection = transcriptResult.hasSpeech
        ? `TRANSCRIÇÃO FALADA COMPLETA (Extraída via Whisper):
"${transcriptResult.fullText}"

PRIMEIRAS PALAVRAS FALADAS (0-3s):
"${transcriptResult.firstWords}"

SEGMENTOS TEMPORAIS:
${transcriptResult.segments.slice(0, 8).map(s => `[${s.start}s - ${s.end}s]: "${s.text}"`).join('\n')}`
        : `ÁUDIO DO VÍDEO:
Não foi detetada fala no vídeo (áudio puramente musical ou vídeo silencioso). A análise deve focar-se estritamente na linguagem visual, texto no ecrã e dinamismo das cenas.`;

    const visionContent = [];

    visionContent.push({
        type: 'text',
        text: `Tu és o Estrategista Audiovisual Sênior e Diretor Criativo da VAMUSS, agência de marketing de aquisição em Portugal.

ACABASTE DE RECEBER OS FOTOGRAMAS REAIS EXTRAÍDOS DE UM VÍDEO (${platform}, ${metadata.aspectRatio}, ${metadata.duration.toFixed(1)} segundos) JUNTAMENTE COM A TRANSCRIÇÃO DE ÁUDIO EXATA.

DADOS DO VÍDEO:
- Duração: ${metadata.duration.toFixed(1)}s
- Formato visual: ${metadata.aspectRatio}
- Fotogramas extraídos: ${keyframes.length} frames com timestamps
${notes ? `- Notas do utilizador: "${notes}"` : ''}

${transcriptSection}

BIBLIOTECA DE GANCHOS VAMUSS DISPONÍVEL:
${availableHooksText}

INSTRUÇÕES DE ANÁLISE RIGOROSA:
1. ABERTURA E GANCHO (0-3s):
   - Cruza o que vês no Frame 1 (0.2s) e Frame 2 (1.5s) com as primeiras palavras faladas.
   - Identifica o texto sobreposto no ecrã, a expressão facial do criador e o contraste visual.
   - Como é gerada a tensão ou curiosidade nos primeiros 3 segundos?
2. CONTEÚDO FALADO E ESTRUTURA NARRATIVA:
   - Qual a ideia central, argumentos, quebras de crença e CTA?
3. LINGUAGEM VISUAL E ENQUADRAMENTO:
   - Enquadramento (plano médio, close-up, tela gravada), cenário, iluminação, elementos visuais.
4. EDIÇÃO E RETENÇÃO:
   - Ritmo entre cortes, frequência de mudança de cena, elementos de retenção.
5. PRINCÍPIOS TRANSFERÍVEIS:
   - 3 princípios criativos acionáveis observados neste vídeo.
6. PROPOSTAS DE CONTEÚDO ORIGINAIS PARA A VAMUSS:
   - Desenvolve 2 ou 3 propostas originais adaptadas para empresários e donos de clínicas em Portugal.
   - REQUISITO ABSOLUTO: Todas as propostas DEVEM conter estritamente as 4 colunas editoriais oficiais:
     • Ângulo (ex: Erro Comum, Contradição, Problema Oculto)
     • Ideia melhorada (o conceito lapidado para a Vamuss)
     • Gancho / Base (a frase de abertura verbal)
     • Retenção / Hook (o mecanismo que mantém a atenção nos segundos seguintes)

Retorna a resposta EXCLUSIVAMENTE em formato JSON com a seguinte estrutura:`
    });

    // Inserir os fotogramas reais com etiquetas de tempo
    for (const frame of keyframes) {
        visionContent.push({
            type: 'text',
            text: `[FOTOGRAMA ${frame.index} - TEMPO: ${frame.timestampLabel}]:`
        });
        visionContent.push({
            type: 'image_url',
            image_url: {
                url: `data:image/jpeg;base64,${frame.base64}`,
                detail: 'low'
            }
        });
    }

    visionContent.push({
        type: 'text',
        text: `ESQUEMA DO JSON DE RETORNO:
{
  "analise": {
    "verbalHook": {
      "phrase": "Primeiras palavras ou gancho verbal identificado",
      "promise": "Promessa ou curiosidade gerada",
      "curiosityType": "Tipo de curiosidade (ex: Revelação, Erro, Estatística)",
      "tension": "Nível de tensão inicial",
      "approachType": "Direto / Pergunta / Confronto",
      "relationToContent": "Relação com o tema"
    },
    "visualHook": {
      "initialScene": "Descrição detalhada do que se vê no frame 0.2s e 1.5s",
      "framing": "Enquadramento (ex: Plano médio vertical 9:16)",
      "bodyLanguage": "Expressão e postura do criador",
      "visualMovement": "Movimento de câmera ou corte rápido",
      "onScreenText": "Texto exato que aparece no ecrã nos primeiros 3s",
      "visualContrast": "Contraste de cores ou transição"
    },
    "narrativeStructure": {
      "beginning": "Como o vídeo abre",
      "development": "Desenvolvimento do argumento",
      "progression": "Como a história avança",
      "evidenceAndProofs": "Provas ou telas mostradas",
      "retentionMechanism": "Como mantém a atenção",
      "resolution": "Desfecho",
      "cta": "Chamada para ação identificada"
    },
    "editingAndPacing": {
      "duration": "${metadata.duration.toFixed(1)} segundos",
      "scenePacing": "Ritmo das cenas (rápido / moderado / lento)",
      "cutsAndTransitions": "Tipos de cortes observados",
      "captionsAndGraphics": "Legendas dinâmicas e elementos gráficos",
      "attentionRenewers": "Elementos que renovam a atenção"
    },
    "performanceAndHypotheses": {
      "observations": "Fatos reais observados no áudio e nos fotogramas do vídeo",
      "strategicHypotheses": "Hipótese de por que este formato retém atenção",
      "limitations": "Limitações da análise (amostragem de frames ou áudio)"
    },
    "transferablePrinciples": [
      "Princípio 1...",
      "Princípio 2...",
      "Princípio 3..."
    ]
  },
  "propostas": [
    {
      "titulo": "Título da proposta",
      "formato": "Reel",
      "angulo": "Ângulo Estratégico",
      "ideia_melhorada": "Ideia central adaptada para a Vamuss",
      "gancho_base": "Gancho verbal inicial",
      "retencao_hook": "Mecanismo de retenção visual e verbal",
      "objetivo": "Objetivo comercial",
      "publico_alvo": "Donos de empresas e clínicas em Portugal",
      "gancho_verbal": "Frase de abertura",
      "gancho_visual": "O que Phil/Vamuss deve mostrar nos primeiros 3 segundos",
      "roteiro_slides": "Roteiro detalhado: 1. Gancho (0-3s)... 2. Desenvolvimento... 3. Prova... 4. CTA...",
      "sugestoes_cenas": "Cenas recomendadas",
      "sugestoes_enquadramento": "Enquadramento recomendado",
      "sugestoes_edicao": "Instruções de cortes e legendas",
      "texto_tela": "Texto principal no ecrã",
      "cta": "CTA direto",
      "justificativa_estrategica": "Por que esta adaptação funciona",
      "limitacoes_hipoteses": "O que testar",
      "ganchos_utilizados": ["..."]
    }
  ]
}`
    });

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.7,
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'user',
                    content: visionContent
                }
            ]
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Falha no modelo de visão OpenAI: ${errText}`);
    }

    const resData = await response.json();
    const contentText = resData.choices?.[0]?.message?.content;
    const parsed = JSON.parse(contentText);

    return parsed;
}
