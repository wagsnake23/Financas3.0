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
                background: "linear-gradient(180deg, rgba(168,85,247,0.16) 0%, rgba(168,85,247,0.02) 28%, #FCFDFE 38%, #FCFDFE 72%, #F2F5F8 82%, #F2F5F8 100%)",
                backgroundBlendMode: "soft-light",
                backdropFilter: "blur(6px)",
                border: "none",
                outline: "1px solid rgba(255, 255, 255, 0.65)",
                boxShadow: "0 12px 32px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.02)",
            }}
            className={cn(
                "rounded-[24px] card-3d flex flex-col relative transition-all duration-300 animate-fade-in overflow-hidden",
                isMobile ? "p-4 min-h-[140px]" : "p-7 h-full min-h-[200px]"
            )}>
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
                                className={cn("font-semibold tracking-wide", isMobile ? "text-[15px]" : "text-[17px]")} 
                                style={{ 
                                    color: "hsl(var(--yield-darker))",
                                    textShadow: "0px 1px 1px rgba(255,255,255,1), 0px 1px 2px rgba(0,0,0,0.02)"
                                }}
                            >
                                Projeção Mensal
                            </h2>
                        </div>
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
                        <div className="flex flex-col items-start gap-0 md:gap-0.5">
                            <p 
                                className={cn("font-medium leading-none font-roboto opacity-90", isMobile ? "text-[12px]" : "text-[13px]")}
                                style={{ color: "hsl(var(--yield-darker))" }}
                            >
                                {annualTotalLabel || "Projeção Anual"}
                            </p>
                            <p className={cn("font-extrabold text-slate-800 font-roboto leading-none tracking-tight", isMobile ? "text-[14px]" : "text-[15px]")}>
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
                                <p className={cn("font-medium leading-none font-roboto opacity-90", isMobile ? "text-[12px]" : "text-[13px]")}>
                                    {projectedPatrimonyLabel || "Patrimônio Projetado"}
                                </p>
                            </div>
                            <p className={cn("font-extrabold text-slate-800 font-roboto leading-none tracking-tight", isMobile ? "mt-0 text-[14px]" : "mt-0.5 text-[15px]")}>
                                {formatCurrency(projectedPatrimonyValue)}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};
