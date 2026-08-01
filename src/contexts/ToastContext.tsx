
import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { PremiumToast, ToastType } from "@/components/ui/PremiumToast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ToastData {
    id: string;
    type: ToastType;
    title: string;
    description?: string;
}

interface ToastContextType {
    showSuccessToast: (title: string, description?: string) => void;
    showErrorToast: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<ToastData[]>([]);
    const isMobile = useIsMobile();

    const addToast = useCallback((type: ToastType, title: string, description?: string) => {
        const id = Math.random().toString(36).substring(2, 9);
        const newToast = { id, type, title, description };

        setToasts((prev) => [...prev, newToast]);

        // Auto dismiss after 4 seconds
        setTimeout(() => {
            removeToast(id);
        }, 4000);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const showSuccessToast = useCallback(
        (title: string, description?: string) => addToast("success", title, description),
        [addToast]
    );

    const showErrorToast = useCallback(
        (title: string, description?: string) => addToast("error", title, description),
        [addToast]
    );

    return (
        <ToastContext.Provider value={{ showSuccessToast, showErrorToast }}>
            {children}

            {/* Toast Viewport/Container */}
            <div
                className={cn(
                    "fixed z-[100] flex flex-col gap-3 pointer-events-none",
                    isMobile
                        ? "bottom-[100px] left-4 right-4 items-center"
                        : "bottom-[80px] right-8 items-end w-auto"
                )}
            >
                {toasts.map((toast) => (
                    <div key={toast.id} className="pointer-events-auto w-full max-w-[380px]">
                        <PremiumToast
                            id={toast.id}
                            type={toast.type}
                            title={toast.title}
                            description={toast.description}
                            onClose={removeToast}
                        />
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};

export const useToast = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
};
