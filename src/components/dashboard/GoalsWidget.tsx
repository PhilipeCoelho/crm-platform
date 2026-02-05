import { useState, useEffect } from 'react';
import { Target, Edit2, Check, X } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';

export default function GoalsWidget() {
    const { deals } = useCRM();
    const [goalValue, setGoalValue] = useState(100000); // Default Goal
    const [isEditing, setIsEditing] = useState(false);
    const [tempValue, setTempValue] = useState('');

    // Load goal from localStorage
    useEffect(() => {
        const savedGoal = localStorage.getItem('user_monthly_goal');
        if (savedGoal) {
            setGoalValue(Number(savedGoal));
        }
    }, []);

    const saveGoal = () => {
        const val = Number(tempValue);
        if (!isNaN(val) && val > 0) {
            setGoalValue(val);
            localStorage.setItem('user_monthly_goal', String(val));
        }
        setIsEditing(false);
    };

    // Calculate Progress (Won Deals this Month)
    const currentRevenue = deals
        .filter(d => d.status === 'won') // Should filter by month too ideally, but keeping simple for MVP
        .reduce((sum, d) => sum + d.value, 0);

    const progress = Math.min((currentRevenue / goalValue) * 100, 100);

    return (
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[#191919] flex items-center gap-2">
                    <Target size={20} className="text-primary" />
                    Meta Mensal
                </h3>
                {!isEditing ? (
                    <button onClick={() => { setTempValue(String(goalValue)); setIsEditing(true); }} className="text-gray-400 hover:text-primary transition-colors">
                        <Edit2 size={16} />
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button onClick={saveGoal} className="text-green-600 hover:text-green-700">
                            <Check size={18} />
                        </button>
                        <button onClick={() => setIsEditing(false)} className="text-red-500 hover:text-red-600">
                            <X size={18} />
                        </button>
                    </div>
                )}
            </div>

            <div className="mb-4">
                {isEditing ? (
                    <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-gray-500">R$</span>
                        <input
                            type="number"
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="text-2xl font-bold text-gray-900 w-full outline-none border-b-2 border-primary/20 focus:border-primary"
                            autoFocus
                        />
                    </div>
                ) : (
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-gray-900">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentRevenue)}
                        </span>
                        <span className="text-sm text-gray-500">
                            / {new Intl.NumberFormat('pt-BR', { compactDisplay: 'short', notation: 'compact', style: 'currency', currency: 'BRL' }).format(goalValue)}
                        </span>
                    </div>
                )}
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                    className="bg-primary h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${progress}%` }}
                />
            </div>
            <p className="text-xs text-gray-500 mt-2 text-right">{progress.toFixed(0)}% atingido</p>
        </div>
    );
}
