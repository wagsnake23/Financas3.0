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
                backgroundColor: "#F5F3FF",
            }}
            className={cn(
                "rounded-3xl card-3d flex flex-col relative transition-all duration-300 animate-fade-in",
                "bg-gradient-to-br from-[#7C3AED]/8 to-[#7C3AED]/4 border-[#7C3AED]/20",
                "shadow-[inset_2px_2px_4px_rgba(0,0,0,0.05),_inset_-2px_-2px_4px_rgba(255,255,255,0.7)]",
                isMobile ? "p-1.5 min-h-[90px]" : "p-6 h-full min-h-[200px]"
            )}>
            {/* Top-right content (YearNavigatorCompact) */}
            {topRightContent && (
                <div
                    className={cn(
                        "absolute top-2 right-2",
                        isMobile ? "top-1 right-1" : "top-2 right-2"
                    )}
                >
                    {topRightContent}
                </div>
            )}

            <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                    <div className={cn(
                        "flex flex-col items-start",
                        isMobile ? "pl-2 -mt-1 -space-y-2" : "pl-2 -mt-1 -space-y-1"
                    )}>
                        <div className={cn("font-medium mb-1 text-[hsl(var(--yield-darker))] leading-none", isMobile ? "text-xs" : "text-sm", "font-roboto")}>
                            <div className="flex items-center gap-2">
                                <div className="rounded-xl shadow-sm p-1.5 -ml-1.5 translate-y-1 bg-yield/15 text-yield">
                                    <DynamicIcon name="LineChart" className="h-4 w-4" />
                                </div>
                                Projeção Mensal
                            </div>
                        </div>
                        <p className={cn(
                            "font-semibold leading-none text-slate-950 pl-[34px]",
                            isMobile ? "text-base" : "text-lg",
                            "font-roboto"
                        )}>
                            {formatCurrency(mainStatValue)}
                        </p>
                    </div>
                </div>
            </div>

            {chartContent && (
                <div className={cn("mt-4 flex-grow", isMobile && "mt-1")}>
                    {chartContent}
                </div>
            )}

            {/* Spacer to push bottom content down if needed, similar to StatCard childrens */}
            {isMobile && <div className="h-12 w-full" />}

            <div className={cn(
                "absolute flex items-center gap-2",
                isMobile ? "bottom-1.5 left-[14px]" : "bottom-4 left-8"
            )}>
                {/* 
                    StatCard generally puts 'Annual Total' here.
                    The original ProjectedYieldCard had an Icon here too.
                    StatCard doesn't usually have an icon at bottom left unless configured.
                    I will keep the icon if it fits but ensure positioning matches 'Total Anual' of StatCard.
                 */}
                {annualTotalValue !== undefined && (
                    <div className="flex flex-col">
                        <p className={cn("text-[hsl(var(--yield-darker))] mb-1 font-medium leading-none font-roboto", isMobile ? "text-xs" : "text-sm")}>
                            {annualTotalLabel || "Total Anual"}
                        </p>
                        <p className={cn("font-semibold text-slate-950 font-roboto leading-none", isMobile ? "text-base" : "text-lg")}>
                            {formatCurrency(annualTotalValue)}
                        </p>
                    </div>
                )}
            </div>

            {projectedPatrimonyValue !== undefined && (
                <div className={cn(
                    "absolute flex flex-col items-end text-right",
                    isMobile ? "bottom-1.5 right-[14px]" : "bottom-3 right-8"
                )}>
                    <p className={cn("text-[hsl(var(--yield-darker))] mb-1 font-medium leading-none font-roboto", isMobile ? "text-xs" : "text-sm")}>{projectedPatrimonyLabel || "Patrimônio Projetado"}</p>
                    <p className={cn("font-semibold text-slate-950 font-roboto leading-none", isMobile ? "text-base" : "text-lg")}>{formatCurrency(projectedPatrimonyValue)}</p>
                </div>
            )}
        </Card>
    );
};
