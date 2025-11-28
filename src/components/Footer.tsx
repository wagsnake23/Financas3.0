import React from "react";
import { cn } from "@/lib/utils";
// Removido: import { MessageCircle } from "lucide-react"; // Não é mais necessário

import { User } from "@supabase/supabase-js"; // Importar o tipo User do Supabase

interface FooterProps {
  isMobile?: boolean;
  className?: string;
  user: User | null; // Adicionado a prop user
}

export const Footer = ({ isMobile, className, user }: FooterProps) => {
  const userName = user?.user_metadata?.nome?.trim() || "Usuário não identificado"; // Acessar o nome do user_metadata
  const mensagem = `Olá Vagner! Meu nome é ${userName} e estou usando a aplicação Minhas Finanças. Preciso de ajuda!`;
  const linkWhatsApp = `https://api.whatsapp.com/send?phone=5514991188921&text=${encodeURIComponent(mensagem)}`; // URL atualizada

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
        className="inline-flex items-center gap-1 font-semibold hover:opacity-90 transition-opacity duration-200 relative top-[2px]" // Ajustado para relative top-[2px]
        style={{ color: "#20C05A" }} // Cor verde do WhatsApp atualizada
      >
        <svg
          width={isMobile ? "12" : "15"} // Tamanho responsivo para o SVG
          height={isMobile ? "12" : "15"} // Tamanho responsivo para o SVG
          viewBox="0 0 32 32"
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
          style={{ color: "#20C05A" }} // Cor verde do WhatsApp atualizada no SVG
        >
          <path d="M16.003 3.2c-7.063 0-12.8 5.736-12.8 12.8 0 2.26.591 4.459 1.712 6.4L3.2 28.8l6.666-1.697c1.878.97 3.988 1.486 6.138 1.486h.003c7.062 0 12.8-5.736 12.8-12.8s-5.738-12.8-12.804-12.8zm7.518 18.205c-.313.879-1.563 1.693-2.156 1.801-.553.102-1.273.146-2.056-.129-.471-.156-1.073-.346-1.848-.676-3.245-1.406-5.36-4.689-5.528-4.903-.162-.213-1.323-1.76-1.323-3.359 0-1.598.836-2.388 1.13-2.71.294-.322.646-.403.861-.403.215 0 .431.002.62.011.2.009.47-.076.737.563.283.68.962 2.348 1.045 2.52.083.173.138.376.027.59-.109.214-.164.347-.324.542-.163.194-.343.433-.49.583-.162.163-.331.339-.143.666.19.326.844 1.389 1.81 2.245 1.244 1.11 2.289 1.457 2.615 1.603.327.146.516.121.707-.073.194-.194.816-.95 1.036-1.275.22-.326.45-.272.757-.162.307.11 1.949.925 2.283 1.094.337.17.56.255.642.4.083.145.083.843-.23 1.721z"/>
        </svg>
        Vagner
      </a>
    </footer>
  );
};