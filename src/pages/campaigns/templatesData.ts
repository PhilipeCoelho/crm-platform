export const TEMPLATE_CATEGORIES = [
  'Newsletter',
  'Oferta',
  'Convite',
  'Prova Social',
  'Follow-up'
] as const;

export type TemplateCategory = typeof TEMPLATE_CATEGORIES[number];

export interface TemplateStructure {
    id: string; // Internal id for defaults
    name: string;
    category: TemplateCategory;
    subject: string;
    defaultData: Record<string, any>;
    thumbnail: string;
}

export const DEFAULT_TEMPLATES: TemplateStructure[] = [
    {
        id: 'default-newsletter',
        name: 'Newsletter Semanal',
        category: 'Newsletter',
        subject: 'Sua dose semanal de insights',
        thumbnail: 'https://images.unsplash.com/photo-1557200134-90327ee9fafa?auto=format&fit=crop&q=80&w=400',
        defaultData: {
            logoUrl: 'https://via.placeholder.com/150x50?text=LOGO',
            title: 'Novidades da Semana',
            subtitle: 'O que preparamos para você',
            imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800',
            content: 'Nesta semana, nós trabalhamos em várias inovações focadas no crescimento do seu negócio. Veja como aplicar.',
            insights: [
                'Estratégia 1 para escalar vendas',
                'Novo recurso de automação liberado',
                'Estudo de caso no varejo'
            ],
            ctaText: 'Ler conteúdo completo',
            ctaUrl: 'https://seusite.com/blog',
            signature: 'Equipe Marketing'
        }
    },
    {
        id: 'default-oferta',
        name: 'Oferta Consultiva',
        category: 'Oferta',
        subject: 'Como resolver [Problema] em seu negócio',
        thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=400',
        defaultData: {
            logoUrl: 'https://via.placeholder.com/150x50?text=LOGO',
            title: 'Está perdendo vendas por falta de acompanhamento?',
            problemDescription: 'Sabemos que 70% dos leads esfriam quando não são contatados nos primeiros 5 minutos.',
            insight: 'Implementar um CRM ágil reduz esse problema em 50%.',
            benefits: [
                'Visibilidade total do funil',
                'Automação de tarefas manuais',
                'Previsibilidade de receita'
            ],
            ctaText: 'Falar com Consultor',
            ctaUrl: 'https://seusite.com/agendamento',
            signature: 'Consultor Estratégico'
        }
    },
    {
        id: 'default-convite',
        name: 'Convite para Evento/Call',
        category: 'Convite',
        subject: 'Convite Exclusivo: [Nome do Evento]',
        thumbnail: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&q=80&w=400',
        defaultData: {
            logoUrl: 'https://via.placeholder.com/150x50?text=LOGO',
            title: 'Participe do nosso Workshop',
            content: 'Você foi selecionado(a) para nossa sessão VIP onde discutiremos estratégias de mercado exclusivas.',
            valueProposition: 'Em 45 minutos você descobrirá 3 táticas acionáveis que não ensinamos no blog.',
            ctaText: 'Garantir minha vaga',
            ctaUrl: 'https://seusite.com/convite',
            signature: 'Organização do Evento'
        }
    },
    {
        id: 'default-provasocial',
        name: 'Case de Sucesso',
        category: 'Prova Social',
        subject: 'Como a empresa X cresceu 200%',
        thumbnail: 'https://images.unsplash.com/photo-1556761175-5973e2181512?auto=format&fit=crop&q=80&w=400',
        defaultData: {
            logoUrl: 'https://via.placeholder.com/150x50?text=LOGO',
            clientStory: 'Exemplo prático de sucesso',
            initialProblem: 'A Empresa X estava estagnada em faturamento, gastando milhares de reais sem retorno em mídia.',
            result: 'Após 3 meses de implementação, conseguiram dobrar a conversão.',
            proof: 'Confira o depoimento do CEO no nosso site.',
            ctaText: 'Quero o mesmo resultado',
            ctaUrl: 'https://seusite.com/case',
            signature: 'Time de CS'
        }
    },
    {
        id: 'default-followup',
        name: 'Follow-up Rápido',
        category: 'Follow-up',
        subject: 'Ainda tem interesse?',
        thumbnail: 'https://images.unsplash.com/photo-1512428559087-560fa5ceab42?auto=format&fit=crop&q=80&w=400',
        defaultData: {
            content: 'Oi, tentei contato e não consegui. Você ainda está focando em melhorar seus resultados neste semestre?',
            question: 'Faz sentido agendarmos 10 minutos para falarmos sobre isso?',
            ctaText: 'Escolher um horário',
            ctaUrl: 'https://seusite.com/calendly'
        }
    }
];

