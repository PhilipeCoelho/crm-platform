import React, { useState } from 'react';
import { CheckCircle, Loader2, AlertCircle, ArrowRight, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';

interface Props {
    onLogin: () => void;
}

// Shared layout wrapper for consistent premium feel
const Layout = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen flex w-full bg-background relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />

        <div className="w-full flex">
            {/* Left Side: Form */}
            <div className="w-full lg:w-1/2 flex items-center justify-center p-8 lg:p-16 relative z-10">
                <div className="w-full max-w-md space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
                    {children}
                </div>
            </div>

            {/* Right Side: Hero Visual */}
            <div className="hidden lg:flex w-1/2 relative bg-muted/20 backdrop-blur-3xl border-l border-white/10 items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
                <div className="relative z-10 max-w-lg text-center p-12">
                    <div className="w-20 h-20 bg-gradient-to-tr from-primary to-purple-500 rounded-2xl mx-auto mb-8 shadow-2xl flex items-center justify-center text-white rotate-12 transform hover:rotate-0 transition-all duration-500">
                        <Sparkles size={40} className="text-white" />
                    </div>
                    <h2 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-600">
                        Gestão Inteligente de Leads
                    </h2>
                    <p className="text-lg text-muted-foreground leading-relaxed">
                        Transforme sua maneira de vender com um CRM focado em simplicidade e performance. Organize, acompanhe e feche mais negócios.
                    </p>

                    {/* Floating Cards Effect */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full opacity-30 pointer-events-none">
                        <div className="absolute top-[20%] left-[10%] w-32 h-20 bg-card border border-border/50 rounded-lg shadow-xl rotate-[-12deg]" />
                        <div className="absolute bottom-[20%] right-[10%] w-40 h-24 bg-card border border-border/50 rounded-lg shadow-xl rotate-[6deg]" />
                    </div>
                </div>
            </div>
        </div>
    </div>
);


export default function Login({ onLogin }: Props) {
    const { signIn, signUp, loading: authLoading } = useSupabaseAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsLoading(true);

        try {
            if (isLogin) {
                const { error } = await signIn({ email, password });
                if (error) throw error;
                // onLogin will be triggered by the Auth State Change listener in App.tsx ideally,
                // but for now we click it here to ensure UI transition if props are used.
                onLogin();
            } else {
                const { error } = await signUp({
                    email,
                    password,
                    options: {
                        data: {
                            name: name,
                        }
                    }
                });
                if (error) throw error;
                setSuccessMessage('Conta criada! Verifique seu email para confirmar.');
                setIsLogin(true);
            }
        } catch (err: any) {
            console.error(err);
            setError(err.message === 'Invalid login credentials'
                ? 'Email ou senha incorretos.'
                : err.message || 'Ocorreu um erro. Tente novamente.');
        } finally {
            setIsLoading(false);
        }
    };

    if (authLoading) {
        return (
            <Layout>
                <div className="flex justify-center items-center h-64">
                    <Loader2 className="w-10 h-10 text-primary animate-spin" />
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="space-y-2 mb-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
                    <Sparkles size={12} />
                    <span>CRM Platform v1.0</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight text-foreground">
                    {isLogin ? 'Bem-vindo de volta' : 'Comece agora grátis'}
                </h1>
                <p className="text-muted-foreground text-lg">
                    {isLogin ? 'Entre com seus dados para acessar.' : 'Crie sua conta em segundos e organize suas vendas.'}
                </p>
            </div>

            {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3 text-sm text-destructive animate-in slide-in-from-top-2">
                    <AlertCircle size={18} />
                    {error}
                </div>
            )}

            {successMessage && (
                <div className="bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg p-4 flex items-center gap-3 text-sm text-green-700 dark:text-green-300 animate-in slide-in-from-top-2">
                    <CheckCircle size={18} />
                    {successMessage}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground ml-1">Nome Completo</label>
                        <input
                            className="flex h-12 w-full rounded-xl border border-input bg-muted/30 px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 transition-all hover:bg-muted/50 focus:bg-background"
                            placeholder="Seu Nome"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required={!isLogin}
                        />
                    </div>
                )}

                <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground ml-1">Email</label>
                    <input
                        className="flex h-12 w-full rounded-xl border border-input bg-muted/30 px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 transition-all hover:bg-muted/50 focus:bg-background"
                        placeholder="seu@email.com"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>

                <div className="space-y-1.5">
                    <div className="flex justify-between items-center ml-1">
                        <label className="text-sm font-medium text-foreground">Senha</label>
                        {isLogin && (
                            <button type="button" className="text-xs font-medium text-primary hover:text-primary/80 transition-colors">Esqueceu a senha?</button>
                        )}
                    </div>
                    <div className="relative">
                        <input
                            className="flex h-12 w-full rounded-xl border border-input bg-muted/30 px-4 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 transition-all hover:bg-muted/50 focus:bg-background pr-10"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <button
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-12 rounded-xl font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 mt-4 flex items-center justify-center gap-2 group"
                    type="submit"
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <>
                            <Loader2 size={20} className="animate-spin" /> Processando...
                        </>
                    ) : (
                        <>
                            {isLogin ? 'Entrar na Plataforma' : 'Criar Conta Grátis'}
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>
            </form>

            <div className="text-center pt-4">
                <p className="text-sm text-muted-foreground">
                    {isLogin ? 'Ainda não é membro? ' : 'Já possui cadastro? '}
                    <button
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                            setSuccessMessage('');
                        }}
                        className="text-primary hover:text-primary/80 font-bold transition-colors"
                    >
                        {isLogin ? 'Crie uma conta' : 'Fazer Login'}
                    </button>
                </p>
            </div>
        </Layout >
    );
}
