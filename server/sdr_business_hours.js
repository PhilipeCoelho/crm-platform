/**
 * ============================================================================
 * VAMUSS SDR — GESTÃO DETERMINÍSTICA DE HORÁRIO COMERCIAL (B.14.2.1)
 * ============================================================================
 * Controla e valida determinísticamente as janelas permitidas de envio do SDR.
 * 
 * Regras Estritas:
 * 1. Fuso Horário Canónico: Europe/Lisbon (WET no inverno UTC+0, WEST no verão UTC+1).
 * 2. Dias Permitidos: Segunda a sexta-feira inclusive.
 * 3. Fins de Semana: Sábados e domingos são estritamente proibidos.
 * 4. Feriados Nacionais Portugueses: Todos os feriados nacionais (fixos e móveis)
 *    são estritamente proibidos.
 * 5. Janela Horária: Das 09h00 inclusive (09:00:00.000) às 17h00 exclusive (16:59:59.999).
 * 6. Fora da Janela: O GPT pode analisar e rascunhar, mas qualquer tentativa de disparo
 *    (simulada ou real) é bloqueada imediatamente antes do envio e reagendada para a
 *    próxima janela útil com reavaliação de contexto.
 * ============================================================================
 */

export const LISBON_TIMEZONE = 'Europe/Lisbon';

export const BUSINESS_HOURS_CONFIG = {
    TIMEZONE: LISBON_TIMEZONE,
    START_HOUR: 9,
    START_MINUTE: 0,
    START_SECOND: 0,
    END_HOUR: 18,
    END_MINUTE: 0,
    END_SECOND: 0,
    // Em segundos a partir da meia-noite (00:00:00.000):
    START_SECONDS_INCLUSIVE: 9 * 3600, // 32400s
    END_SECONDS_EXCLUSIVE: 18 * 3600    // 64800s (17:59:59.999 é < 64800s)
};

export class BusinessHoursException extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'BusinessHoursException';
        this.details = details;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * Decompõe uma data nos componentes exatos do fuso horário Europe/Lisbon,
 * calculando de forma determinística transições de inverno (WET) e verão (WEST).
 */
export function getLisbonTimeParts(date = new Date()) {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) {
        throw new Error(`Data inválida fornecida: ${date}`);
    }

    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: LISBON_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
        hour12: false,
        weekday: 'short'
    });

    const parts = formatter.formatToParts(d);
    const obj = {};
    for (const p of parts) {
        obj[p.type] = p.value;
    }

    const dayOfWeekMap = { 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6, 'Sun': 7 };

    const year = parseInt(obj.year, 10);
    const month = parseInt(obj.month, 10);
    const day = parseInt(obj.day, 10);
    const hour = parseInt(obj.hour, 10);
    const minute = parseInt(obj.minute, 10);
    const second = parseInt(obj.second, 10);
    const millisecond = obj.fractionalSecond ? parseInt(obj.fractionalSecond, 10) : d.getUTCMilliseconds();
    const dayOfWeek = dayOfWeekMap[obj.weekday] || 0;

    const pad = (n) => String(n).padStart(2, '0');

    return {
        year,
        month,
        day,
        hour,
        minute,
        second,
        millisecond,
        weekday: obj.weekday,
        dayOfWeek, // 1 = Segunda, 5 = Sexta, 6 = Sábado, 7 = Domingo
        formattedDate: `${year}-${pad(month)}-${pad(day)}`,
        formattedTime: `${pad(hour)}:${pad(minute)}:${pad(second)}`,
        isoReference: d.toISOString()
    };
}

/**
 * Calcula a data do Domingo de Páscoa para qualquer ano gregoriano
 * utilizando o algoritmo astronómico Meeus/Jones/Butcher.
 */
