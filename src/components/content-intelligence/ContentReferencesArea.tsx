import React, { useState, useEffect, useRef } from 'react';
import { ContentReference, ContentProposal, ProposalApprovalStatus } from '@/types/contentIntelligence';
import { contentIntelligenceService } from '@/services/contentIntelligenceService';
import { EditorialGridTable } from './EditorialGridTable';
import { ProposalDetailModal } from './ProposalDetailModal';
import { 
    Film, Link as LinkIcon, Loader2, AlertCircle, 
    ChevronRight, Sparkles, Trash2, Upload, Smartphone,
    Volume2, Eye, Clock, FileVideo, CheckCircle2, ChevronDown
} from 'lucide-react';

interface ContentReferencesAreaProps {
    userId?: string;
    onGoToKanban?: () => void;
}

export function ContentReferencesArea({ userId, onGoToKanban }: ContentReferencesAreaProps) {
    const [references, setReferences] = useState<ContentReference[]>([]);
    const [selectedRefId, setSelectedRefId] = useState<string | null>(null);
    const [_isLoading, setIsLoading] = useState(true);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    // Métodos de Entrada: 'url' | 'upload' | 'screen_record' (URL é o método padrão prioritário)
    const [inputMethod, setInputMethod] = useState<'url' | 'upload' | 'screen_record'>('url');

    // Form inputs
    const [url, setUrl] = useState('');
    const [platform, setPlatform] = useState('instagram');
    const [notes, setNotes] = useState('');
    const [transcript, setTranscript] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    // Inputs para reanálise in-place
    const [activeRefNotesInput, setActiveRefNotesInput] = useState('');
    const [isActiveRefUploading, setIsActiveRefUploading] = useState(false);
    const [showTranscriptFull, setShowTranscriptFull] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const activeRefFileInputRef = useRef<HTMLInputElement>(null);

    // Modal de detalhes da proposta
    const [selectedProposal, setSelectedProposal] = useState<ContentProposal | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const list = await contentIntelligenceService.loadReferences(userId);
            setReferences(list);
            if (list.length > 0 && !selectedRefId) {
                setSelectedRefId(list[0].id);
            }
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [userId]);

    const activeRef = references.find(r => r.id === selectedRefId) || references[0] || null;

    const handleFileSelect = (file: File) => {
        if (!file) return;
        const validExtensions = ['mp4', 'mov', 'webm', 'm4v'];
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!validExtensions.includes(ext)) {
            setErrorMsg('Formato de vídeo não suportado. Por favor, utiliza MP4, MOV ou WebM.');
            return;
        }
        if (file.size > 100 * 1024 * 1024) {
            setErrorMsg('O arquivo excede o limite máximo de 100MB.');
            return;
        }
        setErrorMsg(null);
        setSelectedFile(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    };

    const handleSubmitReference = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg(null);

        // Validação de entrada conforme método
        if (inputMethod === 'url' && !url.trim() && !notes.trim()) {
            setErrorMsg('Por favor, insere o URL do Reel.');
            return;
        }
        if ((inputMethod === 'upload' || inputMethod === 'screen_record') && !selectedFile && !url.trim() && !notes.trim()) {
            setErrorMsg('Por favor, seleciona o ficheiro de vídeo para carregar.');
            return;
        }

        setIsAnalyzing(true);
        let uploadedVideoUrl = '';
        let fileName = selectedFile?.name || '';
        let fileSize = selectedFile?.size || 0;
        let fileFormat = selectedFile?.name.split('.').pop()?.toLowerCase() || '';

        try {
            // 1. Se houver ficheiro de vídeo, fazer upload por streaming para o backend
            if (selectedFile) {
                setIsUploading(true);
                const uploadRes = await contentIntelligenceService.uploadVideoFile(selectedFile);
                uploadedVideoUrl = uploadRes.videoFileUrl;
                fileName = uploadRes.fileName;
                fileSize = uploadRes.fileSize;
                fileFormat = uploadRes.fileFormat;
                setIsUploading(false);
            }

            // 2. Guardar referência inicial com status adequado ao método
            const initialStatus = (inputMethod === 'url' && url.trim()) ? 'recuperando_video' : 'processando';
            const newRef: ContentReference = await contentIntelligenceService.saveReference({
                url: url.trim(),
                platform,
                notes: notes.trim(),
                videoFileUrl: uploadedVideoUrl,
                fileName,
                fileSize,
                fileFormat,
                transcript: transcript.trim(),
                hasAccessibleMedia: Boolean(uploadedVideoUrl),
                status: initialStatus
            }, userId);

            setSelectedRefId(newRef.id);
            setReferences(prev => [newRef, ...prev.filter(r => r.id !== newRef.id)]);

            // 3. Carregar ganchos disponíveis
            const hooks = await contentIntelligenceService.loadHooks(userId);

            // 4. Chamar motor de IA (Audiovisual se houver vídeo; Conceitual se houver notas; Recuperação automática se for URL)
            const response = await fetch('/api/content-intelligence/analyze-reference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: newRef.url,
                    platform: newRef.platform,
                    notes: newRef.notes,
                    transcript: newRef.transcript,
                    videoFileUrl: uploadedVideoUrl,
                    hookLibrary: hooks.map(h => ({ text: h.text, category: h.category }))
                })
            });

            let resJson: any = null;
            try {
                const text = await response.text();
                resJson = text ? JSON.parse(text) : {};
            } catch (jsonErr) {
                console.warn('Erro ao processar JSON da referência:', jsonErr);
            }

            // 5. Tratamento de falhas de recuperação ou análise
            if (!response.ok || resJson?.statusType === 'erro_recuperacao' || resJson?.statusType === 'erro_analise') {
                newRef.status = resJson?.statusType || 'erro_recuperacao';
                newRef.errorMessage = resJson?.error || `Erro de resposta (${response.status}).`;
                newRef.setupGuide = resJson?.setupGuide;
                await contentIntelligenceService.saveReference(newRef, userId);
                await loadData();
                return;
            }

            // 6. Se o URL for inacessível e não tiver vídeo nem notas
            if (resJson?.status === 'requer_material' || resJson?.statusType === 'requer_material') {
                newRef.status = 'requer_material';
                newRef.errorMessage = resJson.message;
                await contentIntelligenceService.saveReference(newRef, userId);
                await loadData();
                return;
            }

            // 7. Análise audiovisual concluída com sucesso
            const analysisData = resJson.data?.analise;
            const rawProposals = resJson.data?.propostas || [];

            newRef.status = 'concluido';
            newRef.errorMessage = undefined;
            newRef.setupGuide = undefined;
            newRef.analysis = analysisData;

            // Salvar propostas nas 4 colunas oficiais
            const savedProposals: ContentProposal[] = [];
            for (const p of rawProposals) {
                const saved = await contentIntelligenceService.saveProposal({
                    referenceId: newRef.id,
                    angulo: p.angulo || 'Ângulo Audiovisual',
                    ideiaMelhorada: p.ideia_melhorada || 'Adaptação Vamuss',
                    ganchoBase: p.gancho_base || '',
                    retencaoHook: p.retencao_hook || '',
                    titulo: p.titulo || 'Adaptação Original',
                    formato: p.formato || 'Reel',
                    objetivo: p.objetivo || '',
                    publicoAlvo: p.publico_alvo || 'Empresários em Portugal',
                    ganchoVerbal: p.gancho_verbal || p.gancho_base,
                    ganchoVisual: p.gancho_visual || '',
                    roteiroSlides: p.roteiro_slides || '',
                    sugestoesCenas: p.sugestoes_cenas || '',
                    sugestoesEnquadramento: p.sugestoes_enquadramento || '',
                    sugestoesEdicao: p.sugestoes_edicao || '',
                    textoTela: p.texto_tela || '',
                    cta: p.cta || '',
                    justificativaEstrategica: p.justificativa_estrategica || '',
                    limitacoesHipoteses: p.limitacoes_hipoteses || '',
                    ganchosUtilizados: p.ganchos_utilizados || [],
                    statusAprovacao: 'rascunho'
                }, userId);
                savedProposals.push(saved);
            }

            newRef.proposals = savedProposals;
            await contentIntelligenceService.saveReference(newRef, userId);

            // Limpar formulário de entrada
            setUrl('');
            setNotes('');
            setTranscript('');
            setSelectedFile(null);
            await loadData();
        } catch (err: any) {
            console.error('Erro ao processar referência:', err);
            setErrorMsg(err.message || 'Falha na análise audiovisual.');
            await loadData();
        } finally {
            setIsAnalyzing(false);
            setIsUploading(false);
        }
    };

    // Re-tentar recuperação de vídeo por URL na mesma referência (sem duplicar cartões)
    const handleRetryUrlRetrieval = async (refId: string) => {
        const targetRef = references.find(r => r.id === refId);
        if (!targetRef || !targetRef.url) return;

        setErrorMsg(null);
        setIsAnalyzing(true);

        try {
            targetRef.status = 'recuperando_video';
            targetRef.errorMessage = undefined;
            await contentIntelligenceService.saveReference(targetRef, userId);
            await loadData();

            const hooks = await contentIntelligenceService.loadHooks(userId);
            const response = await fetch('/api/content-intelligence/analyze-reference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetRef.url,
                    platform: targetRef.platform,
                    notes: targetRef.notes,
                    transcript: targetRef.transcript,
                    videoFileUrl: targetRef.videoFileUrl,
                    hookLibrary: hooks.map(h => ({ text: h.text, category: h.category }))
                })
            });

            let resJson: any = null;
            try {
                const text = await response.text();
                resJson = text ? JSON.parse(text) : {};
            } catch (jsonErr) {
                console.warn('Erro ao processar JSON da reanálise:', jsonErr);
            }

            if (!response.ok || resJson?.statusType === 'erro_recuperacao' || resJson?.statusType === 'erro_analise') {
                targetRef.status = resJson?.statusType || 'erro_recuperacao';
                targetRef.errorMessage = resJson?.error || `Falha na recuperação (${response.status}).`;
                targetRef.setupGuide = resJson?.setupGuide;
                await contentIntelligenceService.saveReference(targetRef, userId);
                await loadData();
                return;
            }

            const analysisData = resJson.data?.analise;
            const rawProposals = resJson.data?.propostas || [];

            targetRef.status = 'concluido';
            targetRef.errorMessage = undefined;
            targetRef.setupGuide = undefined;
            targetRef.analysis = analysisData;

            // Salvar propostas nas 4 colunas oficiais
            const savedProposals: ContentProposal[] = [];
            for (const p of rawProposals) {
                const saved = await contentIntelligenceService.saveProposal({
                    referenceId: targetRef.id,
                    angulo: p.angulo || 'Ângulo Audiovisual',
                    ideiaMelhorada: p.ideia_melhorada || 'Adaptação Vamuss',
                    ganchoBase: p.gancho_base || '',
                    retencaoHook: p.retencao_hook || '',
                    titulo: p.titulo || 'Adaptação Original',
                    formato: p.formato || 'Reel',
                    objetivo: p.objetivo || '',
                    publicoAlvo: p.publico_alvo || 'Empresários em Portugal',
                    ganchoVerbal: p.gancho_verbal || p.gancho_base,
                    ganchoVisual: p.gancho_visual || '',
                    roteiroSlides: p.roteiro_slides || '',
                    sugestoesCenas: p.sugestoes_cenas || '',
                    sugestoesEnquadramento: p.sugestoes_enquadramento || '',
                    sugestoesEdicao: p.sugestoes_edicao || '',
                    textoTela: p.texto_tela || '',
                    cta: p.cta || '',
                    justificativaEstrategica: p.justificativa_estrategica || '',
                    limitacoesHipoteses: p.limitacoes_hipoteses || '',
                    ganchosUtilizados: p.ganchos_utilizados || [],
                    statusAprovacao: 'rascunho'
                }, userId);
                savedProposals.push(saved);
            }

            targetRef.proposals = savedProposals;
            await contentIntelligenceService.saveReference(targetRef, userId);
            await loadData();
        } catch (err: any) {
            console.error('Erro ao reprocessar referência por URL:', err);
            targetRef.status = 'erro_recuperacao';
            targetRef.errorMessage = err.message || 'Falha ao recuperar vídeo.';
            await contentIntelligenceService.saveReference(targetRef, userId);
            setErrorMsg(err.message);
            await loadData();
        } finally {
            setIsAnalyzing(false);
        }
    };

    // Reanalisar referência carregando vídeo diretamente para ela (evita duplicar referências)
    const handleUploadVideoForExistingRef = async (refId: string, file: File) => {
        const targetRef = references.find(r => r.id === refId);
        if (!targetRef || !file) return;

        setErrorMsg(null);
        setIsActiveRefUploading(true);
        setIsAnalyzing(true);

        try {
            // Upload do ficheiro
            const uploadRes = await contentIntelligenceService.uploadVideoFile(file);
            targetRef.videoFileUrl = uploadRes.videoFileUrl;
            targetRef.fileName = uploadRes.fileName;
            targetRef.fileSize = uploadRes.fileSize;
            targetRef.fileFormat = uploadRes.fileFormat;
            targetRef.hasAccessibleMedia = true;
            targetRef.status = 'processando';
            await contentIntelligenceService.saveReference(targetRef, userId);
            await loadData();

            // Chamar análise com o novo vídeo
            const hooks = await contentIntelligenceService.loadHooks(userId);
            const response = await fetch('/api/content-intelligence/analyze-reference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetRef.url,
                    platform: targetRef.platform,
                    notes: targetRef.notes,
                    videoFileUrl: uploadRes.videoFileUrl,
                    hookLibrary: hooks.map(h => ({ text: h.text, category: h.category }))
                })
            });

            let resJson: any = null;
            try {
                const text = await response.text();
                resJson = text ? JSON.parse(text) : {};
            } catch (jsonErr) {
                console.warn('Erro ao processar JSON da reanálise:', jsonErr);
            }

            if (!response.ok) {
                throw new Error(resJson?.error || `Erro do servidor (${response.status}).`);
            }

            const analysisData = resJson.data?.analise;
            const rawProposals = resJson.data?.propostas || [];

            targetRef.status = 'concluido';
            targetRef.errorMessage = undefined;
            targetRef.analysis = analysisData;

            const savedProposals: ContentProposal[] = [];
            for (const p of rawProposals) {
                const saved = await contentIntelligenceService.saveProposal({
                    referenceId: targetRef.id,
                    angulo: p.angulo || 'Adaptação Audiovisual',
                    ideiaMelhorada: p.ideia_melhorada || 'Adaptação Vamuss',
                    ganchoBase: p.gancho_base || '',
                    retencaoHook: p.retencao_hook || '',
                    titulo: p.titulo || 'Adaptação Original',
                    formato: p.formato || 'Reel',
                    objetivo: p.objetivo || '',
                    publicoAlvo: p.publico_alvo || 'Empresários em Portugal',
                    ganchoVerbal: p.gancho_verbal || p.gancho_base,
                    ganchoVisual: p.gancho_visual || '',
                    roteiroSlides: p.roteiro_slides || '',
                    sugestoesCenas: p.sugestoes_cenas || '',
                    sugestoesEnquadramento: p.sugestoes_enquadramento || '',
                    sugestoesEdicao: p.sugestoes_edicao || '',
                    textoTela: p.texto_tela || '',
                    cta: p.cta || '',
                    justificativaEstrategica: p.justificativa_estrategica || '',
                    limitacoesHipoteses: p.limitacoes_hipoteses || '',
                    ganchosUtilizados: p.ganchos_utilizados || [],
                    statusAprovacao: 'rascunho'
                }, userId);
                savedProposals.push(saved);
            }

            targetRef.proposals = savedProposals;
            await contentIntelligenceService.saveReference(targetRef, userId);
            await loadData();
        } catch (err: any) {
            console.error('Erro ao reanalisar com vídeo:', err);
            targetRef.status = 'erro';
            targetRef.errorMessage = err.message || 'Falha ao processar o vídeo.';
            await contentIntelligenceService.saveReference(targetRef, userId);
            setErrorMsg(err.message);
            await loadData();
        } finally {
            setIsActiveRefUploading(false);
            setIsAnalyzing(false);
        }
    };

    // Reanalisar com notas
    const handleReanalyzeWithNotes = async (refId: string, additionalNotes: string) => {
        if (!additionalNotes.trim()) return;
        const targetRef = references.find(r => r.id === refId);
        if (!targetRef) return;

        setErrorMsg(null);
        setIsAnalyzing(true);

        try {
            targetRef.status = 'processando';
            targetRef.notes = additionalNotes.trim();
            await contentIntelligenceService.saveReference(targetRef, userId);
            await loadData();

            const hooks = await contentIntelligenceService.loadHooks(userId);
            const response = await fetch('/api/content-intelligence/analyze-reference', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: targetRef.url,
                    platform: targetRef.platform,
                    notes: targetRef.notes,
                    transcript: targetRef.transcript,
                    videoFileUrl: targetRef.videoFileUrl,
                    hookLibrary: hooks.map(h => ({ text: h.text, category: h.category }))
                })
            });

            let resJson: any = null;
            try {
                const text = await response.text();
                resJson = text ? JSON.parse(text) : {};
            } catch (jsonErr) {
                console.warn('Erro ao processar JSON da reanálise:', jsonErr);
            }

            if (!response.ok) {
                throw new Error(resJson?.error || `Erro do servidor (${response.status}).`);
            }

            const analysisData = resJson.data?.analise;
            const rawProposals = resJson.data?.propostas || [];

            targetRef.status = 'concluido';
            targetRef.errorMessage = undefined;
            targetRef.analysis = analysisData;

            const savedProposals: ContentProposal[] = [];
            for (const p of rawProposals) {
                const saved = await contentIntelligenceService.saveProposal({
                    referenceId: targetRef.id,
                    angulo: p.angulo || 'Adaptação Criativa',
                    ideiaMelhorada: p.ideia_melhorada || 'Adaptação Vamuss',
                    ganchoBase: p.gancho_base || '',
                    retencaoHook: p.retencao_hook || '',
                    titulo: p.titulo || 'Adaptação Original',
                    formato: p.formato || 'Reel',
                    objetivo: p.objetivo || '',
                    publicoAlvo: p.publico_alvo || 'Empresários em Portugal',
                    ganchoVerbal: p.gancho_verbal || p.gancho_base,
                    ganchoVisual: p.gancho_visual || '',
                    roteiroSlides: p.roteiro_slides || '',
                    sugestoesCenas: p.sugestoes_cenas || '',
                    sugestoesEnquadramento: p.sugestoes_enquadramento || '',
                    sugestoesEdicao: p.sugestoes_edicao || '',
                    textoTela: p.texto_tela || '',
                    cta: p.cta || '',
                    justificativaEstrategica: p.justificativa_estrategica || '',
                    limitacoesHipoteses: p.limitacoes_hipoteses || '',
                    ganchosUtilizados: p.ganchos_utilizados || [],
                    statusAprovacao: 'rascunho'
                }, userId);
                savedProposals.push(saved);
            }

            targetRef.proposals = savedProposals;
            await contentIntelligenceService.saveReference(targetRef, userId);
            setActiveRefNotesInput('');
            await loadData();
        } catch (err: any) {
            console.error('Erro ao reanalisar referência:', err);
            targetRef.status = 'erro';
            targetRef.errorMessage = err.message || 'Falha na reanálise.';
            await contentIntelligenceService.saveReference(targetRef, userId);
            setErrorMsg(err.message);
            await loadData();
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleDeleteReference = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('Eliminar esta referência e propostas associadas?')) return;
        await contentIntelligenceService.deleteReference(id, userId);
        if (selectedRefId === id) setSelectedRefId(null);
        loadData();
    };

    const handleSendProposalToKanban = async (proposalId: string) => {
        const res = await contentIntelligenceService.sendProposalToKanban(proposalId, userId);
        if (res.alreadyExisted) {
            alert('Esta proposta já está no Kanban de Produção.');
        } else {
            alert('✅ Proposta enviada com sucesso para a etapa de Ideias no Kanban!');
        }
        loadData();
    };

    const handleUpdateProposalStatus = async (proposalId: string, status: ProposalApprovalStatus) => {
        await contentIntelligenceService.updateProposalStatus(proposalId, status, userId);
        if (selectedProposal && selectedProposal.id === proposalId) {
            setSelectedProposal(prev => prev ? { ...prev, statusAprovacao: status } : null);
        }
        loadData();
    };

    const handleSaveProposal = async (updated: ContentProposal) => {
        await contentIntelligenceService.saveProposal(updated, userId);
        setSelectedProposal(updated);
        loadData();
    };

    return (
        <div className="flex flex-col lg:flex-row h-full w-full bg-background overflow-hidden">
            {/* Coluna Esquerda: Formulário de Entrada + Lista de Referências */}
            <div className="w-full lg:w-[440px] lg:border-r border-border/70 flex flex-col h-full bg-card/40 shrink-0 overflow-y-auto custom-scrollbar">
                <div className="p-4 sm:p-5 border-b border-border/60 space-y-3.5">
                    <div>
                        <h2 className="text-sm sm:text-base font-medium text-foreground flex items-center gap-2">
                            <Film size={16} className="text-primary" />
                            Área B: Reels & Análise Audiovisual
                        </h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5 font-normal">
                            Processa áudio, fotogramas e retenção de vídeos para gerar propostas Vamuss.
                        </p>
                    </div>

                    {/* Seletor dos 3 Métodos de Entrada (URL Prioritário) */}
                    <div className="grid grid-cols-3 gap-1 p-1 bg-muted/50 rounded-xl border border-border/50 text-[11px]">
                        <button
                            type="button"
                            onClick={() => setInputMethod('url')}
                            className={`py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                                inputMethod === 'url'
                                    ? 'bg-background text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <LinkIcon size={13} />
                            <span>URL do Reel</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setInputMethod('upload')}
                            className={`py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                                inputMethod === 'upload'
                                    ? 'bg-background text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Upload size={13} />
                            <span>Vídeo Real</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setInputMethod('screen_record')}
                            className={`py-1.5 px-2 rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 ${
                                inputMethod === 'screen_record'
                                    ? 'bg-background text-foreground shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            <Smartphone size={13} />
                            <span>Gravação Ecrã</span>
                        </button>
                    </div>

                    <form onSubmit={handleSubmitReference} className="space-y-3 text-xs">
                        {/* MÉTODO B: UPLOAD DE VÍDEO ORIGINAL */}
                        {inputMethod === 'upload' && (
                            <div className="space-y-2">
                                <label className="text-[10.5px] font-medium text-muted-foreground uppercase flex items-center justify-between">
                                    <span>Arquivo de Vídeo (.mp4, .mov, .webm)</span>
                                    <span className="text-[10px] text-primary lowercase font-normal">Prioritário & Mais Fiável</span>
                                </label>
                                <div
                                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                                        isDragging 
                                            ? 'border-primary bg-primary/10' 
                                            : selectedFile 
                                                ? 'border-emerald-500/50 bg-emerald-500/5' 
                                                : 'border-border/80 hover:border-primary/50 bg-background/50 hover:bg-muted/30'
                                    }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="video/mp4,video/quicktime,video/webm,video/x-m4v"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                    />
                                    {selectedFile ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-center gap-2 text-emerald-500 font-medium text-xs">
                                                <CheckCircle2 size={16} />
                                                <span className="truncate max-w-[260px]">{selectedFile.name}</span>
                                            </div>
                                            <p className="text-[10.5px] text-muted-foreground">
                                                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {selectedFile.type || 'Vídeo'} (Pronto para envio)
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <FileVideo size={24} className="text-muted-foreground/60" />
                                            <p className="font-medium text-foreground text-xs">
                                                Arrasta o Reel aqui ou clica para selecionar
                                            </p>
                                            <p className="text-[10.5px] text-muted-foreground">
                                                MP4, MOV até 100MB • Analisa áudio real e fotogramas
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* MÉTODO C: GRAVAÇÃO DO ECRÃ */}
                        {inputMethod === 'screen_record' && (
                            <div className="space-y-2">
                                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[11px] space-y-1 text-muted-foreground">
                                    <strong className="text-foreground flex items-center gap-1.5">
                                        <Smartphone size={13} className="text-blue-500" />
                                        Como usar uma gravação de ecrã:
                                    </strong>
                                    <p className="leading-relaxed">
                                        1. Grava o ecrã do telemóvel enquanto o Reel reproduz no Instagram (com som ativado).
                                    </p>
                                    <p className="leading-relaxed">
                                        2. Envia o vídeo gravado abaixo. A IA transcreverá o que é dito e analisará os fotogramas reais.
                                    </p>
                                </div>

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                                        selectedFile 
                                            ? 'border-emerald-500/50 bg-emerald-500/5' 
                                            : 'border-border/80 hover:border-primary/50 bg-background/50 hover:bg-muted/30'
                                    }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="video/mp4,video/quicktime,video/webm"
                                        className="hidden"
                                        onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                    />
                                    {selectedFile ? (
                                        <div className="space-y-1">
                                            <div className="flex items-center justify-center gap-2 text-emerald-500 font-medium text-xs">
                                                <CheckCircle2 size={16} />
                                                <span className="truncate max-w-[260px]">{selectedFile.name}</span>
                                            </div>
                                            <p className="text-[10.5px] text-muted-foreground">
                                                {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • Gravação pronta
                                            </p>
                                        </div>
                                    ) : (
                                        <>
                                            <Smartphone size={24} className="text-muted-foreground/60" />
                                            <p className="font-medium text-foreground text-xs">
                                                Carrega a gravação do ecrã do telemóvel
                                            </p>
                                            <p className="text-[10.5px] text-muted-foreground">
                                                Suporta ficheiros de gravação do iOS e Android
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* MÉTODO A: URL DO REEL */}
                        {inputMethod === 'url' && (
                            <div className="space-y-2">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10.5px] font-medium text-muted-foreground uppercase flex items-center justify-between">
                                        <span>URL do Reel (Instagram / TikTok / Shorts)</span>
                                    </label>
                                    <input
                                        type="url"
                                        placeholder="https://www.instagram.com/reel/..."
                                        value={url}
                                        onChange={e => setUrl(e.target.value)}
                                        className="p-2.5 bg-background border border-border rounded-xl text-xs font-normal outline-none focus:border-primary"
                                    />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10.5px] font-medium text-muted-foreground uppercase">
                                        Plataforma
                                    </label>
                                    <select
                                        value={platform}
                                        onChange={e => setPlatform(e.target.value)}
                                        className="p-2 bg-background border border-border rounded-lg text-xs font-normal outline-none"
                                    >
                                        <option value="instagram">Instagram Reel</option>
                                        <option value="tiktok">TikTok</option>
                                        <option value="youtube">YouTube Shorts</option>
                                        <option value="outro">Outro</option>
                                    </select>
                                </div>
                                <span className="text-[10px] text-muted-foreground/80 block">
                                    Nota: As plataformas bloqueiam o download direto sem login. Se o vídeo for bloqueado, podes enviar o arquivo ou a gravação.
                                </span>
                            </div>
                        )}

                        {/* Notas e Contexto Opcional */}
                        <div className="flex flex-col gap-1">
                            <label className="text-[10.5px] font-medium text-muted-foreground uppercase">
                                Observações ou Foco Desejado (Opcional)
                            </label>
                            <input
                                type="text"
                                placeholder="Ex: Focar no gancho inicial dos primeiros 3 segundos..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                className="p-2 bg-background border border-border rounded-lg text-xs font-normal outline-none"
                            />
                        </div>

                        {errorMsg && (
                            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[11px] flex items-center gap-2 font-normal">
                                <AlertCircle size={14} className="shrink-0" />
                                <span>{errorMsg}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isAnalyzing || isUploading}
                            className="w-full h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition-all disabled:opacity-50"
                        >
                            {isUploading ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>A enviar ficheiro de vídeo...</span>
                                </>
                            ) : isAnalyzing ? (
                                <>
                                    <Loader2 size={14} className="animate-spin" />
                                    <span>{inputMethod === 'url' ? 'A recuperar Reel e a analisar audiovisual...' : 'A extrair áudio, fotogramas e analisar...'}</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles size={14} />
                                    <span>{inputMethod === 'url' ? 'Analisar Reel por URL' : 'Analisar Conteúdo e Adaptar'}</span>
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Lista de Referências Guardadas */}
                <div className="p-4 space-y-2 flex-1">
                    <span className="text-[10.5px] uppercase font-medium text-muted-foreground tracking-wider block">
                        Referências Guardadas ({references.length})
                    </span>

                    {references.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-6 text-center font-normal">
                            Nenhuma referência submetida ainda. Carrega um vídeo acima para começar.
                        </p>
                    ) : (
                        <div className="space-y-1.5">
                            {references.map(item => {
                                const isSelected = item.id === activeRef?.id;
                                const propCount = item.proposals?.length || 0;
                                const isVideo = Boolean(item.videoFileUrl);

                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => setSelectedRefId(item.id)}
                                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 ${
                                            isSelected 
                                                ? 'bg-primary/10 border-primary/40 text-foreground' 
                                                : 'bg-card hover:bg-muted/40 border-border/60 text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="line-clamp-1 font-medium text-foreground leading-snug flex items-center gap-1.5">
                                                {isVideo ? (
                                                    <FileVideo size={13} className="text-primary shrink-0" />
                                                ) : (
                                                    <LinkIcon size={13} className="text-muted-foreground shrink-0" />
                                                )}
                                                <span className="truncate">{item.fileName || item.url || item.notes || 'Referência'}</span>
                                            </p>
                                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                                {isVideo ? (
                                                    <span className="text-primary font-medium">Vídeo Real</span>
                                                ) : (
                                                    <span className="uppercase">{item.platform}</span>
                                                )}
                                                <span>•</span>
                                                <span>{propCount} {propCount === 1 ? 'proposta' : 'propostas'}</span>
                                                <span>•</span>
                                                <span className={`capitalize ${
                                                    item.status === 'concluido' ? 'text-emerald-500 font-medium' :
                                                    item.status === 'requer_material' ? 'text-amber-500 font-medium' :
                                                    item.status === 'processando' ? 'text-blue-500 font-medium animate-pulse' :
                                                    item.status === 'recuperando_video' ? 'text-blue-500 font-medium animate-pulse' :
                                                    item.status === 'video_recuperado' ? 'text-blue-500 font-medium' :
                                                    item.status === 'analisando_audiovisual' ? 'text-amber-500 font-medium animate-pulse' :
                                                    item.status === 'gerando_propostas' ? 'text-purple-500 font-medium animate-pulse' :
                                                    item.status === 'erro_recuperacao' ? 'text-destructive font-medium' :
                                                    item.status === 'erro_analise' ? 'text-destructive font-medium' :
                                                    item.status === 'erro' ? 'text-destructive' : ''
                                                }`}>
                                                    {item.status === 'requer_material' ? 'Requer Vídeo' :
                                                     item.status === 'recuperando_video' ? 'A recuperar vídeo...' :
                                                     item.status === 'video_recuperado' ? 'Vídeo recuperado' :
                                                     item.status === 'analisando_audiovisual' ? 'A analisar...' :
                                                     item.status === 'gerando_propostas' ? 'A gerar propostas...' :
                                                     item.status === 'erro_recuperacao' ? 'Erro na recuperação' :
                                                     item.status === 'erro_analise' ? 'Erro na análise' :
                                                     item.status}
                                                </span>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteReference(item.id, e)}
                                            className="p-1 hover:text-destructive opacity-40 hover:opacity-100 transition-opacity"
                                            title="Eliminar referência"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Coluna Direita: Detalhes Audiovisuais e Grelha Oficial das 4 Colunas */}
            <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-5 space-y-4">
                {activeRef ? (
                    <>
                        <div className="flex items-center justify-between gap-3 shrink-0 pb-2 border-b border-border/50">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase font-medium text-primary tracking-wider">
                                        Referência Selecionada
                                    </span>
                                    {/* Badge da Origem da Análise */}
                                    {activeRef.analysis?.analysisSource === 'video_audiovisual' && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium text-[10px] flex items-center gap-1 border border-emerald-500/20">
                                            <Film size={11} />
                                            <span>Análise Audiovisual Real (Vídeo + Áudio)</span>
                                        </span>
                                    )}
                                    {activeRef.analysis?.analysisSource === 'video_visual_only' && (
                                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 font-medium text-[10px] flex items-center gap-1 border border-blue-500/20">
                                            <Eye size={11} />
                                            <span>Análise Visual Real (Vídeo sem fala)</span>
                                        </span>
                                    )}
                                    {activeRef.analysis?.analysisSource === 'notes_only' && (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-medium text-[10px] flex items-center gap-1 border border-amber-500/20">
                                            <span>Análise Conceitual (Apenas Notas)</span>
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-sm font-medium text-foreground truncate mt-0.5">
                                    {activeRef.fileName ? (
                                        <span className="flex items-center gap-1.5">
                                            <FileVideo size={14} className="text-primary" />
                                            {activeRef.fileName}
                                        </span>
                                    ) : activeRef.url ? (
                                        <a href={activeRef.url} target="_blank" rel="noreferrer" className="hover:underline flex items-center gap-1">
                                            <LinkIcon size={12} />
                                            {activeRef.url}
                                        </a>
                                    ) : (
                                        activeRef.notes || 'Referência de Conteúdo'
                                    )}
                                </h3>
                            </div>

                            {onGoToKanban && (
                                <button
                                    type="button"
                                    onClick={onGoToKanban}
                                    className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors flex items-center gap-1 shrink-0"
                                >
                                    <span>Ver no Kanban</span>
                                    <ChevronRight size={13} />
                                </button>
                            )}
                        </div>

                        {/* Aviso Quando Requer Material Adicional com Upload Direto */}
                        {activeRef.status === 'requer_material' && (
                            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 space-y-3 text-xs">
                                <div className="flex items-center gap-2 font-medium text-amber-600">
                                    <AlertCircle size={15} />
                                    <span>Material Audiovisual Necessário para Análise Completa</span>
                                </div>
                                <p className="text-muted-foreground font-normal leading-relaxed">
                                    {activeRef.errorMessage || 'Como as plataformas de terceiros bloqueiam o download direto via URL sem autenticação, carrega o arquivo de vídeo original ou a gravação de ecrã para permitir a análise audiovisual real.'}
                                </p>

                                <div className="pt-2 border-t border-amber-500/20 grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {/* Opção 1: Upload direto de vídeo para esta referência */}
                                    <div className="space-y-1.5 p-3 rounded-lg bg-background/50 border border-border/60">
                                        <strong className="block text-foreground text-[11px] font-medium">
                                            Opção 1: Carregar Vídeo ou Gravação de Ecrã
                                        </strong>
                                        <input
                                            ref={activeRefFileInputRef}
                                            type="file"
                                            accept="video/mp4,video/quicktime,video/webm"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) {
                                                    handleUploadVideoForExistingRef(activeRef.id, e.target.files[0]);
                                                }
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => activeRefFileInputRef.current?.click()}
                                            disabled={isActiveRefUploading || isAnalyzing}
                                            className="w-full py-2 px-3 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                                        >
                                            {isActiveRefUploading ? (
                                                <>
                                                    <Loader2 size={13} className="animate-spin" />
                                                    <span>A enviar e analisar vídeo...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Upload size={13} />
                                                    <span>Carregar Ficheiro de Vídeo</span>
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    {/* Opção 2: Adicionar notas para análise textual */}
                                    <div className="space-y-1.5 p-3 rounded-lg bg-background/50 border border-border/60">
                                        <strong className="block text-foreground text-[11px] font-medium">
                                            Opção 2: Descrever com Notas
                                        </strong>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                placeholder="O que o criador fala ou mostra no vídeo..."
                                                value={activeRefNotesInput}
                                                onChange={(e) => setActiveRefNotesInput(e.target.value)}
                                                className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground outline-none"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => handleReanalyzeWithNotes(activeRef.id, activeRefNotesInput)}
                                                disabled={isAnalyzing || !activeRefNotesInput.trim()}
                                                className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-xs transition-colors shrink-0 disabled:opacity-50"
                                            >
                                                Analisar Notas
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Card de Progresso em Tempo Real */}
                        {(activeRef.status === 'recuperando_video' || activeRef.status === 'processando' || activeRef.status === 'analisando_audiovisual' || activeRef.status === 'gerando_propostas') && (
                            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/25 space-y-2 text-xs animate-pulse">
                                <div className="flex items-center gap-2 font-medium text-blue-600">
                                    <Loader2 size={16} className="animate-spin shrink-0" />
                                    <span>
                                        {activeRef.status === 'recuperando_video' ? 'A recuperar vídeo original a partir do Instagram...' :
                                         activeRef.status === 'analisando_audiovisual' ? 'A extrair áudio e a transcrever com Whisper...' :
                                         activeRef.status === 'gerando_propostas' ? 'A analisar fotogramas com Visão e a gerar propostas Vamuss...' :
                                         'A processar material...'}
                                    </span>
                                </div>
                                <p className="text-muted-foreground font-normal leading-relaxed text-[11.5px]">
                                    A recuperação e análise decorrem em segundo plano. Não feches esta página.
                                </p>
                            </div>
                        )}

                        {/* Aviso e Guia Quando Ocorreu Erro ou Requer Configuração */}
                        {(activeRef.status === 'erro' || activeRef.status === 'erro_recuperacao' || activeRef.status === 'erro_analise') && (
                            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/25 space-y-3 text-xs">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 font-medium text-destructive">
                                        <AlertCircle size={16} className="shrink-0" />
                                        <span>
                                            {activeRef.status === 'erro_recuperacao' ? 'Falha na Recuperação Automática do Vídeo' :
                                             activeRef.status === 'erro_analise' ? 'Falha no Processamento Audiovisual' :
                                             'Ocorreu um erro no processamento'}
                                        </span>
                                    </div>
                                    {activeRef.url && (
                                        <button
                                            type="button"
                                            onClick={() => handleRetryUrlRetrieval(activeRef.id)}
                                            disabled={isAnalyzing}
                                            className="px-3 py-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 font-medium rounded-lg text-xs transition-colors shrink-0 flex items-center gap-1.5 disabled:opacity-50"
                                        >
                                            {isAnalyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                            <span>Tentar Novamente</span>
                                        </button>
                                    )}
                                </div>

                                <p className="text-muted-foreground font-normal leading-relaxed text-[11.5px]">
                                    {activeRef.errorMessage || 'Não foi possível aceder ao vídeo ou processar o material.'}
                                </p>

                                {/* Guia Passo a Passo de Configuração do Apify se a credencial faltar */}
                                {activeRef.setupGuide && (
                                    <div className="p-3.5 rounded-xl bg-background/80 border border-border/80 space-y-2 text-xs">
                                        <strong className="text-foreground font-medium block">
                                            {activeRef.setupGuide.title}
                                        </strong>
                                        <div className="space-y-1 text-muted-foreground text-[11px] leading-relaxed">
                                            {activeRef.setupGuide.steps.map((step, idx) => (
                                                <p key={idx}>{step}</p>
                                            ))}
                                        </div>
                                        {activeRef.setupGuide.accountUrl && (
                                            <div className="pt-1.5 flex items-center gap-2">
                                                <a
                                                    href={activeRef.setupGuide.accountUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground font-medium rounded-lg text-xs hover:bg-primary/90 transition-colors"
                                                >
                                                    <LinkIcon size={12} />
                                                    <span>Abrir Apify Console (API Tokens)</span>
                                                </a>
                                                <span className="text-[10px] text-muted-foreground">
                                                    (5$ de crédito gratuito por mês para recuperar centenas de Reels)
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Alternativas imediatas enquanto a chave não é configurada */}
                                <div className="pt-2 border-t border-destructive/20 flex flex-wrap items-center gap-2">
                                    <input
                                        ref={activeRefFileInputRef}
                                        type="file"
                                        accept="video/mp4,video/quicktime,video/webm"
                                        className="hidden"
                                        onChange={(e) => {
                                            if (e.target.files?.[0]) {
                                                handleUploadVideoForExistingRef(activeRef.id, e.target.files[0]);
                                            }
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => activeRefFileInputRef.current?.click()}
                                        disabled={isActiveRefUploading || isAnalyzing}
                                        className="px-3 py-1.5 bg-background border border-border hover:bg-muted text-foreground font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
                                    >
                                        <Upload size={13} />
                                        <span>Carregar Ficheiro de Vídeo em vez disso</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Metadados e Mecanismos Audiovisuais Observados */}
                        {activeRef.analysis && (
                            <div className="p-3.5 rounded-xl bg-card border border-border/60 text-xs space-y-3 shrink-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] uppercase font-medium text-muted-foreground tracking-wider block">
                                        Mecanismos Audiovisuais Observados
                                    </span>
                                    {activeRef.analysis.videoMetadata && (
                                        <div className="flex items-center gap-2 text-[10.5px] text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Clock size={11} />
                                                {activeRef.analysis.videoMetadata.durationSeconds?.toFixed(1)}s
                                            </span>
                                            <span>•</span>
                                            <span>{activeRef.analysis.videoMetadata.aspectRatio}</span>
                                            {activeRef.analysis.extractedKeyframesCount && (
                                                <>
                                                    <span>•</span>
                                                    <span>{activeRef.analysis.extractedKeyframesCount} frames</span>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-[11px]">
                                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 space-y-1">
                                        <strong className="block text-foreground flex items-center gap-1.5">
                                            <Volume2 size={13} className="text-primary" />
                                            Gancho Verbal (0-3s):
                                        </strong>
                                        <span className="text-muted-foreground font-normal leading-relaxed block">
                                            "{activeRef.analysis.verbalHook?.phrase || 'Abertura direta'}"
                                        </span>
                                        {activeRef.analysis.verbalHook?.curiosityType && (
                                            <span className="inline-block text-[9.5px] text-primary/80 font-medium">
                                                Tipo: {activeRef.analysis.verbalHook.curiosityType}
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 space-y-1">
                                        <strong className="block text-foreground flex items-center gap-1.5">
                                            <Eye size={13} className="text-primary" />
                                            Gancho Visual (0-3s):
                                        </strong>
                                        <span className="text-muted-foreground font-normal leading-relaxed block">
                                            {activeRef.analysis.visualHook?.initialScene || 'Cena inicial em plano médio'}
                                        </span>
                                        {activeRef.analysis.visualHook?.onScreenText && (
                                            <span className="inline-block text-[9.5px] text-muted-foreground/90 font-mono">
                                                Texto: "{activeRef.analysis.visualHook.onScreenText}"
                                            </span>
                                        )}
                                    </div>

                                    <div className="p-2.5 rounded-lg bg-muted/30 border border-border/40 space-y-1">
                                        <strong className="block text-foreground flex items-center gap-1.5">
                                            <Sparkles size={13} className="text-primary" />
                                            Princípio Transferível:
                                        </strong>
                                        <span className="text-muted-foreground font-normal leading-relaxed block">
                                            {activeRef.analysis.transferablePrinciples?.[0] || 'Confronto de crença comum'}
                                        </span>
                                    </div>
                                </div>

                                {/* Transcrição Whisper com Timestamps (se disponível) */}
                                {activeRef.analysis.spokenTranscriptWithTimestamps && activeRef.analysis.spokenTranscriptWithTimestamps.length > 0 && (
                                    <div className="pt-2 border-t border-border/40">
                                        <button
                                            type="button"
                                            onClick={() => setShowTranscriptFull(!showTranscriptFull)}
                                            className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                                        >
                                            <Volume2 size={12} />
                                            <span>
                                                {showTranscriptFull ? 'Ocultar Transcrição do Áudio' : 'Ver Transcrição Falada com Timestamps (Whisper)'}
                                            </span>
                                            <ChevronDown size={12} className={`transform transition-transform ${showTranscriptFull ? 'rotate-180' : ''}`} />
                                        </button>

                                        {showTranscriptFull && (
                                            <div className="mt-2 p-2.5 rounded-lg bg-muted/20 border border-border/30 max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar text-[11px]">
                                                {activeRef.analysis.spokenTranscriptWithTimestamps.map((seg, idx) => (
                                                    <div key={idx} className="flex items-start gap-2">
                                                        <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">
                                                            [{seg.start.toFixed(1)}s - {seg.end.toFixed(1)}s]
                                                        </span>
                                                        <span className="text-foreground">{seg.text}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Grelha Oficial das 4 Colunas */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar">
                            <EditorialGridTable
                                proposals={activeRef.proposals || []}
                                onOpenProposal={(prop: ContentProposal) => setSelectedProposal(prop)}
                                onSendToKanban={handleSendProposalToKanban}
                            />
                        </div>
                    </>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground text-xs space-y-2">
                        <Film size={32} className="text-muted-foreground/40" />
                        <p className="font-medium text-foreground">Nenhuma referência selecionada</p>
                        <p className="text-[11px] max-w-sm">
                            Carrega um vídeo na coluna esquerda ou introduz o URL de um Reel para analisares os seus mecanismos audiovisuais.
                        </p>
                    </div>
                )}
            </div>

            {/* Modal de Detalhes da Proposta */}
            <ProposalDetailModal
                isOpen={Boolean(selectedProposal)}
                proposal={selectedProposal}
                onClose={() => setSelectedProposal(null)}
                onUpdateStatus={handleUpdateProposalStatus}
                onSaveProposal={handleSaveProposal}
                onSendToKanban={handleSendProposalToKanban}
            />
        </div>
    );
}
