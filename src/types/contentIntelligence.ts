export type ContentFormat = 'Reel' | 'TikTok' | 'Carrossel' | 'Vídeo Curto' | 'aberto';

export type IdeaStatus = 'pendente' | 'processando' | 'concluido' | 'erro';

export type ReferenceStatus = 
    | 'pendente' 
    | 'processando' 
    | 'aguardando_recuperacao'
    | 'recuperando_video'
    | 'video_recuperado'
    | 'analisando_audiovisual'
    | 'gerando_propostas'
    | 'requer_material' 
    | 'concluido' 
    | 'erro'
    | 'erro_recuperacao'
    | 'erro_analise';

export type ProposalApprovalStatus = 
    | 'rascunho'
    | 'aprovado_desenvolver'
    | 'testar_alteracoes'
    | 'guardar_mais_tarde'
    | 'descartado';

export interface ContentHook {
    id: string;
    userId?: string;
    text: string;
    category: string;
    mechanism: string;
    context?: string;
    example?: string;
    notes?: string;
    usageCount?: number;
    isArchived?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface ContentIdea {
    id: string;
    userId?: string;
    rawIdea: string;
    targetAudience?: string;
    personalContext?: string;
    goal?: string;
    preferredFormat?: ContentFormat;
    status: IdeaStatus;
    errorMessage?: string;
    proposals?: ContentProposal[];
    createdAt: string;
    updatedAt?: string;
}

export interface ReferenceAnalysis {
    verbalHook?: {
        phrase: string;
        promise: string;
        curiosityType: string;
        tension: string;
        approachType: string;
        relationToContent: string;
    };
    visualHook?: {
        initialScene: string;
        framing: string;
        bodyLanguage: string;
        visualMovement: string;
        onScreenText: string;
        visualContrast: string;
    };
    narrativeStructure?: {
        beginning: string;
        development: string;
        progression: string;
        evidenceAndProofs: string;
        retentionMechanism: string;
        resolution: string;
        cta: string;
    };
    editingAndPacing?: {
        duration?: string;
        scenePacing: string;
        cutsAndTransitions: string;
        captionsAndGraphics: string;
        attentionRenewers: string;
    };
    carouselAnalysis?: {
        coverPromise: string;
        slideProgression: string;
        informationDensity: string;
        interSlideCuriosity: string;
        finalCta: string;
    };
    performanceAndHypotheses?: {
        observations: string; // Fatos observados
        strategicHypotheses: string; // Hipóteses estratégicas
        limitations: string; // O que falta saber
    };
    transferablePrinciples: string[];
    missingMaterialReason?: string;
    analysisSource?: 'video_audiovisual' | 'video_visual_only' | 'carousel_images' | 'user_transcript' | 'notes_only' | 'url_only';
    videoMetadata?: {
        durationSeconds?: number;
        width?: number;
        height?: number;
        aspectRatio?: string;
        hasAudio?: boolean;
        hasSpeech?: boolean;
        fileSizeMb?: number;
    };
    spokenTranscriptWithTimestamps?: Array<{ start: number; end: number; text: string }>;
    extractedKeyframesCount?: number;
}

export interface ContentReference {
    id: string;
    userId?: string;
    url?: string;
    platform: string;
    notes?: string;
    videoFileUrl?: string;
    fileName?: string;
    fileSize?: number;
    fileFormat?: string;
    mediaUrls?: string[];
    transcript?: string;
    hasAccessibleMedia: boolean;
    status: ReferenceStatus;
    errorMessage?: string;
    setupGuide?: {
        title: string;
        description?: string;
        steps: string[];
        accountUrl?: string;
    };
    analysis?: ReferenceAnalysis;
    proposals?: ContentProposal[];
    createdAt: string;
    updatedAt?: string;
}

/**
 * Proposta Editorial Oficial:
 * Deve conter rigorosamente a grelha das 4 colunas + os detalhes estratégicos
 */
export interface ContentProposal {
    id: string;
    userId?: string;
    ideaId?: string;
    referenceId?: string;
    cardId?: string; // ID do cartão no Kanban se já enviado

    // GRELHA OFICIAL DAS 4 COLUNAS
    angulo: string;
    ideiaMelhorada: string;
    ganchoBase: string;
    retencaoHook: string;

    // DETALHES COMPLETOS
    titulo: string;
    formato: string;
    objetivo?: string;
    publicoAlvo?: string;
    ganchoVerbal?: string;
    ganchoVisual?: string;
    roteiroSlides?: string;
    sugestoesCenas?: string;
    sugestoesEnquadramento?: string;
    sugestoesEdicao?: string;
    textoTela?: string;
    cta?: string;
    justificativaEstrategica?: string;
    limitacoesHipoteses?: string;
    ganchosUtilizados?: string[];

    statusAprovacao: ProposalApprovalStatus;
    createdAt: string;
    updatedAt?: string;
}

/**
 * ==============================================================================
 * SISTEMA: MELHORADOR DE IDEIAS (3 ETAPAS FUNCIONAIS)
 * ==============================================================================
 */

/**
 * Linha da Grelha Editorial Oficial (Exatamente as 4 Colunas Oficiais)
 */
export interface GridApproach {
    id: string;
    // As 4 Colunas Oficiais Obrigatórias:
    angulo: string;
    ideiaMelhorada: string;
    ganchoBase: string;
    retencaoHook: string;
    
    // Metadados funcionais
    fonteGancho?: string;
    isSelected?: boolean;
    isEdited?: boolean;
}

/**
 * Opção de Formato para Etapa 2
 */
export interface FormatOption {
    id: string;
    nome: string;
    conceito: string;
    porQueFunciona: string;
    ganchoVerbal: string;
    ganchoVisual: string;
    recursosDificuldade: string;
    isRecomendado?: boolean;
    motivoRecomendacao?: string;
    isSelected?: boolean;
}

/**
 * Proposta Completa e Roteiro para Etapa 3
 */
export interface DevelopedProposal {
    titulo: string;
    formato: string;
    conceitoEObjetivo: string;
    publicoEMensagemCentral: string;
    ganchoVerbal: string;
    ganchoVisual: string;
    estruturaNarrativa: string;
    sequenciaCenas: string;
    enquadramentosEAcoes: string;
    textoFaladoOuTela: string;
    mecanismosRetencao: string;
    sugestoesEdicao: string;
    cta: string;
    cardId?: string; // ID do cartão no Kanban se enviado
}

/**
 * Sessão Persistida do Melhorador de Ideias
 */
export interface ImprovedIdeaSession {
    id: string;
    userId: string;
    currentStep: 1 | 2 | 3;
    // Etapa 1
    rawIdea: string;
    targetAudience: string;
    goal: string;
    context: string;
    gridProposals: GridApproach[];
    selectedApproachId?: string;
    // Etapa 2
    formatProposals: FormatOption[];
    selectedFormatId?: string;
    // Etapa 3
    developedProposal?: DevelopedProposal;
    status: 'rascunho' | 'concluido' | 'enviado_kanban';
    createdAt: string;
    updatedAt: string;
}

