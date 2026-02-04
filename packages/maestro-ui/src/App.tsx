import { useState, useEffect } from 'react';
import {
    Activity,
    Brain,
    Database,
    Zap,
    TrendingUp,
    Clock,
    ShieldCheck
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatCard } from './components/StatCard';
import { CognitionItem } from './components/CognitionItem';

const MOCK_DATA = [
    { time: '10:00', success: 92, p90: 450 },
    { time: '11:00', success: 95, p90: 420 },
    { time: '12:00', success: 88, p90: 890 }, // Spike
    { time: '13:00', success: 97, p90: 380 },
    { time: '14:00', success: 94, p90: 410 },
];

interface SystemStatus {
    online: boolean;
    version: string;
}

export default function App() {
    const [status, setStatus] = useState<SystemStatus | null>(null);

    // Mock initial status for demo purposes since API might not be ready
    useEffect(() => {
        // Simulating API call
        const timer = setTimeout(() => {
            setStatus({ online: true, version: '1.5.0' });
        }, 1000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen bg-background text-foreground font-sans p-8">
            {/* Header */}
            <header className="flex justify-between items-center mb-12">
                <div>
                    <h1 className="text-4xl font-serif font-bold text-primary">
                        Maestro Dashboard
                    </h1>
                    <p className="text-muted-foreground mt-2">Arqos Engine Intelligence Hub • v1.5.0</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-secondary/50 border border-border px-4 py-2 rounded-full">
                        <div className={`w-2 h-2 rounded-full ${status?.online ? 'bg-emerald-500 animate-pulse' : 'bg-destructive'}`} />
                        <span className="text-sm font-medium">{status?.online ? 'Engine Online' : 'Connecting...'}</span>
                    </div>
                    <button className="bg-primary hover:bg-primary/90 text-primary-foreground transition-colors px-6 py-2 rounded-lg font-semibold flex items-center gap-2">
                        <Zap className="w-4 h-4" /> Trigger Decision
                    </button>
                </div>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <StatCard
                    icon={<TrendingUp className="text-emerald-400" />}
                    label="Success Rate"
                    value="98.2%"
                    trend="+2.1%"
                />
                <StatCard
                    icon={<Clock className="text-accent" />}
                    label="P90 Latency"
                    value="412ms"
                    trend="-15ms"
                />
                <StatCard
                    icon={<Brain className="text-primary" />}
                    label="Active Heuristics"
                    value="24"
                    trend="v1.2.4"
                />
                <StatCard
                    icon={<Database className="text-amber-400" />}
                    label="Semantic Nodes"
                    value="1,402"
                    trend="+54 today"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Chart */}
                <section className="lg:col-span-2 bg-card/40 border border-border rounded-2xl p-6 backdrop-blur-xl">
                    <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2 text-foreground">
                        <Activity className="w-5 h-5 text-primary" /> Performance Analysis
                    </h2>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={MOCK_DATA}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--muted))" vertical={false} />
                                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
                                <YAxis stroke="hsl(var(--muted-foreground))" />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' }}
                                    itemStyle={{ color: 'hsl(var(--primary))' }}
                                />
                                <Line type="monotone" dataKey="p90" stroke="hsl(var(--accent))" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </section>

                {/* Cognition Loop Logs */}
                <section className="bg-card/40 border border-border rounded-2xl p-6 backdrop-blur-xl overflow-hidden">
                    <h2 className="text-xl font-serif font-bold mb-6 flex items-center gap-2 text-foreground">
                        <Brain className="w-5 h-5 text-primary" /> Cognition Loop
                    </h2>
                    <div className="space-y-4">
                        <CognitionItem
                            type="anomaly"
                            title="Latency Spike Detected"
                            desc="Tool 'MarketFetcher' P90 exceeded 1.2s."
                            time="2m ago"
                        />
                        <CognitionItem
                            type="reflection"
                            title="New Heuristic Proposed"
                            desc="Automatic backoff for Rate Limited API."
                            time="15m ago"
                        />
                        <CognitionItem
                            type="pattern"
                            title="Recurring Success Pattern"
                            desc="Context pinning improved accuracy by 12%."
                            time="1h ago"
                        />
                    </div>
                </section>
            </div>

            {/* Footer / Context */}
            <footer className="mt-12 flex justify-between items-center text-muted-foreground text-sm">
                <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1"><ShieldCheck className="w-4 h-4" /> AE0 Core Active</span>
                    <span className="flex items-center gap-1"><Brain className="w-4 h-4" /> AE1 Learning Active</span>
                </div>
                <p>© 2026 Arqos Engine • Maestro Fullstack Distribution</p>
            </footer>
        </div>
    );
}
