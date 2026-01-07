
import React, { useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastType = "success" | "error";

interface PremiumToastProps {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
    onClose: (id: string) => void;
}

export const PremiumToast: React.FC<PremiumToastProps> = ({
    id,
    type,
    title,
    description,
    onClose,
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger entry animation
        requestAnimationFrame(() => setIsVisible(true));
    }, []);

    const handleClose = () => {
        setIsVisible(false);
        // Wait for exit animation
        setTimeout(() => onClose(id), 300);
    };

    const isSuccess = type === "success";

    return (
        <div
            className={cn(
                "flex items-start gap-4 p-4 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.08)] w-full max-w-[380px] border transition-all duration-500 ease-out transform",
                isVisible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0",
                isSuccess ? "bg-[#CDEFD9] border-[#9FE0B6]" : "bg-[#F6CFCF] border-[#F1A6A6]"
            )}
            role="alert"
        >
            {/* Icon Wrapper */}
            <div
                className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    isSuccess ? "bg-[#9FE0B6] text-[#1F3D2B]" : "bg-[#F1A6A6] text-[#4A1C1C]"
                )}
            >
                {isSuccess ? <CheckCircle2 size={18} strokeWidth={2.5} /> : <AlertCircle size={18} strokeWidth={2.5} />}
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5">
                <h3
                    className={cn(
                        "text-sm font-bold leading-tight mb-1",
                        isSuccess ? "text-[#1F3D2B]" : "text-[#4A1C1C]"
                    )}
                >
                    {title}
                </h3>
                {description && (
                    <p
                        className={cn(
                            "text-xs font-medium leading-relaxed",
                            isSuccess ? "text-[#3F6F57]" : "text-[#7A3A3A]"
                        )}
                    >
                        {description}
                    </p>
                )}
            </div>

            {/* Close Button */}
            <button
                onClick={handleClose}
                className={cn(
                    "flex-shrink-0 p-1 rounded-full transition-colors",
                    isSuccess ? "text-[#3F6F57] hover:bg-[#9FE0B6]/50" : "text-[#7A3A3A] hover:bg-[#F1A6A6]/50"
                )}
                aria-label="Fechar notificação"
            >
                <X size={16} />
            </button>
        </div>
    );
};
