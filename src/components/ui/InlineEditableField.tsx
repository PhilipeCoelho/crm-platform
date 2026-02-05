import React, { useState, useEffect, useRef } from 'react';

interface InlineEditableFieldProps {
    value: string | number;
    onSave: (newValue: string) => void;
    type?: 'text' | 'number' | 'date' | 'select' | 'textarea' | 'currency';
    placeholder?: string;
    className?: string;
    inputClassName?: string;
    options?: { label: string; value: string }[];
    formatDisplay?: (value: any) => React.ReactNode;
}

export default function InlineEditableField({
    value,
    onSave,
    type = 'text',
    placeholder = 'Click to edit',
    className = '',
    inputClassName = '',
    options = [],
    formatDisplay
}: InlineEditableFieldProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState(value);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

    useEffect(() => {
        setTempValue(value);
    }, [value]);

    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleSave = () => {
        if (String(tempValue) !== String(value)) {
            onSave(String(tempValue));
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && type !== 'textarea') {
            handleSave();
        } else if (e.key === 'Escape') {
            setTempValue(value);
            setIsEditing(false);
        }
    };

    if (isEditing) {
        if (type === 'select') {
            return (
                <select
                    ref={inputRef as React.RefObject<HTMLSelectElement>}
                    className={`bg-background border border-primary rounded px-2 py-1 outline-none focus:ring-2 ring-primary/20 w-full ${inputClassName}`}
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                >
                    {options.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            );
        }

        if (type === 'textarea') {
            return (
                <textarea
                    ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                    className={`bg-background border border-primary rounded px-2 py-1 outline-none focus:ring-2 ring-primary/20 w-full min-h-[60px] resize-none ${inputClassName}`}
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    onBlur={handleSave}
                    onKeyDown={handleKeyDown}
                />
            );
        }

        return (
            <input
                ref={inputRef as React.RefObject<HTMLInputElement>}
                type={type === 'currency' ? 'number' : type}
                className={`bg-background border border-primary rounded px-2 py-1 outline-none focus:ring-2 ring-primary/20 w-full ${inputClassName}`}
                value={tempValue}
                onChange={(e) => setTempValue(e.target.value)}
                onBlur={handleSave}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
            />
        );
    }

    return (
        <div
            onClick={(e) => {
                e.stopPropagation(); // Prevent parent clicks (like card opening)
                setIsEditing(true);
            }}
            className={`cursor-pointer hover:bg-muted/50 rounded px-1 -mx-1 transition-colors border border-transparent hover:border-border/50 group flex items-center gap-2 ${className}`}
            title="Clique para editar"
        >
            <span className="truncate w-full">
                {formatDisplay ? formatDisplay(value) : (value || <span className="text-muted-foreground italic text-sm opacity-50">{placeholder}</span>)}
            </span>
        </div>
    );
}