export function getEasterSunday(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = Março, 4 = Abril
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Retorna os feriados nacionais oficiais de Portugal para um determinado ano
 */
export function getPortugueseHolidays(year) {
    const pad = (n) => String(n).padStart(2, '0');
    
    // Feriados Nacionais Fixos em Portugal:
    const fixedHolidays = [
        { date: `${year}-01-01`, name: 'Ano Novo' },
        { date: `${year}-04-25`, name: 'Dia da Liberdade (25 de Abril)' },
        { date: `${year}-05-01`, name: 'Dia do Trabalhador (1 de Maio)' },
        { date: `${year}-06-10`, name: 'Dia de Portugal, de Camões e das Comunidades' },
        { date: `${year}-08-15`, name: 'Assunção de Nossa Senhora' },
        { date: `${year}-10-05`, name: 'Implantação da República (5 de Outubro)' },
        { date: `${year}-11-01`, name: 'Dia de Todos os Santos' },
        { date: `${year}-12-01`, name: 'Restauração da Independência (1 de Dezembro)' },
        { date: `${year}-12-08`, name: 'Dia da Imaculada Conceição' },
        { date: `${year}-12-25`, name: 'Natal' }
    ];

    // Feriados Nacionais Móveis Oficiais em Portugal:
    const easter = getEasterSunday(year);
    const goodFriday = new Date(easter.getTime() - 2 * 24 * 3600 * 1000);
    const corpusChristi = new Date(easter.getTime() + 60 * 24 * 3600 * 1000);

    const gfParts = getLisbonTimeParts(goodFriday);
    const easterParts = getLisbonTimeParts(easter);
    const ccParts = getLisbonTimeParts(corpusChristi);

    const mobileHolidays = [
        { date: `${year}-${pad(gfParts.month)}-${pad(gfParts.day)}`, name: 'Sexta-Feira Santa' },
        { date: `${year}-${pad(easterParts.month)}-${pad(easterParts.day)}`, name: 'Domingo de Páscoa' },
        { date: `${year}-${pad(ccParts.month)}-${pad(ccParts.day)}`, name: 'Corpo de Deus' }
    ];

    return [...fixedHolidays, ...mobileHolidays];
}

/**
 * Mapeamento dos feriados municipais dos principais concelhos de Portugal
 */
export const MUNICIPAL_HOLIDAYS_MAP = Object.freeze({
    'LISBOA': { month: 6, day: 13, name: 'Feriado Municipal de Lisboa (Santo António)' },
    'PORTO': { month: 6, day: 24, name: 'Feriado Municipal do Porto (São João)' },
    'CASCAIS': { month: 6, day: 13, name: 'Feriado Municipal de Cascais (Santo António)' },
    'SINTRA': { month: 6, day: 29, name: 'Feriado Municipal de Sintra (São Pedro)' },
    'OEIRAS': { month: 6, day: 7, name: 'Feriado Municipal de Oeiras' },
    'COIMBRA': { month: 7, day: 4, name: 'Feriado Municipal de Coimbra (Rainha Santa Isabel)' },
    'BRAGA': { month: 6, day: 24, name: 'Feriado Municipal de Braga (São João)' },
    'SETUBAL': { month: 9, day: 15, name: 'Feriado Municipal de Setúbal (Bocage)' },
    'FARO': { month: 9, day: 7, name: 'Feriado Municipal de Faro' },
    'ALMADA': { month: 6, day: 24, name: 'Feriado Municipal de Almada (São João)' },
    'FUNCHAL': { month: 8, day: 21, name: 'Feriado Municipal do Funchal' }
});

/**
 * Verifica se uma data específica é feriado nacional ou municipal relevante em Portugal
 */
export function isPortugueseHoliday(date = new Date(), { municipality = null } = {}) {
    const parts = getLisbonTimeParts(date);
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`;

    const holidays = getPortugueseHolidays(parts.year);
    const found = holidays.find(h => h.date === dateStr);

    if (found) {
        return {
            holiday: true,
            name: found.name,
            tipo: 'NACIONAL',
            date: dateStr
        };
    }

    if (municipality) {
        const normMun = String(municipality).trim().toUpperCase();
        const munHoliday = MUNICIPAL_HOLIDAYS_MAP[normMun];
        if (munHoliday && munHoliday.month === parts.month && munHoliday.day === parts.day) {
            return {
                holiday: true,
                name: munHoliday.name,
                tipo: 'MUNICIPAL',
                concelho: normMun,
                date: dateStr
            };
        }
    }

    return {
        holiday: false,
        name: null,
        tipo: null,
        date: dateStr
    };
}

/**
 * Constrói um objeto Date UTC correspondente à hora e minutos pretendidos
 * no fuso horário Europe/Lisbon, compensando o desvio DST automaticamente.
 */
export function createLisbonDateTime(year, month, day, hour = 9, minute = 0, second = 0) {
    let d = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const parts = getLisbonTimeParts(d);
    const diffHours = hour - parts.hour;
    if (diffHours !== 0) {
        d = new Date(d.getTime() + diffHours * 3600 * 1000);
    }
    return d;
}

/**
 * Validação estruturada detalhada com motivo e próxima janela recomendada:
 * - Segunda a Sexta
 * - 09:00:00.000 inclusive até 17:00:00.000 exclusive (16:59:59.999)
 * - Exceto feriados nacionais portugueses
 */
export function validateDispatchTiming(date = new Date(), { municipality = null } = {}) {
    const parts = getLisbonTimeParts(date);
    const holidayCheck = isPortugueseHoliday(date, { municipality });

    // Segundos decorridos desde as 00:00:00.000 do dia em Lisboa:
    const secondsSinceMidnight = parts.hour * 3600 + parts.minute * 60 + parts.second + parts.millisecond / 1000;

    const isWeekend = parts.dayOfWeek === 6 || parts.dayOfWeek === 7;
    const isHoliday = holidayCheck.holiday;
    const isBeforeHours = secondsSinceMidnight < BUSINESS_HOURS_CONFIG.START_SECONDS_INCLUSIVE;
    const isAfterHours = secondsSinceMidnight >= BUSINESS_HOURS_CONFIG.END_SECONDS_EXCLUSIVE;

    if (isHoliday) {
        return {
            permitido: false,
            motivo: holidayCheck.tipo === 'MUNICIPAL' ? 'FERIADO_MUNICIPAL_PORTUGAL' : 'FERIADO_NACIONAL_PORTUGAL',
            detalhe: `Disparos estritamente proibidos em feriados (${holidayCheck.name}). Janela autorizada: Seg-Sex das 09h00 às 17h00 Europe/Lisbon.`,
            lisbon_time: parts,
            proxima_janela_util: getNextBusinessWindow(date, { municipality }).toISOString()
        };
    }

    if (isWeekend) {
        return {
            permitido: false,
            motivo: 'FIM_DE_SEMANA',
            detalhe: `Disparos estritamente proibidos ao fim de semana (${parts.weekday === 'Sat' ? 'Sábado' : 'Domingo'}). Janela autorizada: Seg-Sex das 09h00 às 17h00 Europe/Lisbon.`,
            lisbon_time: parts,
            proxima_janela_util: getNextBusinessWindow(date, { municipality }).toISOString()
        };
    }

    if (isBeforeHours) {
        return {
            permitido: false,
            motivo: 'ANTES_DO_HORARIO_COMERCIAL',
            detalhe: `Disparos permitidos apenas a partir das 09h00 Europe/Lisbon (atual: ${parts.formattedTime}).`,
            lisbon_time: parts,
            proxima_janela_util: getNextBusinessWindow(date, { municipality }).toISOString()
        };
    }

    if (isAfterHours) {
        return {
            permitido: false,
            motivo: 'APOS_HORARIO_COMERCIAL',
            detalhe: `Disparos permitidos apenas até às 16h59:59 Europe/Lisbon (atual: ${parts.formattedTime}).`,
            lisbon_time: parts,
            proxima_janela_util: getNextBusinessWindow(date, { municipality }).toISOString()
        };
    }

    return {
        permitido: true,
        motivo: 'DENTRO_DO_HORARIO_COMERCIAL',
        detalhe: `Horário comercial válido e autorizado (${parts.weekday} ${parts.formattedTime} Europe/Lisbon).`,
        lisbon_time: parts,
        proxima_janela_util: null
    };
}

/**
 * Função canónica booleana: verifica se o momento está dentro do horário comercial
 */
export function isWithinBusinessHours(date = new Date(), { municipality = null } = {}) {
    const timing = validateDispatchTiming(date, { municipality });
    return timing.permitido;
}

// Alias canónico compatível
export const isPortugalBusinessHours = isWithinBusinessHours;

/**
 * Calcula determinísticamente a próxima janela útil de abertura (09h00 em dia útil não-feriado)
 */
export function getNextBusinessWindow(date = new Date(), { municipality = null } = {}) {
    const d = date instanceof Date ? date : new Date(date);
    const parts = getLisbonTimeParts(d);
    const holidayCheck = isPortugueseHoliday(d, { municipality });
    const isWeekday = parts.dayOfWeek >= 1 && parts.dayOfWeek <= 5;
    const secondsSinceMidnight = parts.hour * 3600 + parts.minute * 60 + parts.second + parts.millisecond / 1000;

    // Se é dia útil, não é feriado e estamos ANTES das 09h00: a próxima janela é HOJE às 09h00
    if (isWeekday && !holidayCheck.holiday && secondsSinceMidnight < BUSINESS_HOURS_CONFIG.START_SECONDS_INCLUSIVE) {
        return createLisbonDateTime(parts.year, parts.month, parts.day, 9, 0, 0);
    }

    // Caso contrário, procura o próximo dia útil não-feriado a começar às 09h00
    let candidate = new Date(d.getTime() + 24 * 3600 * 1000);
    for (let i = 0; i < 30; i++) {
        const cParts = getLisbonTimeParts(candidate);
        const cHoliday = isPortugueseHoliday(candidate, { municipality });
        const cWeekday = cParts.dayOfWeek >= 1 && cParts.dayOfWeek <= 5;

        if (cWeekday && !cHoliday.holiday) {
            return createLisbonDateTime(cParts.year, cParts.month, cParts.day, 9, 0, 0);
        }
        candidate = new Date(candidate.getTime() + 24 * 3600 * 1000);
    }

    return createLisbonDateTime(parts.year, parts.month, parts.day + 1, 9, 0, 0);
}

/**
 * Dispara uma exceção imediata caso a tentativa de envio ocorra fora da janela permitida
 */
export function assertWithinBusinessHours(date = new Date(), context = 'DISPATCH', { municipality = null } = {}) {
    const timing = validateDispatchTiming(date, { municipality });
    if (!timing.permitido) {
        throw new BusinessHoursException(
            `BLOQUEIO_FORA_HORARIO_COMERCIAL: Tentativa de envio em ${context} rejeitada. ${timing.detalhe}`,
            timing
        );
    }
    return timing;
}
