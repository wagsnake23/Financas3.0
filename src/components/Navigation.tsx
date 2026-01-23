import { useState, useMemo } from "react";
import { NavLink as RouterNavLink, useLocation, useNavigate } from "react-router-dom";
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
import { ShoppingCart, Home, LayoutDashboard, Plus, CreditCard, User, LogOut, Settings, Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Navigation = () => {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const location = useLocation();

  const { data: pendingCount = 0 } = usePendingShoppingItemsCount(user);

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user,
  });

  const fullName = profile?.nome || user?.user_metadata?.nome || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";

  const navItems = [
    { to: "/", label: "Home", icon: "🏠", color: "hsl(215, 96%, 39%)" },
    { to: "/dashboard", label: "Dashboard", icon: "📊", color: "hsl(210, 70%, 50%)" },
    { to: "/despesas", label: "Despesas", icon: "💸", color: "hsl(0, 70%, 55%)" },
    { to: "/receitas", label: "Receitas", icon: "💰", color: "hsl(150, 65%, 50%)" },
    { to: "/lancamentos", label: "Lançamentos", icon: "📝", color: "hsl(45, 90%, 55%)" },
    { to: "/categorias", label: "Categorias", icon: "🗂️", color: "hsl(285, 70%, 55%)" },
    { to: "/investimentos", label: "Investimentos", icon: "📈", color: "hsl(180, 70%, 50%)" },
    { to: "/lista-de-compras", label: "Lista de Compras", icon: "🛒", color: "hsl(270, 70%, 58%)" },
  ];

  const bottomNavItems = [
    { to: "/", label: "Home", icon: Home },
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "#plus", label: "Ação", icon: Plus, isAction: true },
    { to: "/#cartoes", label: "Cartões", icon: CreditCard },
    { to: "/configurações", label: "Perfil", icon: User }, // Redirecionando para algo seguro ou placeholder
  ];

  const handleNavClick = () => {
    setIsOpen(false);
  };

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/" && !location.hash;
    if (path.includes("#")) {
      const [p, h] = path.split("#");
      const normalizedP = p === "" ? "/" : p;
      return location.pathname === normalizedP && location.hash === `#${h}`;
    }
    return location.pathname.startsWith(path);
  };

  const isDespesas = location.pathname === "/despesas";

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-[60] transition-colors duration-300",
        isMobile
          ? cn(
            "h-14 backdrop-blur-md border-b shadow-none",
            isDespesas
              ? "bg-gradient-to-b from-[#FFF1F1]/95 to-[#FFF1F1]/80 border-rose-100/50"
              : "bg-gradient-to-b from-[#E0F2FE]/90 to-[#F8FAFC]/80 border-blue-100/50"
          )
          : "h-16 bg-gradient-primary text-primary-foreground shadow-lg"
      )}>
        <div className="container mx-auto px-4 h-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo / Título */}
            <div
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={() => navigate("/")}
            >
              <img
                src="/favicon.ico"
                alt="Logo"
                className="h-8 w-8 transition-transform group-hover:scale-110"
              />
              <span className={cn(
                "font-bold text-lg tracking-tight",
                isMobile
                  ? "text-primary"
                  : "text-white"
              )}>Minhas Finanças</span>
            </div>

            {/* Área da direita */}
            <div className="flex items-center gap-3">
              {/* Navegação Desktop */}
              {!isMobile && (
                <div className="hidden md:flex items-center gap-1">
                  {navItems.map((item) => (
                    <RouterNavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) => cn(
                        "px-3 py-2 rounded-xl text-sm transition-all flex items-center gap-2",
                        isActive
                          ? "bg-white/20 text-white font-bold"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      )}
                    >
                      <DynamicIcon name={item.icon} className="h-4 w-4" />
                      <span>{item.label}</span>
                    </RouterNavLink>
                  ))}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={signOut}
                    className="ml-2 text-white/80 hover:bg-white/10 hover:text-white rounded-xl"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </Button>
                </div>
              )}

              {/* Icones Mobile Topo - Apenas se necessário (ex: notificações ou carrinho) */}
              {isMobile && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigate("/lista-de-compras")}
                    className="relative p-2 text-primary hover:bg-primary/5 rounded-full transition-colors"
                  >
                    <ShoppingCart className="h-6 w-6" strokeWidth={2.5} />
                    {pendingCount > 0 && (
                      <span className="absolute top-0.5 right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white border-2 border-white">
                        {pendingCount}
                      </span>
                    )}
                  </button>

                  {/* Menu Lateral redundante para outras opções */}
                  <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                      <button className="p-2 text-primary hover:bg-primary/5 rounded-full transition-colors">
                        <DynamicIcon name="Menu" className="h-6 w-6" strokeWidth={3} />
                      </button>
                    </SheetTrigger>
                    <SheetContent side="right" className="w-[280px] bg-white border-l-0">
                      <SheetHeader className="text-left pt-10 pb-4 border-b border-gray-100">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-lg font-bold text-primary truncate">
                            {fullName}
                          </span>
                          <span className="text-xs text-gray-500 truncate italic">
                            {user?.email}
                          </span>
                        </div>
                      </SheetHeader>
                      <div className="flex flex-col gap-0.5 mt-3">
                        {navItems.map((item) => (
                          <RouterNavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) => cn(
                              "flex items-center gap-4 px-4 py-2 rounded-2xl transition-all",
                              isActive ? "bg-primary/10 text-primary font-bold" : "text-gray-600 hover:bg-gray-50"
                            )}
                          >
                            <span className="text-xl">{item.icon}</span>
                            <span className="text-sm font-medium">{item.label}</span>
                          </RouterNavLink>
                        ))}
                        <div className="h-[1.5px] bg-slate-200/80 my-2 mx-4" />
                        <Button
                          variant="ghost"
                          onClick={signOut}
                          className="justify-start px-4 py-2 text-destructive hover:bg-destructive/5 hover:text-destructive rounded-2xl"
                        >
                          <LogOut className="h-5 w-5 mr-4" strokeWidth={2.5} />
                          <span className="font-bold">Sair da Conta</span>
                        </Button>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* BOTTOM NAVIGATION REMOVIDO A PEDIDO DO USUÁRIO */}
    </>
  );
};