export const EMAIL_LAYOUT_THEMES = [
    {
        id: 'simple',
        name: 'Carta Pessoal 1:1',
        description: 'Design minimalista que simula um e-mail escrito à mão. Máxima taxa de entrega.',
        styles: {
            container: "font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff;",
            header: "display: none;",
            content: "font-size: 16px; margin-bottom: 30px;",
            footer: "margin-top: 40px; padding-top: 20px; border-top: 1px solid #f1f5f9; color: #94a3b8; font-size: 12px; font-style: italic;"
        }
    },
    {
        id: 'professional',
        name: 'Acelerador de Vendas',
        description: 'Layout focado em autoridade. Título forte, design limpo e CTA centralizado.',
        styles: {
            container: "font-family: 'Inter', -apple-system, sans-serif; line-height: 1.8; color: #1e293b; max-width: 600px; margin: 20px auto; padding: 0; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;",
            header: "background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 30px; text-align: center; color: #ffffff;",
            content: "padding: 40px; font-size: 16px;",
            footer: "padding: 30px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; color: #64748b; font-size: 12px; text-align: center;"
        }
    },
    {
        id: 'consultative',
        name: 'Construtor de Confiança',
        description: 'Design consultivo com blocos estruturados e assinatura premium.',
        styles: {
            container: "font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 30px; background-color: #ffffff; border-left: 5px solid #3b82f6;",
            header: "margin-bottom: 25px; padding-bottom: 15px; border-bottom: 1px solid #edf2f7;",
            content: "font-size: 15px; background: #fafafa; padding: 25px; border-radius: 8px;",
            footer: "margin-top: 40px; padding-top: 20px; border-top: 2px solid #3b82f6; color: #1e293b; font-size: 14px; font-weight: bold;"
        }
    },
    {
        id: 'impact',
        name: 'Digital Authority (Dark)',
        description: 'Modo escuro premium. Impacto visual imediato para anúncios exclusivos.',
        styles: {
            container: "font-family: Arial, sans-serif; line-height: 1.6; color: #f8fafc; max-width: 600px; margin: 0 auto; padding: 50px; background-color: #020617; border-radius: 0; border-top: 8px solid #38bdf8;",
            header: "text-align: center; margin-bottom: 50px;",
            content: "background: rgba(255,255,255,0.03); padding: 30px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); font-size: 16px;",
            footer: "margin-top: 60px; text-align: center; color: #64748b; font-size: 11px; letter-spacing: 1px; text-transform: uppercase;"
        }
    }
];

export function wrapContentInTheme(content: string, themeId: string, logoUrl?: string, signature?: string) {
    const theme = EMAIL_LAYOUT_THEMES.find(t => t.id === themeId) || EMAIL_LAYOUT_THEMES[0];
    const isDark = themeId === 'impact';
    const accentColor = isDark ? '#38bdf8' : '#3b82f6';
    
    // Auto-detect button-like lines and style them
    let stylizedContent = content;
    if (content.includes('→') || content.includes('Agendar')) {
        stylizedContent = content.replace(/<p>(.*?)(→|Agendar)(.*?)<\/p>/gi, (match) => {
            return `<div style="text-align: center; margin: 30px 0;"><a href="#" style="display: inline-block; padding: 14px 32px; background-color: ${accentColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: bold; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1);">${match.replace(/<\/?p>/g, '')}</a></div>`;
        });
    }

    return `
        <div style="${theme.styles.container}">
            ${themeId !== 'simple' ? `
            <div style="${theme.styles.header}">
                ${logoUrl ? `<img src="${logoUrl}" alt="Logo" style="max-height: 44px;"/>` : `<div style="font-weight: 900; font-size: 20px; letter-spacing: -0.5px; color: ${isDark ? '#fff' : accentColor};">PROPOSTA ESTRATÉGICA</div>`}
            </div>
            ` : ''}
            
            <div style="${theme.styles.content}">
                ${stylizedContent}
            </div>

            <div style="${theme.styles.footer}">
                ${themeId === 'consultative' ? `
                    <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                        <tr>
                            <td style="vertical-align: top; padding-right: 15px;">
                                <div style="width: 50px; hieght: 50px; background-color: #3b82f6; border-radius: 50%; color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; height: 50px;">${(signature || 'P').charAt(0)}</div>
                            </td>
                            <td>
                                <div style="font-weight: bold; font-size: 16px;">${signature || 'Consultor Estratégico'}</div>
                                <div style="color: #64748b; font-size: 12px;">Especialista em Performance B2B</div>
                            </td>
                        </tr>
                    </table>
                ` : (signature || 'Enviado via CRM Inteligente')}
                <div style="margin-top: 20px; font-size: 10px; opacity: 0.6;">
                    Este e-mail é exclusivo para parceiros de negócio. 
                    <br/>
                    Para não receber mais, <a href="#" style="color: inherit; text-decoration: underline;">clique aqui para descadastrar</a>.
                </div>
            </div>
        </div>
    `;
}

