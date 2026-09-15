import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DynamicIcon from "./DynamicIcon";
import { useAuth } from "@/hooks/useAuth";
import { usePendingShoppingItemsCount } from "@/hooks/usePendingShoppingItemsCount";
import { FinancialNotificationsPopover } from "./FinancialNotificationsPopover";

interface MainHeaderProps {
  toggleSidebar: () => void;
}

export const MainHeader: React.FC<MainHeaderProps> = ({ toggleSidebar }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: pendingCount = 0 } = usePendingShoppingItemsCount(user);

  const handleOpenShoppingList = () => {
    navigate("/lista-compras");
  };

  return (
    <header className="sticky top-0 z-30 w-full border-b-0 bg-transparent text-primary-foreground sm:bg-background sm:text-foreground sm:border-b sm:px-4">
      <div className="flex h-14 items-center justify-between px-4 sm:px-0">
        {/* ESQUERDA: Logo / Título */}
        <Link
          to="/"
          className="flex items-center gap-2 text-base font-semibold sm:text-lg text-white sm:text-foreground [text-shadow:0_1px_2px_rgba(0,0,0,.15)] sm:[text-shadow:none]"
        >
          <DynamicIcon name="Wallet" className="h-6 w-6" />
          <span>Finanças Pessoais</span>
        </Link>

        {/* DIREITA: Carrinho + Menu */}
        <div className="flex items-center gap-3">
          {/* 🛒 Lista de Compras */}
          <button
            type="button"
            onClick={handleOpenShoppingList}
            className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/15 hover:bg-white/25 sm:bg-muted sm:hover:bg-muted/80 transition text-white sm:text-foreground [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.18))] sm:[filter:none]"
            title={
              pendingCount > 0
                ? `Lista de compras (${pendingCount} itens pendentes)`
                : "Lista de compras"
            }
            aria-label="Abrir lista de compras"
          >
            <span className="text-xl leading-none">🛒</span>

            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-[5px] text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>

          <FinancialNotificationsPopover />

          {/* Botão Menu (hambúrguer) */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 bg-white/5 border-white/40 text-white sm:bg-transparent sm:border-input sm:text-foreground [filter:drop-shadow(0_1px_2px_rgba(0,0,0,.18))] sm:[filter:none]"
            onClick={toggleSidebar}
            aria-label="Abrir menu de navegação"
          >
            <DynamicIcon name="Menu" className="h-4 w-4" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </div>
      </div>
    </header>
  );
};
