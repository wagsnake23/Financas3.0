import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import DynamicIcon from "./DynamicIcon";
import { usePendingShoppingItemsCount } from "@/hooks/usePendingShoppingItemsCount";

export const Navigation = () => {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const { data: pendingCount = 0 } = usePendingShoppingItemsCount(user);

  const navItems = [
    { to: "/", label: "Dashboard", icon: "📊", color: "hsl(210, 70%, 50%)" }, // Azul
    {
      to: "/despesas",
      label: "Despesas",
      icon: "💸",
      color: "hsl(0, 70%, 55%)",
    }, // Vermelho
    {
      to: "/receitas",
      label: "Receitas",
      icon: "💰",
      color: "hsl(150, 65%, 50%)",
    }, // Verde
    {
      to: "/lancamentos",
      label: "Lançamentos",
      icon: "📝",
      color: "hsl(45, 90%, 55%)",
    }, // Amarelo
    {
      to: "/categorias",
      label: "Categorias",
      icon: "🗂️",
      color: "hsl(285, 70%, 55%)",
    }, // Roxo
    {
      to: "/investimentos",
      label: "Investimentos",
      icon: "📈",
      color: "hsl(180, 70%, 50%)",
    }, // Ciano
    {
      to: "/lista-de-compras",
      label: "Lista de Compras",
      icon: "🛒",
      color: "hsl(270, 70%, 58%)",
    }, // Lista de Compras
  ];

  const handleNavClick = () => {
    setIsOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[60] bg-gradient-primary text-primary-foreground shadow-lg">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Título */}
          <div
            className="flex items-center gap-4 cursor-pointer"
            onClick={() => navigate("/")}
          >
            <img
              src="/favicon.ico"
              alt="Controle Financeiro Logo"
              className="h-8 w-8"
            />
            <span className="font-bold text-xl">Minhas Finanças</span>
          </div>

          {/* Área da direita: Desktop menu + carrinho + menu mobile */}
          <div className="flex items-center gap-3">
            {/* Navegação Desktop */}
            <div className="hidden md:flex items-center gap-2">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === "/"}
                  className="px-3 py-2 rounded-md text-primary-foreground hover:bg-primary-foreground/10 transition-all"
                  activeClassName="bg-primary-foreground/20 text-primary-foreground font-medium"
                >
                  <div className="flex items-center gap-2">
                    <DynamicIcon name={item.icon} className="h-4 w-4" />
                    <span>{item.label}</span>
                  </div>
                </NavLink>
              ))}

              {/* Botão Sair (Desktop) */}
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="ml-2 text-primary-foreground hover:bg-primary-foreground/10"
              >
                <DynamicIcon name="❌" className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>

            {/* 🛒 Carrinho com badge (Desktop + Mobile) */}
            <button
              type="button"
              onClick={() => navigate("/lista-de-compras")}
              className="relative flex items-center justify-center text-2xl"
              title="Ir para Lista de Compras"
            >
              🛒
              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-[5px] text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </button>

            {/* Navegação Mobile (Hamburger + Sheet) */}
            <Sheet open={isOpen} onOpenChange={setIsOpen}>
              <SheetTrigger asChild className="md:hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-primary-foreground"
                >
                  <DynamicIcon name="Menu" className="h-6 w-6" />
                </Button>
              </SheetTrigger>

              <SheetContent
                side="right"
                className="w-[280px] sm:w-[350px] bg-[#F1F9FD]"
              >
                <SheetHeader>
                  <SheetTitle className="text-foreground">Menu</SheetTitle>
                </SheetHeader>

                <div className="flex flex-col gap-2 mt-6">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      onClick={handleNavClick}
                      className="flex items-center gap-3 px-4 py-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                      activeClassName="bg-soft-blue text-foreground font-medium"
                    >
                      <DynamicIcon
                        name={item.icon}
                        className="h-5 w-5"
                        color={item.color}
                      />
                      <span>{item.label}</span>
                    </NavLink>
                  ))}

                  {/* Botão Sair (Mobile) */}
                  <Button
                    variant="ghost"
                    onClick={() => {
                      handleNavClick();
                      signOut();
                    }}
                    className="justify-start px-4 py-3 h-auto text-muted-foreground hover:text-foreground hover:bg-muted"
                  >
                    <DynamicIcon name="❌" className="h-5 w-5 mr-3" />
                    Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav>
  );
};
