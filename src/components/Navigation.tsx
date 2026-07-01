import { useState, useMemo, useEffect } from "react";
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

  const isDespesas = location.pathname.startsWith("/despesas");
  const isReceitas = location.pathname.startsWith("/receitas");
  const isInvestimentos = location.pathname.startsWith("/investimentos");
  const isCategorias = location.pathname.startsWith("/categorias");
  const isLancamentos = location.pathname.startsWith("/lancamentos");
  const isDarkPage = location.pathname === "/";

  const [scrolled, setScrolled] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) return;

    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);

    // Observer para detectar modais (Radix UI adiciona classes/estilos ao body)
    const observer = new MutationObserver(() => {
      const isLocked = document.body.style.pointerEvents === "none" || document.body.hasAttribute("data-radix-scroll-lock");
      setIsModalOpen(isLocked);
    });

    observer.observe(document.body, { attributes: true, attributeFilter: ["style", "data-radix-scroll-lock"] });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      observer.disconnect();
    };
  }, [isMobile]);

  // Cores dinâmicas baseadas no tema da página ou estado do modal
  const forceDarkText = isInvestimentos || isCategorias || isDespesas || isReceitas || isLancamentos || isDarkPage;
  const mobileTextColor = (isModalOpen && !forceDarkText) ? "text-white" : "text-[#356DD8]";
  const mobileIconColor = (isModalOpen && !forceDarkText) ? "text-white" : "text-[#374151]";

  useEffect(() => {
    if (!isMobile) return;
    
    let color = "#FFFFFF";
    if (isDarkPage || isDespesas) {
      color = "#F7F9FC";
    } else if (isLancamentos) {
      color = "#F7F9FC";
    } else if (isReceitas || isInvestimentos) {
      color = "#F8FAFC"; // equivalente a slate-50
    } else if (isCategorias) {
      color = "#F9FAFB";
    } else if (!scrolled) {
      color = "#FFFFFF";
    } else {
      color = "#FFFFFF";
    }

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", color);
    }
  }, [isMobile, isDarkPage, isDespesas, isLancamentos, isReceitas, isInvestimentos, isCategorias, scrolled]);

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-[60]",
        !isMobile && "transition-all duration-300",
        isMobile && isOpen && "opacity-0 pointer-events-none",
        isMobile
          ? cn(
            "h-14 shadow-none border-t border-black/[0.04]",
            (isDarkPage || isDespesas)
                ? "bg-[#F7F9FC]"
                : isLancamentos
                    ? "bg-[#F7F9FC]"
                : (isReceitas || isInvestimentos)
                    ? "bg-slate-50"
                    : isCategorias
                    ? "bg-[#F9FAFB]"
                    : !scrolled
                        ? "bg-transparent border-transparent"
                        : "bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm"
          )
          : "h-[72px] text-white"
      )}
      style={!isMobile ? {
        background: "linear-gradient(135deg, #1d3357 0%, #243b63 55%, #2b4975 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 2px 10px rgba(15,23,42,0.10)"
      } : undefined}>
        <div className="container-app h-full">
          <div className="flex items-center justify-between h-full">
            {/* Logo / Título */}
            <div
              className="flex items-center gap-2.5 cursor-pointer group"
              onClick={() => navigate("/")}
            >
              <img
                src="/icons/logo.png"
                alt="Logo"
                className="h-8 w-8 transition-transform group-hover:scale-110"
              />
              <span className={cn(
                "font-extrabold tracking-[0.5px]",
                isMobile ? "text-[20px]" : "text-lg",
                !isMobile && "transition-all duration-300",
                isMobile ? mobileTextColor : "text-white",
                isModalOpen && "shadow-none drop-shadow-none filter-none"
              )}
              style={{
                fontFamily: "'Inter', sans-serif",
                filter: "drop-shadow(0px 1px 1px rgba(0,0,0,0.1))",
                textShadow: isMobile && isDarkPage && mobileTextColor === "text-[#356DD8]"
                  ? "0 1px 1px rgba(0,0,0,0.12)"
                  : undefined
              }}>
                Minhas Finança<span style={{ color: "#22c55e", fontWeight: 500, textShadow: "0 0 10px rgba(34, 197, 94, 0.4)" }}>$</span>
              </span>
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
                          ? "bg-[#FEF9C3] text-[#0B213F] font-bold shadow-sm"
                          : "text-white hover:bg-white/10"
                      )}
                    >
                      <DynamicIcon name={item.icon} className="h-4 w-4" />
                      <span className="font-semibold">{item.label}</span>
                    </RouterNavLink>
                  ))}

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={signOut}
                    className="ml-2 text-white hover:bg-red-500/20 hover:text-red-300 rounded-xl"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sair
                  </Button>
                </div>
              )}

              {isMobile && (
                <div className="flex items-center gap-2 -mr-2">
                  <button
                    onClick={() => navigate("/lista-de-compras")}
                    className={cn(
                      "relative p-2 rounded-full",
                      !isMobile && "transition-colors",
                      isMobile ? `${mobileIconColor} hover:bg-current/10` : "text-white hover:bg-white/10"
                    )}
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
                      <button className={cn(
                        "p-2 rounded-full",
                        !isMobile && "transition-colors",
                        isMobile ? `${mobileIconColor} hover:bg-current/10` : "text-white hover:bg-white/10"
                      )}>
                        <DynamicIcon name="Menu" className="h-6 w-6" strokeWidth={3} />
                      </button>
                    </SheetTrigger>
                    <SheetContent
                      side="right"
                      className="w-[280px] border-l-0 p-0 shadow-2xl overflow-hidden bg-[#F8FAFF]"
                    >
                      {/* Efeito institucional moderno no topo */}
                      <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" />

                      <SheetHeader className="relative text-left pt-12 pb-6 px-6 bg-[#2B457D] border-b border-white/10 shadow-sm">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xl font-bold text-white truncate drop-shadow-sm">
                            {fullName}
                          </span>
                          <span className="text-xs text-blue-100/70 truncate font-medium">
                            {user?.email}
                          </span>
                        </div>
                      </SheetHeader>

                      <div className="relative flex flex-col gap-0.5 mt-4 px-3">
                        {navItems.map((item) => (
                          <RouterNavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) => cn(
                              "flex items-center gap-4 px-4 py-2 transition-all mx-1",
                              isActive ? "rounded-xl" : "rounded-2xl",
                              isActive
                                ? "bg-[#2B457D] text-white font-bold border-b-[1px] border-[#1a2c54] shadow-none"
                                : "text-[#4A6B8A] hover:bg-white/30 hover:text-[#1E3A5F]"
                            )}
                          >
                            <span className="text-xl filter drop-shadow-lg">{item.icon}</span>
                            <span className="text-[14px] font-bold tracking-tight">{item.label}</span>
                          </RouterNavLink>
                        ))}
                        <div className="h-px bg-slate-300/30 my-2 mx-4" />
                        <Button
                          variant="ghost"
                          onClick={signOut}
                          className="justify-start px-4 py-2 text-rose-600 hover:bg-rose-50/50 hover:text-rose-700 rounded-2xl font-bold transition-colors mt-1"
                        >
                          <LogOut className="h-5 w-5 mr-4" strokeWidth={2.5} />
                          <span className="text-[14px]">Sair da Conta</span>
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