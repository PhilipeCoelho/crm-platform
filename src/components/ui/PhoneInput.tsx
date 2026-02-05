import React, { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Country {
    code: string;
    name: string;
    dial_code: string;
    flag: string;
}

// Comprehensive list of Europe + Brazil - Sorted Alphabetically
const countries: Country[] = [
    { code: 'DE', name: 'Alemanha', dial_code: '+49', flag: '🇩🇪' },
    { code: 'AT', name: 'Áustria', dial_code: '+43', flag: '🇦🇹' },
    { code: 'BE', name: 'Bélgica', dial_code: '+32', flag: '🇧🇪' },
    { code: 'BR', name: 'Brasil', dial_code: '+55', flag: '🇧🇷' },
    { code: 'DK', name: 'Dinamarca', dial_code: '+45', flag: '🇩🇰' },
    { code: 'ES', name: 'Espanha', dial_code: '+34', flag: '🇪🇸' },
    { code: 'FI', name: 'Finlândia', dial_code: '+358', flag: '🇫🇮' },
    { code: 'FR', name: 'França', dial_code: '+33', flag: '🇫🇷' },
    { code: 'NL', name: 'Holanda', dial_code: '+31', flag: '🇳🇱' },
    { code: 'IE', name: 'Irlanda', dial_code: '+353', flag: '🇮🇪' },
    { code: 'IT', name: 'Itália', dial_code: '+39', flag: '🇮🇹' },
    { code: 'NO', name: 'Noruega', dial_code: '+47', flag: '🇳🇴' },
    { code: 'PT', name: 'Portugal', dial_code: '+351', flag: '🇵🇹' },
    { code: 'GB', name: 'Reino Unido', dial_code: '+44', flag: '🇬🇧' },
    { code: 'SE', name: 'Suécia', dial_code: '+46', flag: '🇸🇪' },
    { code: 'CH', name: 'Suíça', dial_code: '+41', flag: '🇨🇭' },
];

interface Props {
    value: string;
    onChange: (value: string) => void;
}

export default function PhoneInput({ value, onChange }: Props) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedCountry, setSelectedCountry] = useState<Country>(countries.find(c => c.code === 'BR') || countries[0]);
    const [searchTerm, setSearchTerm] = useState('');

    // Format phone number with spaces for readability (e.g. 964 094 865)
    const formatPhoneNumber = (input: string) => {
        // Remove non-digit chars
        const cleaned = input.replace(/\D/g, '');

        // Group by 3 digits
        const parts = cleaned.match(/.{1,3}/g);
        return parts ? parts.join(' ') : cleaned;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const rawValue = e.target.value;
        // We only want to format the user part, but we receive the whole string potentially?
        // Actually the parent component usually holds the state "raw" or "formatted"?
        // The user wants to SEE formatted numbers.
        // Let's format and pass up.

        // Allow spaces and numbers
        if (!/^[0-9\s]*$/.test(rawValue)) return;

        onChange(formatPhoneNumber(rawValue));
    };

    const handleCountrySelect = (country: Country) => {
        setSelectedCountry(country);
        setIsOpen(false);
        setSearchTerm(''); // Clear search term when a country is selected
    };

    const filteredCountries = countries.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.dial_code.includes(searchTerm)
    );

    return (
        <div className="relative w-full">
            <div className="flex border border-input rounded-md bg-background focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent">
                {/* Country Selector Trigger */}
                <button
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-1 px-2 py-2 border-r border-border hover:bg-muted/50 rounded-l-md transition-colors shrink-0"
                >
                    <span className="text-xl leading-none">{selectedCountry.flag}</span>
                    <span className="text-sm font-medium ml-1">{selectedCountry.dial_code}</span>
                    <ChevronDown size={14} className="text-muted-foreground ml-1" />
                </button>

                {/* Phone Number Input */}
                <input
                    type="tel"
                    className="flex-1 w-full px-3 py-2 bg-transparent text-sm focus:outline-none min-w-0" // min-w-0 fixes flex child overflow
                    placeholder="000 000 000"
                    value={value}
                    onChange={handleChange}
                />
            </div>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-72 max-h-60 overflow-y-auto bg-popover border border-border rounded-md shadow-md z-50 flex flex-col">
                    <div className="p-2 sticky top-0 bg-popover border-b border-border z-10">
                        <div className="relative">
                            <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                className="w-full pl-8 pr-2 py-1 text-xs border border-border rounded-sm bg-background"
                                placeholder="Buscar país..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    {filteredCountries.map((country) => (
                        <button
                            key={country.code}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-3 transition-colors shrink-0"
                            onClick={() => handleCountrySelect(country)}
                        >
                            <span className="text-xl">{country.flag}</span>
                            <span className="text-muted-foreground w-12">{country.dial_code}</span>
                            <span className="truncate">{country.name}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Backdrop to close */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-transparent"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
}
