import React from "react";
import { cn } from "@/lib/utils"; // Importar cn

interface FooterProps {
  isMobile?: boolean;
}

export const Footer = ({ isMobile }: FooterProps) => {
  return (
    <footer className={cn("py-6", isMobile ? "text-xs" : "text-sm")}> {/* Removido mt-12, adicionado tamanho de fonte condicional */}
      <div className="container mx-auto px-4 text-center text-muted-foreground">
        <p>© 2025 Minhas Finanças - By Vagner</p>
      </div>
    </footer>
  );
};