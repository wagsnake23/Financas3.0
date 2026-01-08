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
        <Card className={cn(
            "p-6 animate-fade-in rounded-3xl card-3d bg-[#F0E7FF] flex flex-col relative",
            isMobile ? "p-1.5 min-h-[162px]" : "h-full min-h-[200px]"
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
                    <div className={cn(isMobile && "pl-2 pt-1", !isMobile && "flex flex-col gap-0.5")}>
                        <p className={cn("text-sm font-semibold text-muted-foreground mb-1", isMobile && "text-xs", "font-roboto")}>Projeção Mensal</p>
                        <p className={cn("text-3xl font-bold text-[#7C3AED]", isMobile ? "text-sm" : "text-xl", "font-roboto", "leading-none")}>{formatCurrency(mainStatValue)}</p>
                    </div>
                </div>
            </div>

            {chartContent && (
                <div className={cn("mt-4 flex-grow", isMobile && "mt-1")}>
                    {chartContent}
                </div>
            )}

            {isMobile && <div className="h-9 mt-0 invisible" aria-hidden="true" />}

            <div className={cn(
                "absolute flex items-center gap-2",
                isMobile ? "bottom-2 left-[14px]" : "bottom-4 left-8"
            )}>
                <div className={cn(
                    "rounded-xl bg-[#7C3AED]/10 p-2 text-[#7C3AED]",
                    isMobile ? "p-1" : "p-2"
                )}>
                    <DynamicIcon name="LineChart" className={cn(isMobile ? "h-4 w-4" : "h-6 w-6")} />
                </div>

                {annualTotalValue !== undefined && (
                    <div className="flex flex-col">
                        <p className="text-xs text-muted-foreground leading-none font-roboto">{annualTotalLabel || "Total Anual"}</p>
                        <p className="text-sm font-bold text-[#7C3AED] font-roboto">{formatCurrency(annualTotalValue)}</p>
                    </div>
                )}
            </div>

            {projectedPatrimonyValue !== undefined && (
                <div className={cn(
                    "absolute flex flex-col items-end text-right",
                    isMobile ? "bottom-2 right-[14px]" : "bottom-4 right-8"
                )}>
                    <p className="text-xs text-muted-foreground leading-none font-roboto">{projectedPatrimonyLabel || "Patrimônio Projetado"}</p>
                    <p className="text-sm font-bold text-[#7C3AED] font-roboto">{formatCurrency(projectedPatrimonyValue)}</p>
                </div>
            )}
        </Card>
    );
};
