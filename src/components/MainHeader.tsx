import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DynamicIcon from "./DynamicIcon";
import { useAuth } from "@/hooks/useAuth"; // Assuming this hook provides the user
import { usePendingShoppingItemsCount } from "@/hooks/usePendingShoppingItemsCount"; // New import

interface MainHeaderProps {
  toggleSidebar: () => void;
}

export const MainHeader: React.FC<MainHeaderProps> = ({ toggleSidebar }) => {
  const { user } = useAuth(); // Get user from auth context
  const navigate = useNavigate();
  const { data: pendingCount = 0 } = usePendingShoppingItemsCount(user); // Use the new hook

  const handleOpenShoppingList = () => {
    navigate("/lista-compras"); // Navigate to the shopping list route
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent">
      <div className="flex items-center justify-between w-full">
        {/* Left side: Logo/Title */}
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
          <DynamicIcon name="Wallet" className="h-6 w-6" />
          <span>Finanças Pessoais</span>
        </Link>

        {/* Right side: Shopping Cart Button + Hamburger Menu */}
        <div className="flex items-center gap-3">
          {/* 🛒 Botão da lista de compras */}
          <button
            type="button"
            onClick={handleOpenShoppingList}
            className="relative flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 px-2 py-1 transition"
            title={
              pendingCount > 0
                ? `Lista de compras (${pendingCount} itens pendentes)`
                : "Lista de compras"
            }
          >
            <span className="text-xl">🛒</span>

            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-[5px] text-[10px] font-bold text-white">
                {pendingCount}
              </span>
            )}
          </button>

          {/* Existing Hamburger Menu Button */}
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={toggleSidebar}
          >
            <DynamicIcon name="Menu" className="h-4 w-4" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </div>
      </div>
    </header>
  );
};