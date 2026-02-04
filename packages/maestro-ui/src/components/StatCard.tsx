
import { ReactNode } from 'react';

export interface StatCardProps {
    icon: ReactNode;
    label: string;
    value: string;
    trend: string;
}

export function StatCard({ icon, label, value, trend }: StatCardProps) {
    const isPositive = trend.startsWith('+');
    return (
        <div className="bg-card/40 border border-border p-6 rounded-2xl backdrop-blur-xl">
            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-secondary/50 rounded-lg [&>svg]:text-foreground">{icon}</div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
                    {trend}
                </span>
            </div>
            <p className="text-muted-foreground text-sm font-medium">{label}</p>
            <p className="text-3xl font-bold mt-1 text-foreground">{value}</p>
        </div>
    );
}
