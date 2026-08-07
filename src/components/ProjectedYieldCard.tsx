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
                background: "linear-gradient(180deg, rgba(147,51,234,0.07) 0%, #F7F8FA 38%, #F7F8FA 100%)",
                backgroundBlendMode: "soft-light",
                backdropFilter: "blur(6px)",
                border: "none",
                outline: "1px solid rgba(255, 255, 255, 0.65)",
                boxShadow: "0 10px 30px rgba(30,41,59,0.08)",
            }}
            className={cn(
                "rounded-[24px] card-3d flex flex-col relative transition-all duration-300 animate-fade-in overflow-hidden",
                isMobile ? "p-4 min-h-[140px]" : "p-7 h-full min-h-[200px]"
            )}>
            <div className="flex items-start justify-between mb-1 w-full">
                <div className="flex items-center gap-3">
                    {/* Ícone esquerda */}
                    <div className={cn(
                      "items-center justify-center rounded-[12px] hidden md:flex",
                      "w-10 h-10 bg-purple-100/80 text-purple-600"
                    )}>
                        <DynamicIcon name="LineChart" className="w-5 h-5 opacity-90" />
                    </div>

                    {/* Título + Valor */}
                    <div className="flex flex-col gap-0">
                        <h2 className={cn("font-semibold tracking-wide -translate-y-[2px]", isMobile ? "text-[14px]" : "text-[16px]")} 
                            style={{ 
                                color: "hsl(var(--yield-darker))",
                                textShadow: "0px 1px 1px rgba(255,255,255,1), 0px 1px 2px rgba(0,0,0,0.02)"
                            }}
                        >
                            Projeção Mensal
                        </h2>
                        <p className={cn(
                            "font-extrabold text-slate-800 font-roboto leading-none tracking-tight -mt-1.5",
                            isMobile ? "text-[18px]" : "text-[22px]"
                        )}>
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
                <div className={cn("mt-2.5 flex-grow", isMobile && "mt-1.5")}>
                    {chartContent}
                </div>
            )}

            {/* Bottom Section: Integrated with the same logic as StatCard */}
            <div className="mt-4 flex justify-between items-end min-h-[40px]">
                {/* Left side: Annual Total */}
                <div className="flex items-end">
                    {annualTotalValue !== undefined && (
                        <div className="flex flex-col items-start gap-0.5">
                            <p 
                                className={cn("font-semibold leading-none font-roboto opacity-85", isMobile ? "text-[10px]" : "text-[11px]")}
                                style={{ color: "hsl(var(--yield-darker))" }}
                            >
                                {annualTotalLabel || "Projeção Anual"}
                            </p>
                            <p className={cn("font-extrabold text-slate-800 font-roboto leading-none tracking-tight", isMobile ? "text-[12px]" : "text-[13px]")}>
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
                                <p className={cn("font-semibold leading-none font-roboto opacity-85", isMobile ? "text-[10px]" : "text-[11px]")}>
                                    {projectedPatrimonyLabel || "Patrimônio Projetado"}
                                </p>
                            </div>
                            <p className={cn("font-extrabold text-slate-800 font-roboto leading-none tracking-tight mt-0.5", isMobile ? "text-[12px]" : "text-[13px]")}>
                                {formatCurrency(projectedPatrimonyValue)}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};
