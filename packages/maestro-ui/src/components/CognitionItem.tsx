
import { AlertCircle, ChevronRight } from 'lucide-react';

export interface CognitionItemProps {
    type: 'anomaly' | 'reflection' | 'pattern';
    title: string;
    desc: string;
    time: string;
}

export function CognitionItem({ type, title, desc, time }: CognitionItemProps) {
    const icon = type === 'anomaly' ? <AlertCircle className="text-destructive" /> : <ChevronRight className="text-primary" />;
    return (
        <div className="flex gap-4 p-4 bg-secondary/20 rounded-xl border border-border hover:border-primary/50 transition-colors group cursor-default">
            <div className="mt-1">{icon}</div>
            <div>
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors text-foreground">{title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-2 block">{time}</span>
            </div>
        </div>
    );
}
