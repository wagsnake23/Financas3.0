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
import { useProfile } from "@/hooks/useProfile";
import packageJson from "../../package.json";

export const Navigation = () => {
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const location = useLocation();

  const { data: pendingCount = 0 } = usePendingShoppingItemsCount(user);

  const { data: profile } = useProfile(user?.id);

  const fullName = profile?.nome || user?.user_metadata?.nome || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Usuário";
  
  const memberSince = user?.created_at 
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(user.created_at)) 
    : new Intl.DateTimeFormat("pt-BR").format(new Date());

  const avatarEmoji = profile?.avatar || "😎";

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

  const desktopNavItems = [
    ...navItems,
    { to: "/perfil", label: "Meu Perfil", icon: "👤", color: "hsl(210, 70%, 50%)" }
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
  const mobileTextColor = isDarkPage ? "text-white" : ((isModalOpen && !forceDarkText) ? "text-white" : "text-[#356DD8]");
  const mobileIconColor = isDarkPage ? "text-white" : ((isModalOpen && !forceDarkText) ? "text-white" : "text-[#374151]");

  useEffect(() => {
    if (!isMobile) return;
    
    let color = "#F7F9FC";
    if (isDarkPage) {
      color = "#010856";
    } else if (isDespesas || isLancamentos) {
      color = "#F7F9FC";
    } else if (isReceitas || isInvestimentos) {
      color = "#F8FAFC"; // equivalente a slate-50
    } else if (isCategorias) {
      color = "#F9FAFB";
    } else {
      color = "#F7F9FC";
    }

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", color);
    }
    document.documentElement.style.backgroundColor = color;
    document.body.style.backgroundColor = color;
  }, [isMobile, isDarkPage, isDespesas, isLancamentos, isReceitas, isInvestimentos, isCategorias, scrolled]);

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-[60]",
        !isMobile && "transition-all duration-300",
        isMobile && isOpen && "opacity-0 pointer-events-none",
        isMobile
          ? cn(
            "h-14 shadow-none",
            isDarkPage
                ? "bg-transparent"
                : isDespesas
                    ? "bg-[#F7F9FC]"
                    : isLancamentos
                    ? "bg-[#F7F9FC]"
                : (isReceitas || isInvestimentos)
                    ? "bg-slate-50"
                    : isCategorias
                    ? "bg-[#F9FAFB]"
                    : !scrolled
                        ? "bg-transparent border-transparent"
                        : "bg-white"
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
                textShadow: isMobile && isDarkPage
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
                  {desktopNavItems.map((item) => (
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
                      className="w-[280px] border-l-0 p-0 shadow-2xl overflow-hidden bg-white flex flex-col [&>button]:top-[10px] [&>button]:right-[10px] [&>button]:text-white/70 hover:[&>button]:text-white"
                    >
                      <SheetHeader className="relative text-left pt-10 pb-5 px-5 bg-[#0B1B3D] border-none shadow-sm flex flex-row items-center gap-[12px]">
                        <div className="w-[48px] h-[48px] rounded-[16px] border-[1.5px] border-[#1C2F55] shadow-sm overflow-hidden bg-[#EEF4FF] flex items-center justify-center shrink-0">
                          <span className="text-[34px] leading-none">
                            {avatarEmoji}
                          </span>
                        </div>
                        <div className="flex flex-col overflow-hidden justify-center flex-1">
                          <span className="text-[16px] font-bold text-white truncate drop-shadow-sm leading-tight">
                            {fullName}
                          </span>
                          <span className="text-[11.5px] text-white/80 mt-0.5 whitespace-nowrap">
                            Membro desde {memberSince} 👑
                          </span>
                        </div>
                      </SheetHeader>

                      <div className="flex-1 overflow-y-auto pb-4">
                        <div className="flex flex-col gap-0.5 mt-3 px-3">
                          {navItems.map((item) => (
                            <RouterNavLink
                              key={item.to}
                              to={item.to}
                              onClick={() => setIsOpen(false)}
                              className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-2.5 transition-all mx-1 rounded-xl",
                                isActive
                                  ? "bg-[#EEF5FF] text-[#1E3A8B] font-bold"
                                  : "text-[#344054] hover:bg-slate-50 hover:text-[#1E3A8B] font-medium"
                              )}
                            >
                              <span className="text-[18px]">{item.icon}</span>
                              <span className="text-[15px] tracking-tight">{item.label}</span>
                            </RouterNavLink>
                          ))}
                        </div>
                        
                        <div className="h-px bg-[#E5E7EB] my-2 mx-4" />
                        
                        <div className="flex flex-col gap-0.5 px-3">
                          <RouterNavLink
                            to="/perfil"
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) => cn(
                              "flex items-center gap-3 px-4 py-2.5 transition-all mx-1 rounded-xl",
                              isActive
                                ? "bg-[#EEF5FF] text-[#1E3A8B] font-bold"
                                : "text-[#344054] hover:bg-slate-50 hover:text-[#1E3A8B] font-medium"
                            )}
                          >
                            <span className="text-[18px]">👤</span>
                            <span className="text-[15px] tracking-tight">Meu Perfil</span>
                          </RouterNavLink>
                        </div>

                        <div className="h-px bg-[#E5E7EB] my-2 mx-4" />
                        
                        <div className="px-3">
                          <Button
                            variant="ghost"
                            onClick={signOut}
                            className="w-full justify-start px-4 h-10 mx-1 text-[#DC2626] hover:bg-red-50 hover:text-[#B91C1C] rounded-xl font-medium transition-colors mt-0.5"
                          >
                            <LogOut className="h-5 w-5 mr-3" strokeWidth={2.5} />
                            <span className="text-[15px]">Sair da Conta</span>
                          </Button>
                        </div>
                      </div>
                      
                      {/* Rodapé Elegante */}
                      <div className="bg-[#F1F5F9] px-5 py-3.5 flex items-center justify-between border-t border-[#E5E7EB] mt-auto">
                        <div className="flex items-center gap-3">
                          <img src="/icons/logo.png" alt="Logo" className="w-7 h-7" />
                          <div className="flex flex-col">
                            <span className="text-[13px] font-extrabold text-[#1E3A8B] tracking-tight">
                              Minhas Finança<span className="text-[#22c55e]">$</span>
                            </span>
                            <span className="text-[9px] font-medium text-slate-400">Versão 2.0.1</span>
                          </div>
                        </div>
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