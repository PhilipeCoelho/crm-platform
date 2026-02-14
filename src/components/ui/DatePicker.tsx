import * as React from "react";
import { format, parse, isValid, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { cn } from "@/lib/utils";

interface DatePickerProps {
    value?: string; // ISO format (YYYY-MM-DD)
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function DatePicker({ value, onChange, placeholder = "Selecionar data", className }: DatePickerProps) {
    const [inputValue, setInputValue] = React.useState("");
    const [isOpen, setIsOpen] = React.useState(false);
    const [currentMonth, setCurrentMonth] = React.useState(new Date());

    // Sync input with value
    React.useEffect(() => {
        if (value) {
            const date = new Date(value + "T12:00:00"); // Avoid timezone issues
            if (isValid(date)) {
                setInputValue(format(date, "dd/MM/yyyy"));
                setCurrentMonth(date);
            }
        } else {
            setInputValue("");
        }
    }, [value]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        let val = e.target.value.replace(/\D/g, "");
        if (val.length > 8) val = val.slice(0, 8);

        let formatted = val;
        if (val.length > 2) formatted = val.slice(0, 2) + "/" + val.slice(2);
        if (val.length > 4) formatted = formatted.slice(0, 5) + "/" + formatted.slice(5);

        setInputValue(formatted);

        if (val.length === 8) {
            const parsedDate = parse(formatted, "dd/MM/yyyy", new Date());
            if (isValid(parsedDate)) {
                onChange(format(parsedDate, "yyyy-MM-dd"));
                setCurrentMonth(parsedDate);
            }
        }
    };

    const handleSelectDate = (date: Date) => {
        onChange(format(date, "yyyy-MM-dd"));
        setIsOpen(false);
    };

    const renderHeader = () => {
        const years = [];
        const currentYear = getYear(new Date());
        for (let i = currentYear - 10; i <= currentYear + 10; i++) {
            years.push(i);
        }

        return (
            <div className="flex items-center justify-between px-2 py-2 mb-2">
                <button
                    onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                    className="p-1 hover:bg-muted rounded-md transition-colors"
                >
                    <ChevronLeft size={16} />
                </button>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold capitalize">
                        {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                    </span>
                </div>
                <button
                    onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                    className="p-1 hover:bg-muted rounded-md transition-colors"
                >
                    <ChevronRight size={16} />
                </button>
            </div>
        );
    };

    const renderDays = () => {
        const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        return (
            <div className="grid grid-cols-7 mb-2">
                {days.map(day => (
                    <div key={day} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                        {day}
                    </div>
                ))}
            </div>
        );
    };

    const renderCells = () => {
        const monthStart = startOfMonth(currentMonth);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;
        let formattedDate = "";

        const selectedDate = value ? new Date(value + "T12:00:00") : null;
        const today = new Date();

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                formattedDate = format(day, "d");
                const cloneDay = day;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const isToday = isSameDay(day, today);
                const isCurrentMonth = isSameMonth(day, monthStart);

                days.push(
                    <div
                        key={day.toString()}
                        className={cn(
                            "h-8 w-8 flex items-center justify-center text-xs rounded-md cursor-pointer transition-all m-auto",
                            !isCurrentMonth && "text-muted-foreground/30",
                            isCurrentMonth && "text-foreground hover:bg-muted",
                            isSelected && "bg-indigo-500 text-white hover:bg-indigo-600 font-semibold shadow-sm",
                            isToday && !isSelected && "border border-indigo-500/30 text-indigo-500 font-semibold"
                        )}
                        onClick={() => handleSelectDate(cloneDay)}
                    >
                        <span>{formattedDate}</span>
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div className="grid grid-cols-7 gap-1" key={day.toString()}>
                    {days}
                </div>
            );
            days = [];
        }
        return <div className="space-y-1">{rows}</div>;
    };

    return (
        <div className={cn("inline-block w-full", className)}>
            <Popover open={isOpen} onOpenChange={setIsOpen}>
                <div className="flex items-center gap-2 h-8 px-2 rounded-md border border-border/60 hover:border-indigo-500/30 transition-all focus-within:ring-1 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/30 bg-background/50">
                    <PopoverTrigger asChild>
                        <button type="button" className="text-slate-400 hover:text-indigo-500 transition-colors shrink-0">
                            <CalendarIcon size={14} />
                        </button>
                    </PopoverTrigger>
                    <input
                        type="text"
                        value={inputValue}
                        onChange={handleInputChange}
                        placeholder={placeholder}
                        className="bg-transparent border-none outline-none text-[12px] font-medium w-full text-foreground placeholder:text-muted-foreground/30 tabular-nums"
                    />
                </div>

                <PopoverContent className="w-auto p-3 rounded-xl shadow-2xl border-border bg-card animate-in fade-in zoom-in-95 duration-200" align="start">
                    <div className="w-[260px]">
                        {renderHeader()}
                        {renderDays()}
                        {renderCells()}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}