export function renderTemplateHTML(category: TemplateCategory, data: Record<string, any>) {
    const baseStyle = "font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border: 1px solid #eaeaea; border-radius: 8px;";
    const btnStyle = "display: inline-block; padding: 12px 24px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 20px; text-align: center;";
    const logoHtml = data.logoUrl ? `<div style="text-align: center; margin-bottom: 30px;"><img src="${data.logoUrl}" alt="Logo" style="max-height: 50px;"/></div>` : '';
    const hrHtml = `<hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0;" />`;

    switch(category) {
        case 'Newsletter':
            return `
                <div style="${baseStyle}">
                    ${logoHtml}
                    <h1 style="color: #1e293b; text-align: center; margin-bottom: 5px;">${data.title}</h1>
                    <h3 style="color: #64748b; text-align: center; font-weight: normal; margin-top: 0; margin-bottom: 25px;">${data.subtitle}</h3>
                    ${data.imageUrl ? `<img src="${data.imageUrl}" alt="Hero" style="width: 100%; border-radius: 6px; margin-bottom: 25px;"/>` : ''}
                    <p style="font-size: 16px;">${data.content}</p>
                    <ul style="padding-left: 20px; margin-bottom: 30px;">
                        ${data.insights?.map((i: string) => `<li style="margin-bottom: 8px;">${i}</li>`).join('') || ''}
                    </ul>
                    <div style="text-align: center;">
                        <a href="${data.ctaUrl}" style="${btnStyle}">${data.ctaText}</a>
                    </div>
                    ${hrHtml}
                    <p style="color: #94a3b8; font-size: 14px; text-align: center;">${data.signature}</p>
                </div>
            `;
        case 'Oferta':
            return `
                <div style="${baseStyle}">
                    ${logoHtml}
                    <h2 style="color: #1e293b;">${data.title}</h2>
                    <p style="color: #ef4444; font-weight: bold; margin-bottom: 20px;">${data.problemDescription}</p>
                    <div style="background-color: #f8fafc; padding: 15px; border-left: 4px solid #3b82f6; margin-bottom: 25px;">
                        <strong>💡 Insight:</strong> ${data.insight}
                    </div>
                    <h4 style="margin-bottom: 10px;">Benefícios diretos:</h4>
                    <ul style="padding-left: 20px; margin-bottom: 30px;">
                        ${data.benefits?.map((b: string) => `<li>${b}</li>`).join('') || ''}
                    </ul>
                    <div style="text-align: center;">
                        <a href="${data.ctaUrl}" style="${btnStyle}">${data.ctaText}</a>
                    </div>
                    ${hrHtml}
                    <p style="color: #94a3b8; font-size: 14px;">${data.signature}</p>
                </div>
            `;
        case 'Convite':
            return `
                <div style="${baseStyle} text-align: center;">
                    ${logoHtml}
                    <h2 style="color: #1e293b;">${data.title}</h2>
                    <p style="font-size: 16px; margin: 20px 0;">${data.content}</p>
                    <p style="font-weight: bold; color: #0ea5e9; font-size: 18px;">${data.valueProposition}</p>
                    <a href="${data.ctaUrl}" style="${btnStyle}">${data.ctaText}</a>
                    ${hrHtml}
                    <p style="color: #94a3b8; font-size: 14px;">${data.signature}</p>
                </div>
            `;
        case 'Prova Social':
            return `
                <div style="${baseStyle}">
                    ${logoHtml}
                    <div style="background-color: #fdfbf7; padding: 20px; border-radius: 8px; border: 1px solid #fde68a;">
                        <h2 style="color: #92400e; margin-top: 0;">${data.clientStory}</h2>
                        <p><strong>Antes:</strong> ${data.initialProblem}</p>
                        <p><strong>Depois:</strong> ${data.result}</p>
                        <p style="font-style: italic; color: #475569;">"${data.proof}"</p>
                    </div>
                    <div style="text-align: center;">
                        <a href="${data.ctaUrl}" style="${btnStyle} background-color: #ea580c;">${data.ctaText}</a>
                    </div>
                    ${hrHtml}
                    <p style="color: #94a3b8; text-align: center; font-size: 14px;">${data.signature}</p>
                </div>
            `;
        case 'Follow-up':
            return `
                <div style="${baseStyle} max-width: 500px;">
                    <p style="font-size: 16px;">${data.content}</p>
                    <p style="font-size: 16px; font-weight: bold;">${data.question}</p>
                    <a href="${data.ctaUrl}" style="${btnStyle} display: block;">${data.ctaText}</a>
                </div>
            `;
        default:
            return `<div>Sem template</div>`;
    }
}
