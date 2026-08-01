import React from 'react';
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
    const currentStyle = {
        containerVars: { "--cor-topo": "#F5F3FF", "--cor-base": "#EDE9FE" },
        border: "border-violet-200",
        text: "text-[#7C3AED]",
        buttonGradient: "linear-gradient(180deg, #A78BFA 0%, #7C3AED 100%)"
    };

    return (
        <div
            className={cn(
                "btn-3d flex items-center justify-between px-1 rounded-2xl transition-all h-9 w-[135px] border shadow-none cursor-default",
                currentStyle.border
            )}
            style={{
                ...currentStyle.containerVars,
                boxShadow: "inset 0px 1px 2px rgba(255, 255, 255, 0.25), inset 0px -2px 3px rgba(0, 0, 0, 0.1)"
            } as any}
        >
            <button
                onClick={(e) => { e.stopPropagation(); onPreviousYear(); }}
                className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-sm shrink-0"
                style={{
                    background: currentStyle.buttonGradient,
                    boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 1px rgba(0, 0, 0, 0.1)"
                }}
            >
                <DynamicIcon name="ChevronLeft" className="h-3.5 w-3.5" strokeWidth={4} />
            </button>

            <span className={cn(
                "text-[12px] font-black px-1 flex-1 text-center uppercase tracking-tight pt-[1px] whitespace-nowrap",
                currentStyle.text
            )}>
                {year}
            </span>

            <button
                onClick={(e) => { e.stopPropagation(); onNextYear(); }}
                className="text-white hover:opacity-90 rounded-full p-0 h-6 w-6 flex items-center justify-center transition-all shadow-sm shrink-0"
                style={{
                    background: currentStyle.buttonGradient,
                    boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 1px rgba(0, 0, 0, 0.1)"
                }}
            >
                <DynamicIcon name="ChevronRight" className="h-3.5 w-3.5" strokeWidth={4} />
            </button>
        </div>
    );
};
