"use client"

import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from './popover';
import { cn } from "@/lib/utils"

interface TimePickerProps {
    value: string;
    onChange: (value: string) => void;
    className?: string;
}

const QUICK_HOURS = ['07', '08', '09', '10', '11', '12', '14', '15', '16', '17', '18', '19'];
const QUICK_MINUTES = ['00', '15', '30', '45'];

export default function TimePicker({ value, onChange, className }: TimePickerProps) {
    const [inputValue, setInputValue] = useState(value);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setInputValue(value);
    }, [value]);

    const formatTimeLineValue = (val: string) => {
        // Remove non-digits
        const digits = val.replace(/\D/g, '').slice(0, 4);

        if (digits.length <= 2) return digits;

        let hh = digits.slice(0, 2);
        let mm = digits.slice(2);

        // Validate HH
        if (parseInt(hh) > 23) hh = '23';
        // Validate MM
        if (mm && parseInt(mm) > 59) mm = '59';

        return `${hh}:${mm}`;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let raw = e.target.value;
        const formatted = formatTimeLineValue(raw);
        setInputValue(formatted);

        if (formatted.length === 5) {
            onChange(formatted);
        }
    };

    const handleQuickHour = (hour: string) => {
        const currentMin = inputValue.includes(':') ? inputValue.split(':')[1] : '00';
        const newValue = `${hour}:${currentMin || '00'}`;
        setInputValue(newValue);
        onChange(newValue);
    };

    const handleQuickMinute = (minute: string) => {
        const currentHour = inputValue.includes(':') ? inputValue.split(':')[0] : '09';
        const newValue = `${currentHour || '09'}:${minute}`;
        setInputValue(newValue);
        onChange(newValue);
    };

    const setNow = () => {
        const now = new Date();
        const hh = now.getHours().toString().padStart(2, '0');
        const mm = now.getMinutes().toString().padStart(2, '0');
        const newValue = `${hh}:${mm}`;
        setInputValue(newValue);
        onChange(newValue);
        setIsOpen(false);
    };

    const clearTime = () => {
        setInputValue('');
        onChange('');
        setIsOpen(false);
    };

    return (
        <div className={cn("inline-block", className)}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <div
                    className="flex items-center gap-1.5 p-1.5 min-h-[32px] rounded-md border border-border bg-background/50 hover:bg-background transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary group cursor-text"
                    onClick={() => {
                        const input = document.getElementById('time-input-field');
                        input?.focus();
                    }}
                >
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            className="text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                            onClick={(e) => {
                                // Prevent the trigger from stealing focus but still toggle popover
                                e.stopPropagation();
                            }}
                        >
                            <Clock size={14} className={cn(isOpen && "text-primary")} />
                        </button>
                    </PopoverTrigger>

                    <input
                        id="time-input-field"
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        placeholder="00:00"
                        className="bg-transparent border-none outline-none text-[11px] font-bold w-12 text-foreground placeholder:text-muted-foreground/40"
                        onFocus={() => setIsOpen(true)}
                        autoComplete="off"
                    />
                </div>

                <PopoverContent
                    align="start"
                    sideOffset={8}
                    className="w-[300px] p-4 rounded-xl shadow-2xl border-border bg-card animate-in fade-in slide-in-from-top-2 duration-200"
                >
                    <div className="space-y-4">
                        {/* Header do Popover */}
                        <div className="flex items-center justify-between pb-2 border-b border-border/50">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">Selecionar Horário</span>
                            <div className="flex items-center gap-3">
                                <button
                                    type="button"
                                    onClick={setNow}
                                    className="text-[10px] font-bold text-primary hover:underline transition-colors"
                                >
                                    Agora
                                </button>
                                <button
                                    type="button"
                                    onClick={clearTime}
                                    className="text-[10px] font-bold text-muted-foreground hover:text-red-500 hover:underline transition-colors"
                                >
                                    Limpar
                                </button>
                            </div>
                        </div>

                        {/* Grid de Horas */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Horas</p>
                            </div>
                            <div className="grid grid-cols-6 gap-1">
                                {QUICK_HOURS.map(h => (
                                    <button
                                        key={h}
                                        type="button"
                                        onClick={() => handleQuickHour(h)}
                                        className={cn(
                                            "py-1.5 rounded text-[10px] font-bold transition-all border",
                                            inputValue.startsWith(h + ':') || inputValue === h
                                                ? "bg-primary text-white border-primary shadow-sm"
                                                : "bg-muted/20 hover:bg-muted text-muted-foreground border-transparent"
                                        )}
                                    >
                                        {h}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Grid de Minutos */}
                        <div className="space-y-2">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-tighter">Minutos</p>
                            <div className="grid grid-cols-4 gap-1">
                                {QUICK_MINUTES.map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => handleQuickMinute(m)}
                                        className={cn(
                                            "py-1.5 rounded text-[10px] font-bold transition-all border",
                                            inputValue.endsWith(':' + m)
                                                ? "bg-primary text-white border-primary shadow-sm"
                                                : "bg-muted/20 hover:bg-muted text-muted-foreground border-transparent"
                                        )}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
