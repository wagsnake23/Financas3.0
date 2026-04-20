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
                background: "linear-gradient(135deg, rgba(124, 58, 237, 0.09) 0%, #FFFFFF 20%, #FFFFFF 80%, rgba(124, 58, 237, 0.09) 100%)",
            }}
            className={cn(
                "rounded-3xl card-3d flex flex-col relative transition-all duration-300 animate-fade-in",
                "border-[#7C3AED]/20",
                "shadow-[inset_0_1px_0_rgba(255,255,255,1),_inset_0_-4px_12px_rgba(0,0,0,0.01),_inset_0_0_14px_rgba(124,58,237,0.09)]",
                isMobile ? "p-3 min-h-[140px]" : "p-6 h-full min-h-[200px]"
            )}>
            <div className="flex items-start justify-between mb-1 w-full">
                <div className="flex items-center gap-3">
                    {/* Ícone esquerda */}
                    <div className="rounded-xl shadow-sm p-1.5 bg-yield/15 text-yield">
                        <DynamicIcon name="LineChart" className="h-4 w-4" />
                    </div>

                    {/* Título + Valor */}
                    <div className="flex flex-col gap-1">
                        <h2 className={cn("font-[800] tracking-tight text-[hsl(var(--yield-darker))] leading-none", isMobile ? "text-[13px]" : "text-[14px]", "font-roboto")}>
                            Projeção Mensal
                        </h2>
                        <p className={cn(
                            "font-semibold leading-none text-slate-950 font-roboto",
                            isMobile ? "text-sm" : "text-base"
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
                <div className={cn("mt-4 flex-grow", isMobile && "mt-1")}>
                    {chartContent}
                </div>
            )}

            {/* Bottom Section: Integrated with the same logic as StatCard */}
            <div className="mt-4 flex justify-between items-end min-h-[40px]">
                {/* Left side: Annual Total */}
                <div className="flex items-end">
                    {annualTotalValue !== undefined && (
                        <div className="flex flex-col items-start gap-1">
                            <p className={cn("text-[hsl(var(--yield-darker))] font-medium leading-none font-roboto", isMobile ? "text-[11px]" : "text-[12px]")}>
                                {annualTotalLabel || "Projeção Anual"}
                            </p>
                            <p className={cn("font-semibold text-slate-950 font-roboto leading-none", isMobile ? "text-sm" : "text-base")}>
                                {formatCurrency(annualTotalValue)}
                            </p>
                        </div>
                    )}
                </div>

                {/* Right side: Patrimony */}
                <div className="flex items-end">
                    {projectedPatrimonyValue !== undefined && (
                        <div className="flex flex-col items-end gap-1">
                            <p className={cn("text-[hsl(var(--yield-darker))] font-medium leading-none font-roboto", isMobile ? "text-[11px]" : "text-[12px]")}>
                                {projectedPatrimonyLabel || "Patrimônio Projetado"}
                            </p>
                            <p className={cn("font-semibold text-slate-950 font-roboto leading-none", isMobile ? "text-sm" : "text-base")}>
                                {formatCurrency(projectedPatrimonyValue)}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
};
