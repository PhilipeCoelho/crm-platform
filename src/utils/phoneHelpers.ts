/**
 * Normaliza o número removendo todos os não-dígitos.
 */
function normalize(phone: string): string {
  return phone.replace(/\D/g, '');
}

/**
 * Retorna true se o número for um celular reconhecido (PT ou BR).
 * Conservador: se não reconhecer o padrão, assume celular para não esconder números válidos.
 */
export function isMobileNumber(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const digits = normalize(phone);

  // --- Portugal com DDI (+351) ---
  if (digits.startsWith('351')) {
    // Celulares PT: 9x com DDI → 3519x, 12 dígitos
    return digits.length === 12 && digits.startsWith('3519');
  }

  // --- Brasil com DDI (+55) ---
  if (digits.startsWith('55')) {
    // Celulares BR: 55 + DD (2 dígitos) + 9 + 8 dígitos = 13 total
    // e o 5º dígito (index 4) deve ser '9'
    return digits.length === 13 && digits[4] === '9';
  }

  // --- Portugal sem DDI ---
  // Celular: começa com 9 e tem 9 dígitos
  if (digits.length === 9 && digits.startsWith('9')) return true;
  // Fixo PT: começa com 2 e tem 9 dígitos
  if (digits.length === 9 && digits.startsWith('2')) return false;
  // Fixo PT: começa com 3 e tem 9 dígitos (800, 808, 300...)
  if (digits.length === 9 && digits.startsWith('3')) return false;

  // --- Brasil sem DDI ---
  // Celular BR: DD (2) + 9 (1) + número (8) = 11 dígitos, índice 2 = '9'
  if (digits.length === 11 && digits[2] === '9') return true;
  // Fixo BR: DD (2) + número (8) = 10 dígitos
  if (digits.length === 10) return false;

  // Internacionais desconhecidos: assumir celular para não esconder
  if (digits.length > 9) return true;

  return false;
}

/**
 * Retorna true se o número for claramente um fixo (telefonema sem suporte a WhatsApp).
 */
export function isLandline(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const digits = normalize(phone);

  // PT com DDI: fixo começa com 3512 (ex: 351210000000)
  if (digits.startsWith('351') && digits.length === 12) {
    return !digits.startsWith('3519');
  }

  // PT sem DDI: fixo começa com 2 ou 3
  if (digits.length === 9 && (digits.startsWith('2') || digits.startsWith('3'))) return true;

  // BR com DDI: fixo = 55 + DD + 8 dígitos = 12 total (sem o 9)
  if (digits.startsWith('55') && digits.length === 12) return true;

  // BR sem DDI: fixo = 10 dígitos
  if (digits.length === 10 && !digits.startsWith('55')) return true;

  return false;
}

/**
 * Retorna o link wa.me com o número normalizado.
 * Opcionalmente aceita uma mensagem de texto pré-preenchida.
 */
export function getWhatsAppUrl(phone: string, message?: string): string {
  const digits = normalize(phone);

  let fullNumber: string;
  if (digits.startsWith('351') || digits.startsWith('55')) {
    fullNumber = digits;
  } else if (digits.length === 9) {
    // PT sem DDI
    fullNumber = `351${digits}`;
  } else if (digits.length === 11 || digits.length === 10) {
    // BR sem DDI
    fullNumber = `55${digits}`;
  } else {
    fullNumber = digits;
  }

  const base = `https://wa.me/${fullNumber}`;
  if (message && message.trim()) {
    return `${base}?text=${encodeURIComponent(message.trim())}`;
  }
  return base;
}

/**
 * @deprecated Use getWhatsAppUrl() instead.
 */
export function getCleanedWhatsAppLink(phone: string): string {
  return getWhatsAppUrl(phone);
}

export function getCleanedPhoneLink(phone: string): string {
  const digits = normalize(phone);
  if (digits.startsWith('351') || digits.startsWith('55')) return `tel:+${digits}`;
  if (digits.length === 9) return `tel:+351${digits}`;
  if (digits.length === 11 || digits.length === 10) return `tel:+55${digits}`;
  return `tel:${digits}`;
}
