
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
                isSuccess ? "bg-[#F0FDF4] border-[#BBF7D0]" : "bg-[#FEF2F2] border-[#FECACA]"
            )}
            role="alert"
        >
            {/* Icon Wrapper */}
            <div
                className={cn(
                    "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
                    isSuccess ? "bg-[#DCFCE7] text-[#166534]" : "bg-[#FEE2E2] text-[#991B1B]"
                )}
            >
                {isSuccess ? <CheckCircle2 size={18} strokeWidth={2.5} /> : <AlertCircle size={18} strokeWidth={2.5} />}
            </div>

            {/* Content */}
            <div className="flex-1 pt-0.5">
                <h3
                    className={cn(
                        "text-sm font-bold leading-tight mb-1",
                        isSuccess ? "text-[#166534]" : "text-[#991B1B]"
                    )}
                >
                    {title}
                </h3>
                {description && (
                    <p
                        className={cn(
                            "text-xs font-medium leading-relaxed",
                            isSuccess ? "text-[#15803D]" : "text-[#B91C1C]"
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
                    isSuccess ? "text-[#15803D] hover:bg-[#DCFCE7]/50" : "text-[#B91C1C] hover:bg-[#FEE2E2]/50"
                )}
                aria-label="Fechar notificação"
            >
                <X size={16} />
            </button>
        </div>
    );
};
