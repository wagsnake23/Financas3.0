import React from "react";
import { cn } from "@/lib/utils"; // Importar cn

interface FooterProps {
  isMobile?: boolean;
  className?: string; // Adicionado a prop className
}

export const Footer = ({ isMobile, className }: FooterProps) => { // Receber className
  return (
    <footer className={cn("py-6", isMobile ? "text-xs" : "text-sm", className)}> {/* Aplicar className */}
      <div className="container mx-auto px-4 text-center text-muted-foreground">
        <p>© 2025 Minhas Finanças - By Vagner</p>
      </div>
    </footer>
  );
};