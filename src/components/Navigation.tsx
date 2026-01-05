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
import { ShoppingCart } from 'lucide-react'; // Importar ShoppingCart

export const Navigation = () => {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const { data: pendingCount = 0 } = usePendingShoppingItemsCount(user);

  const navItems = [
    { to: "/", label: "Home", icon: "🏠", color: "hsl(215, 96%, 39%)" }, // Novo root: Home
    { to: "/dashboard", label: "Dashboard", icon: "📊", color: "hsl(210, 70%, 50%)" }, // Dashboard secundário
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
      icon: "🛒", // Este ícone será renderizado pelo DynamicIcon no SheetContent
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

            {/* 🛒 Carrinho com badge (APENAS Mobile) */}
            <button
              type="button"
              onClick={() => navigate("/lista-de-compras")}
              className="relative flex items-center justify-center h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 sm:bg-muted sm:hover:bg-muted/80 transition md:hidden"
              title="Ir para Lista de Compras"
            >
              <ShoppingCart className="h-6 w-6 text-white" /> {/* NOVO ÍCONE */}

              {pendingCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-[5px] text-[10px] font-bold text-white">
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
                className="w-[280px] sm:w-[350px] bg-white"
              >
                <SheetHeader className="text-left pt-12 pb-2">
                  <div className="flex items-center gap-2">
                    <img src="/favicon.ico" alt="Logo" className="h-6 w-6" />
                    <SheetTitle className="text-primary font-bold text-xl">
                      Minhas Finanças
                    </SheetTitle>
                  </div>
                </SheetHeader>

                <div className="flex flex-col gap-1 mt-4">
                  {navItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      onClick={handleNavClick}
                      className="flex items-center gap-3 px-4 py-2 rounded-md text-gray-600 hover:text-foreground hover:bg-muted transition-all"
                      activeClassName="bg-[#E3F2FD] text-[#0A4A9B] font-semibold"
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
                    className="justify-start px-4 py-2 mt-1 h-auto text-gray-600 hover:text-destructive hover:bg-soft-red/30 border-t border-gray-100 rounded-none w-full"
                  >
                    <DynamicIcon name="LogOut" className="h-5 w-5 mr-3" color="#E85454" />
                    Sair
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </nav >
  );
};