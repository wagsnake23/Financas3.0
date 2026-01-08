import React from 'react';
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from '@/lib/utils';

interface YearNavigatorCompactProps {
    year: number;
    onPreviousYear: () => void;
    onNextYear: () => void;
    isMobile?: boolean;
}

export const YearNavigatorCompact: React.FC<YearNavigatorCompactProps> = ({
    year,
    onPreviousYear,
    onNextYear,
    isMobile,
}) => {
    // Purple theme for projected yield
    const textColorClass = "text-[#7C3AED]";
    const hoverBgClass = "hover:bg-[#7C3AED]/10";
    const hoverTextColorClass = "hover:text-[#7C3AED]";

    return (
        <div className={cn(
            "flex items-center justify-center gap-0.5",
            isMobile ? "flex-row" : "flex-row"
        )}>
            <Button
                variant="ghost"
                size="icon"
                onClick={onPreviousYear}
                className={cn(
                    isMobile ? "h-6 w-6 p-0" : "h-7 w-7 p-0",
                    "font-bold",
                    textColorClass,
                    hoverBgClass,
                    hoverTextColorClass
                )}
            >
                <DynamicIcon name="ChevronLeft" className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
            </Button>
            <div className={cn("flex flex-col items-center justify-center", isMobile ? "px-1" : "px-2")}>
                <span className={cn("font-bold uppercase leading-none", textColorClass, isMobile ? "text-base" : "text-lg", "font-roboto")}>
                    {year}
                </span>
                <span className={cn("text-xs font-bold uppercase leading-none mt-0.5", textColorClass, "font-roboto")}>
                    31DEZ
                </span>
            </div>
            <Button
                variant="ghost"
                size="icon"
                onClick={onNextYear}
                className={cn(
                    isMobile ? "h-6 w-6 p-0" : "h-7 w-7 p-0",
                    "font-bold",
                    textColorClass,
                    hoverBgClass,
                    hoverTextColorClass
                )}
            >
                <DynamicIcon name="ChevronRight" className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} />
            </Button>
        </div>
    );
};
