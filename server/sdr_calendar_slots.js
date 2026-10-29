/**
 * server/sdr_calendar_slots.js
 * ============================================================================
 * VAMUSS SDR — GESTOR DE SLOTS E AGENDAMENTO ATIVO (UPGRADE GROK)
 * ============================================================================
 * Reduz a fricção do agendamento oferecendo ativamente 2 slots convenientes
 * em vez de depender apenas de um clique passivo num link externo.
 * 
 * Regras Invioláveis:
 * 1. O agente sugere no máximo 2 opções específicas no chat.
 * 2. O link do Cal.com (https://cal.com/euphilipecoelho-jxauxj/diagostico) funciona
 *    sempre como salvaguarda e fallback caso o lead prefira consultar a agenda completa.
 * 3. Só transita para agendamento após "sim" explícito a um dos horários.
 * 4. O negócio transita para "Pronto a Reabrir" no CRM e o Philipe é notificado.
 * 5. NUNCA reabrir como "Ganho" nem dar reunião como realizada sem conferência real.
 * ============================================================================
 */

export const CALCOM_FALLBACK_URL = 'https://cal.com/euphilipecoelho-jxauxj/diagostico';

/**
 * Gera 2 sugestões de horários convenientes nos próximos 2 a 4 dias úteis
 * 
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object} { slotA: string, slotB: string, conversationalText: string }
 */
export function generateRecommendedSlots(referenceDate = new Date()) {
    const d = new Date(referenceDate);

    // Avança 2 dias úteis
    let day1 = new Date(d);
    day1.setDate(day1.getDate() + 2);
    if (day1.getDay() === 0) day1.setDate(day1.getDate() + 1); // Domingo -> Segunda
    if (day1.getDay() === 6) day1.setDate(day1.getDate() + 2); // Sábado -> Segunda

    let day2 = new Date(day1);
    day2.setDate(day2.getDate() + 2);
    if (day2.getDay() === 0) day2.setDate(day2.getDate() + 1);
    if (day2.getDay() === 6) day2.setDate(day2.getDate() + 2);

    const weekdaysPt = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const nameDay1 = weekdaysPt[day1.getDay()];
    const nameDay2 = weekdaysPt[day2.getDay()];

    const slotA = `${nameDay1} às 11h00`;
    const slotB = `${nameDay2} às 15h30`;

    const conversationalText = `Dr(a), para maior comodidade, fica-lhe melhor ${slotA} ou ${slotB}? Se preferir ver todos os horários da minha agenda: ${CALCOM_FALLBACK_URL}`;

    return {
        slotA,
        slotB,
        conversationalText,
        calcomLink: CALCOM_FALLBACK_URL
    };
}

/**
 * Valida se a resposta do lead aceita um dos slots propostos
 * 
 * @param {string} inboundText
 * @param {Object} slotsPropostos
 * @returns {Object} { accepted: boolean, chosenSlot: string|null, fallbackNeeded: boolean }
 */
export function evaluateSlotChoice(inboundText = '', slotsPropostos = {}) {
    const norm = (inboundText || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Menção a slot A ou horários da manhã
    if (norm.includes('primeir') || norm.includes('11') || norm.includes('manha') || (slotsPropostos.slotA && norm.includes(slotsPropostos.slotA.slice(0, 5).toLowerCase()))) {
        return {
            accepted: true,
            chosenSlot: slotsPropostos.slotA || 'Manhã (11h00)',
            fallbackNeeded: false
        };
    }

    // Menção a slot B ou horários da tarde
    if (norm.includes('segund') || norm.includes('15') || norm.includes('tarde') || (slotsPropostos.slotB && norm.includes(slotsPropostos.slotB.slice(0, 5).toLowerCase()))) {
        return {
            accepted: true,
            chosenSlot: slotsPropostos.slotB || 'Tarde (15h30)',
            fallbackNeeded: false
        };
    }

    // Se respondeu de forma genérica ("sim", "pode ser", "combinado")
    if (/^(sim|pode ser|combinado|perfeito|otimo|ok)$/i.test(norm)) {
        return {
            accepted: true,
            chosenSlot: slotsPropostos.slotA || 'Horário inicial proposto',
            fallbackNeeded: false
        };
    }

    // Se disse que nenhum dá ou pediu para ver a agenda
    if (norm.includes('nenhum') || norm.includes('outro') || norm.includes('agenda') || norm.includes('link')) {
        return {
            accepted: false,
            chosenSlot: null,
            fallbackNeeded: true
        };
    }

    return {
        accepted: false,
        chosenSlot: null,
        fallbackNeeded: false
    };
}
