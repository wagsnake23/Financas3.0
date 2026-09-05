import { Card } from "@/components/ui/card";
import DynamicIcon from "./DynamicIcon";
import { cn, formatCurrency } from "@/lib/utils";

interface ProjectedYieldCardProps {
    isMobile?: boolean;
    chartContent?: React.ReactNode;
    annualTotalValue?: number;
    annualTotalLabel?: string;
    mainStatValue: number;
    projectedPatrimonyValue?: number;
    projectedPatrimonyLabel?: string;
    topRightContent?: React.ReactNode;
}

export const ProjectedYieldCard = ({
    isMobile,
    chartContent,
    annualTotalValue,
    annualTotalLabel,
    mainStatValue,
    projectedPatrimonyValue,
    projectedPatrimonyLabel,
    topRightContent,
}: ProjectedYieldCardProps) => {
    return (
        <Card
            style={{
                background: "radial-gradient(circle at top right, rgba(255,255,255,.85), transparent 60%), linear-gradient(135deg, rgba(124,58,237,.20) 0%, rgba(124,58,237,.12) 35%, rgba(124,58,237,.06) 70%, transparent 100%), #FFFFFF",
                border: "1px solid rgba(255,255,255,0.85)",
                backgroundClip: "padding-box",
                outline: "none",
                boxShadow: "0 8px 24px rgba(124,58,237,0.10), 0 2px 6px rgba(124,58,237,0.05), inset 0 1px 0 rgba(255,255,255,.95)"
            }}
            className={cn(
                "rounded-[24px] flex flex-col relative transition-all duration-300 animate-fade-in overflow-hidden",
                isMobile ? "p-4 min-h-[140px]" : "p-7 h-full min-h-[200px]"
            )}>
            {/* Formas orgânicas temáticas de fundo */}
            <div aria-hidden="true" className="absolute inset-0 pointer-events-none overflow-hidden rounded-[24px]" style={{ zIndex: 0 }}>
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox={isMobile ? "0 0 400 180" : "0 0 500 220"}>
                    <defs>
                        <linearGradient id={isMobile ? "wave-grad-yield-mob" : "wave-grad-yield-desk"} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.75" />
                            <stop offset="100%" stopColor="#FFFFFF" stopOpacity={isMobile ? "0.15" : "0.12"} />
                        </linearGradient>
                    </defs>
                    {/* Curva suave superior */}
                    <path d={isMobile ? "M 60,0 C 150,55 240,65 380,15 L 400,0 Z" : "M 80,0 C 180,60 300,75 480,20 L 500,0 Z"} fill="rgba(255,255,255,0.5)" />
                    {/* Onda orgânica inferior */}
                    <path d={isMobile ? "M 0,180 Q 120,115 220,135 T 400,85 L 400,180 Z" : "M 0,220 Q 150,135 280,165 T 500,105 L 500,220 Z"} fill={`url(#${isMobile ? "wave-grad-yield-mob" : "wave-grad-yield-desk"})`} />
                </svg>
            </div>

            <div className="flex flex-col h-full w-full justify-between relative z-20">
                <div className="flex justify-between items-start mb-1 -mt-[2px] w-full">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col gap-0">
                            <div className="flex items-center gap-1.5 -translate-y-[2px]">
                                <div className="flex items-center justify-center">
                                    <DynamicIcon 
                                        name="LineChart" 
                                        className={cn(isMobile ? "w-[16px] h-[16px]" : "w-[18px] h-[18px]")} 
                                        style={{ color: "hsl(var(--yield-darker))" }} 
                                        strokeWidth={isMobile ? 2.5 : 2.5}
                                    />
                                </div>
                                <h2 
                                    className={cn("tracking-wide", isMobile ? "text-[15px]" : "text-[17px]")} 
                                    style={{ 
                                        fontWeight: 700,
                                        color: "hsl(var(--yield-darker))",
                                        textShadow: "0px 1px 1px rgba(255,255,255,1), 0px 1px 2px rgba(0,0,0,0.02)"
                                    }}
                                >
                                    Projeção Mensal
                                </h2>
                            </div>
                            <p className={cn(
                                "text-slate-800 font-roboto leading-none tracking-tight -mt-1.5",
                                isMobile ? "text-[18px]" : "text-[22px]"
                            )} style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
                                {formatCurrency(mainStatValue)}
                            </p>
                        </div>
                    </div>

                    {/* Navegação direita */}
                    {topRightContent && (
                        <div className="flex items-center">
                            {topRightContent}
                        </div>
                    )}
                </div>

                {chartContent && (
                    <div className={cn("mt-2.5 flex-grow", isMobile && "mt-1.5")} style={{ filter: "drop-shadow(0 4px 10px rgba(124,58,237,.18))" }}>
                        {chartContent}
                    </div>
                )}

                {/* Bottom Section: Integrated with the same logic as StatCard */}
                <div className="mt-4 flex justify-between items-end min-h-[40px]">
                    {/* Left side: Annual Total */}
                    <div className="flex items-end">
                        {annualTotalValue !== undefined && (
                            <div className="flex flex-col items-start gap-0 md:gap-0.5">
                                <p 
                                    className={cn("leading-none font-roboto opacity-90", isMobile ? "text-[12px]" : "text-[13px]")}
                                    style={{ fontWeight: 700, color: "hsl(var(--yield-darker))" }}
                                >
                                    {annualTotalLabel || "Projeção Anual"}
                                </p>
                                <p className={cn("text-slate-800 font-roboto leading-none tracking-tight", isMobile ? "text-[14px]" : "text-[15px]")} style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
                                    {formatCurrency(annualTotalValue)}
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Right side: Patrimony */}
                    <div className="flex items-end">
                        {projectedPatrimonyValue !== undefined && (
                            <div className="flex flex-col items-end gap-0.5 translate-y-[2px]">
                                <div className="flex items-center gap-1.5" style={{ color: "hsl(var(--yield-darker))" }}>
                                    <DynamicIcon name="Wallet" className="hidden md:block h-3 w-3 opacity-75" />
                                    <p className={cn("leading-none font-roboto opacity-90", isMobile ? "text-[12px]" : "text-[13px]")} style={{ fontWeight: 700 }}>
                                        {projectedPatrimonyLabel || "Patrimônio Projetado"}
                                    </p>
                                </div>
                                <p className={cn("text-slate-800 font-roboto leading-none tracking-tight", isMobile ? "mt-0 text-[14px]" : "mt-0.5 text-[15px]")} style={{ fontWeight: 800, letterSpacing: "-0.02em" }}>
                                    {formatCurrency(projectedPatrimonyValue)}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </Card>
    );
};
