export interface Currency {
    code: string;
    locale: string;
    name: string;
    symbol: string;
}

export const currencies: Currency[] = [
    { code: 'EUR', locale: 'pt-PT', name: 'Euro', symbol: '€' },
    { code: 'BRL', locale: 'pt-BR', name: 'Real Brasileiro', symbol: 'R$' },
    { code: 'USD', locale: 'en-US', name: 'Dólar Americano', symbol: '$' },
    { code: 'GBP', locale: 'en-GB', name: 'Libra Esterlina', symbol: '£' },
    { code: 'JPY', locale: 'ja-JP', name: 'Iene Japonês', symbol: '¥' },
    { code: 'CNY', locale: 'zh-CN', name: 'Yuan Chinês', symbol: '¥' },
];
