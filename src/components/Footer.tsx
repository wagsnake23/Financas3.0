import React from "react";
import { cn } from "@/lib/utils";
import DynamicIcon from "./DynamicIcon"; // Importar DynamicIcon
import { User } from "@supabase/supabase-js"; // Importar o tipo User do Supabase

interface FooterProps {
  isMobile?: boolean;
  className?: string;
  user: User | null; // Adicionado a prop user
}

export const Footer = ({ isMobile, className, user }: FooterProps) => {
  const userName = user?.user_metadata?.nome?.trim() || "Usuário não identificado"; // Acessar o nome do user_metadata
  const mensagem = `Olá Vagner! Meu nome é ${userName} e estou usando a aplicação Minhas Finanças. Preciso de ajuda!`;
  const linkWhatsApp = `https://wa.me/5514991188921?text=${encodeURIComponent(mensagem)}`;

  return (
    <footer className={cn(
      "py-6 text-center text-muted-foreground font-roboto", // Centralizado e fonte Roboto
      isMobile ? "text-xs" : "text-sm",
      className
    )}>
      © 2025 Minhas Finanças — By{" "}
      <a
        href={linkWhatsApp}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-semibold hover:opacity-90 transition-opacity duration-200"
        style={{ color: "#25D366" }} // Cor verde do WhatsApp
      >
        <img 
          src="/whatsapp-icon.ico" 
          alt="WhatsApp" 
          className={cn(isMobile ? "h-3.5 w-3.5" : "h-4 w-4")} 
        />
        Vagner
      </a>
    </footer>
  );
};