import { useState } from 'react';
import { X, ChevronRight, ChevronLeft, Info, Target } from 'lucide-react';
import { useCRM } from '@/contexts/CRMContext';
import { Goal, GoalType, GoalPeriod, GoalOwnerType, GOAL_TYPES, GOAL_PERIODS, calculateGoalDates } from '@/config/goalConfig';

interface GoalBuilderProps {
    onSave: (goal: Omit<Goal, 'id' | 'createdAt' | 'lastModified'>) => void;
    onCancel: () => void;
}

type Step = 'type' | 'owner' | 'period' | 'target';

export default function GoalBuilder({ onSave, onCancel }: GoalBuilderProps) {
    const { users } = useCRM();

    // Estado do fluxo
    const [currentStep, setCurrentStep] = useState<Step>('type');
    const [goalType, setGoalType] = useState<GoalType | null>(null);
    const [ownerType, setOwnerType] = useState<GoalOwnerType>('user');
    const [ownerId, setOwnerId] = useState<string>('');
    const [period, setPeriod] = useState<GoalPeriod>('monthly');
    const [targetValue, setTargetValue] = useState<number>(0);
    const [goalName, setGoalName] = useState<string>('');

    // Validações
    const canProceedFromType = goalType !== null;
    const canProceedFromOwner = ownerId !== '';

    const canSave = goalName.trim() !== '' && targetValue > 0;

    const handleSave = () => {
        if (!canSave || !goalType) return;

        const dates = calculateGoalDates(period);


        const goal: Omit<Goal, 'id' | 'createdAt' | 'lastModified'> = {
            name: goalName,
            type: goalType,
            targetValue,
            period,
            ownerType,
            ownerId,
            startDate: dates.startDate,
            endDate: dates.endDate
        };

        onSave(goal);
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-lg border border-border max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-semibold text-foreground">Criar Meta</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {currentStep === 'type' && 'Escolha o tipo de meta'}
                            {currentStep === 'owner' && 'Defina o responsável'}
                            {currentStep === 'period' && 'Defina o período'}
                            {currentStep === 'target' && 'Defina o valor da meta'}
                        </p>
                    </div>
                    <button onClick={onCancel} className="p-1 hover:bg-muted rounded">
                        <X size={20} />
                    </button>
                </div>

                {/* Progress Steps */}
                <div className="px-6 py-4 border-b border-border">
                    <div className="flex items-center justify-between">
                        {['type', 'owner', 'period', 'target'].map((step, index) => (
                            <div key={step} className="flex items-center flex-1">
                                <div className={`flex items-center gap-2 ${currentStep === step ? 'text-primary' :
                                    ['type', 'owner', 'period', 'target'].indexOf(currentStep) > index ? 'text-foreground' : 'text-muted-foreground'
                                    }`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${currentStep === step ? 'bg-primary text-primary-foreground' :
                                        ['type', 'owner', 'period', 'target'].indexOf(currentStep) > index ? 'bg-muted text-foreground' : 'bg-muted text-muted-foreground'
                                        }`}>
                                        {index + 1}
                                    </div>
                                    <span className="text-sm font-medium hidden sm:block">
                                        {step === 'type' && 'Tipo'}
                                        {step === 'owner' && 'Responsável'}
                                        {step === 'period' && 'Período'}
                                        {step === 'target' && 'Valor'}
                                    </span>
                                </div>
                                {index < 3 && (
                                    <div className={`flex-1 h-0.5 mx-2 ${['type', 'owner', 'period', 'target'].indexOf(currentStep) > index ? 'bg-primary' : 'bg-muted'
                                        }`} />
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {/* ETAPA 1: TIPO DE META */}
                    {currentStep === 'type' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                                <Info size={20} className="text-primary shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold mb-1">Tipos de metas fixos</p>
                                    <p>Escolha um dos tipos predefinidos. Cada meta está sempre ligada a uma métrica específica do CRM.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {GOAL_TYPES.map((type) => (
                                    <button
                                        key={type.id}
                                        onClick={() => setGoalType(type.id)}
                                        className={`p-4 border rounded-lg text-left transition-all ${goalType === type.id
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:bg-muted'
                                            }`}
                                    >
                                        <div className="flex items-start gap-3">
                                            <Target size={20} className="text-primary mt-0.5" />
                                            <div className="flex-1">
                                                <p className="font-semibold text-sm mb-1">{type.name}</p>
                                                <p className="text-xs text-muted-foreground mb-2">{type.description}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs px-2 py-0.5 bg-muted rounded">
                                                        {type.category}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground">
                                                        Unidade: {type.unit}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ETAPA 2: RESPONSÁVEL */}
                    {currentStep === 'owner' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                                <Info size={20} className="text-primary shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold mb-1">Defina o responsável</p>
                                    <p>A meta pode ser atribuída a um usuário individual ou a uma equipe.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Tipo de responsável</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => {
                                            setOwnerType('user');
                                            setOwnerId('');
                                        }}
                                        className={`p-4 border rounded-lg text-left transition-all ${ownerType === 'user'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:bg-muted'
                                            }`}
                                    >
                                        <p className="font-semibold text-sm">Usuário Individual</p>
                                        <p className="text-xs text-muted-foreground mt-1">Meta pessoal</p>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setOwnerType('team');
                                            setOwnerId('');
                                        }}
                                        className={`p-4 border rounded-lg text-left transition-all ${ownerType === 'team'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:bg-muted'
                                            }`}
                                    >
                                        <p className="font-semibold text-sm">Equipe</p>
                                        <p className="text-xs text-muted-foreground mt-1">Meta coletiva</p>
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    {ownerType === 'user' ? 'Selecione o usuário' : 'Selecione a equipe'}
                                </label>
                                <select
                                    value={ownerId}
                                    onChange={(e) => setOwnerId(e.target.value)}
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                                >
                                    <option value="">Selecione...</option>
                                    {ownerType === 'user' && users.map(user => (
                                        <option key={user.id} value={user.id}>{user.name}</option>
                                    ))}
                                    {ownerType === 'team' && (
                                        <>
                                            <option value="sales">Equipe de Vendas</option>
                                            <option value="marketing">Equipe de Marketing</option>
                                            <option value="support">Equipe de Suporte</option>
                                        </>
                                    )}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* ETAPA 3: PERÍODO */}
                    {currentStep === 'period' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                                <Info size={20} className="text-primary shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold mb-1">Período da meta</p>
                                    <p>Escolha se a meta é mensal, trimestral ou anual. O período atual será usado automaticamente.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                {GOAL_PERIODS.map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setPeriod(p.id)}
                                        className={`p-4 border rounded-lg text-left transition-all ${period === p.id
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:bg-muted'
                                            }`}
                                    >
                                        <p className="font-semibold text-sm mb-1">{p.name}</p>
                                        <p className="text-xs text-muted-foreground">{p.description}</p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ETAPA 4: VALOR DA META */}
                    {currentStep === 'target' && (
                        <div className="space-y-4">
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                                <Info size={20} className="text-primary shrink-0 mt-0.5" />
                                <div className="text-sm text-blue-800">
                                    <p className="font-semibold mb-1">Defina o valor da meta</p>
                                    <p>Insira o valor que deseja atingir no período selecionado.</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">Nome da meta *</label>
                                <input
                                    type="text"
                                    value={goalName}
                                    onChange={(e) => setGoalName(e.target.value)}
                                    placeholder="Ex: Meta de Vendas Q1 2026"
                                    className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-foreground mb-2">
                                    Valor da meta *
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={targetValue}
                                        onChange={(e) => setTargetValue(Number(e.target.value))}
                                        min="0"
                                        step={goalType && GOAL_TYPES.find(t => t.id === goalType)?.isRevenue ? "100" : "1"}
                                        placeholder="0"
                                        className="w-full px-3 py-2 border border-border rounded-lg bg-background"
                                    />
                                    {goalType && (
                                        <span className="absolute right-3 top-2 text-sm text-muted-foreground">
                                            {GOAL_TYPES.find(t => t.id === goalType)?.unit}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {goalType && (
                                <div className="bg-muted rounded-lg p-4">
                                    <p className="text-sm font-medium text-foreground mb-2">Resumo da meta</p>
                                    <div className="space-y-1 text-sm text-muted-foreground">
                                        <p><span className="font-medium">Tipo:</span> {GOAL_TYPES.find(t => t.id === goalType)?.name}</p>
                                        <p><span className="font-medium">Período:</span> {GOAL_PERIODS.find(p => p.id === period)?.name}</p>
                                        <p><span className="font-medium">Responsável:</span> {ownerType === 'user' ? 'Usuário' : 'Equipe'}</p>
                                        <p><span className="font-medium">Meta:</span> {targetValue.toLocaleString('pt-BR')} {GOAL_TYPES.find(t => t.id === goalType)?.unit}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border flex justify-between">
                    <button
                        onClick={() => {
                            if (currentStep === 'type') {
                                onCancel();
                            } else if (currentStep === 'owner') {
                                setCurrentStep('type');
                            } else if (currentStep === 'period') {
                                setCurrentStep('owner');
                            } else if (currentStep === 'target') {
                                setCurrentStep('period');
                            }
                        }}
                        className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted"
                    >
                        <ChevronLeft size={16} />
                        {currentStep === 'type' ? 'Cancelar' : 'Voltar'}
                    </button>

                    <div className="flex gap-2">
                        {currentStep !== 'target' && (
                            <button
                                onClick={() => {
                                    if (currentStep === 'type' && canProceedFromType) {
                                        setCurrentStep('owner');
                                    } else if (currentStep === 'owner' && canProceedFromOwner) {
                                        setCurrentStep('period');
                                    } else if (currentStep === 'period') {
                                        setCurrentStep('target');
                                    }
                                }}
                                disabled={
                                    (currentStep === 'type' && !canProceedFromType) ||
                                    (currentStep === 'owner' && !canProceedFromOwner)
                                }
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Próximo
                                <ChevronRight size={16} />
                            </button>
                        )}

                        {currentStep === 'target' && (
                            <button
                                onClick={handleSave}
                                disabled={!canSave}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Criar Meta
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
