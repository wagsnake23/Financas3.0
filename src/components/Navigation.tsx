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
import { ShoppingCart, Home, LayoutDashboard, Plus, CreditCard, User, LogOut, Settings, Wallet, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, getDisplayName } from "@/lib/utils";
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

  const displayName = getDisplayName(profile, user);
  
  const memberSince = user?.created_at 
    ? new Intl.DateTimeFormat("pt-BR").format(new Date(user.created_at)) 
    : new Intl.DateTimeFormat("pt-BR").format(new Date());

  const sub = profile?.subscriptions;

  const getSubscriptionDisplay = () => {
    if (sub?.subscription_status === 'blocked') {
      return { icon: "🔴", title: "Conta Bloqueada", color: "text-red-500", bg: "bg-transparent" };
    }

    const type = sub?.subscription_type || 'trial';
    const isExpired = profile?.isExpired;
    const hasActiveSub = profile?.hasActiveSubscription;

    if (hasActiveSub) {
      if (type.includes('lifetime')) {
        return { icon: "👑", title: "Membro Vitalício", color: "text-[#EAB308]", bg: "bg-transparent" };
      }
      if (type.includes('premium')) {
        return { icon: "💎", title: "Membro Premium", color: "text-[#60A5FA]", bg: "bg-transparent" };
      }
    }

    if (type.includes('premium') || type.includes('lifetime')) {
      if (isExpired) {
        return { icon: "💎", title: "Assinatura Expirada", color: "text-red-400", bg: "bg-transparent" };
      }
    }

    if (isExpired) {
      return { icon: "🧪", title: "Trial Expirado", color: "text-red-400", bg: "bg-transparent" };
    }

    return { icon: "🧪", title: "Período de Avaliação", color: "text-[#34D399]", bg: "bg-transparent" };
  };

  const subDisplay = getSubscriptionDisplay();

  const avatarEmoji = profile?.avatar || "😎";

  const navItems = [
    { to: "/", label: "Home", icon: "🏠", color: "hsl(215, 96%, 39%)" },
    { to: "/dashboard", label: "Dashboard", icon: "📊", color: "hsl(210, 70%, 50%)" },
    { to: "/despesas", label: "Despesas", icon: "💸", color: "hsl(0, 70%, 55%)" },
    { to: "/receitas", label: "Receitas", icon: "💰", color: "hsl(150, 65%, 50%)" },
    { to: "/lancamentos", label: "Lançamentos", icon: "📝", color: "hsl(45, 90%, 55%)" },
    { to: "/categorias", label: "Categorias", icon: "🗂️", color: "hsl(285, 70%, 55%)" },
    { to: "/metas", label: "Metas", icon: "🎯", color: "hsl(25, 95%, 55%)" },
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
  const isMetas = location.pathname.startsWith("/metas");
  const isPerfil = location.pathname.startsWith("/perfil");
  const isDashboard = location.pathname.startsWith("/dashboard");
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
  const forceDarkText = isInvestimentos || isCategorias || isDespesas || isReceitas || isLancamentos || isMetas || isPerfil || isDashboard || isDarkPage;
  const mobileTextColor = isDarkPage ? "text-white" : ((isModalOpen && !forceDarkText) ? "text-white" : "text-[#356DD8]");
  const mobileIconColor = isDarkPage ? "text-white" : ((isModalOpen && !forceDarkText) ? "text-white" : "text-[#374151]");
  const mobileSubtitleColor = isDarkPage ? "text-white/65" : ((isModalOpen && !forceDarkText) ? "text-white/65" : "text-[#171717]");

  useEffect(() => {
    if (!isMobile) return;
    
    let themeColor = "#F7F9FC";
    let bodyColor = "#F7F9FC";

    if (isDarkPage) {
      themeColor = "#010856";
      bodyColor = "#F7F9FC";
    } else if (isDespesas || isReceitas || isLancamentos) {
      themeColor = "#FFFFFF";
      bodyColor = "#FFFFFF";
    } else if (isInvestimentos || isPerfil || isMetas || isDashboard) {
      themeColor = "#F8FBFF";
      bodyColor = "#F8FBFF";
    } else if (isCategorias) {
      themeColor = "#F9FAFB";
      bodyColor = "#F9FAFB";
    } else {
      themeColor = "#F7F9FC";
      bodyColor = "#F7F9FC";
    }

    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", themeColor);
    }
    document.documentElement.style.backgroundColor = bodyColor;
    document.body.style.backgroundColor = bodyColor;
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
                : (isDespesas || isReceitas || isLancamentos)
                    ? "bg-[#FFFFFF] border-none"
                : (isInvestimentos || isPerfil || isMetas || isDashboard)
                    ? "bg-[#F8FBFF]"
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
              className="flex items-center gap-2 md:gap-2.5 cursor-pointer group shrink-0"
              onClick={() => navigate("/")}
            >
              <img
                src="/icons/logo.png"
                alt="Logo"
                className="h-8 w-8 md:h-[42px] md:w-[42px] transition-transform group-hover:scale-110"
              />
              <div className="flex flex-col justify-center whitespace-nowrap">
                <span className={cn(
                  "tracking-[0.5px] font-bold",
                  isMobile ? "text-[18px] leading-none" : "text-[19px] leading-tight",
                  !isMobile && "transition-all duration-300",
                  isMobile ? mobileTextColor : "text-white/95",
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
                <span className={cn(
                  "leading-none",
                  isMobile ? "text-[12px] font-normal -mt-[2px]" : "text-[12px] -mt-[3px] font-medium text-blue-100/70 tracking-wide",
                  isMobile && mobileSubtitleColor
                )} style={{ fontFamily: "'Inter', sans-serif" }}>
                  Controle Financeiro
                </span>
              </div>
            </div>

            {/* Área da direita */}
            <div className="flex items-center gap-3">
              {/* Navegação Desktop */}
              {!isMobile && (
                <div className="hidden md:flex items-center gap-1">
                  {navItems.filter(item => item.label !== "Lista de Compras").map((item) => (
                    <RouterNavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      className={({ isActive }) => cn(
                        "relative px-2.5 py-2 text-[14px] transition-colors duration-300 flex items-center gap-1.5",
                        isActive
                          ? "text-white font-semibold after:absolute after:bottom-0 after:left-2.5 after:right-2.5 after:h-[2.5px] after:bg-[#FACC15] after:rounded-full after:opacity-100 after:transition-all after:duration-300"
                          : "text-blue-100/70 font-medium hover:text-white/95 hover:bg-transparent after:absolute after:bottom-0 after:left-1/2 after:right-1/2 after:h-[2.5px] after:bg-[#FACC15] after:rounded-full after:opacity-0 after:transition-all after:duration-300"
                      )}
                    >
                      <DynamicIcon name={item.icon} className="h-[16px] w-[16px]" />
                      <span className="tracking-wide">
                        {item.label === "Lista de Compras" ? "Compras" : item.label}
                      </span>
                    </RouterNavLink>
                  ))}

                  <div className="h-6 w-px bg-white/20 mx-2" />

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-3 px-3 py-1.5 rounded-full hover:bg-white/10 transition-colors text-white border border-white/20 ml-1 text-left">
                        <span className="text-[23px] leading-none">{avatarEmoji}</span>
                        <div className="flex flex-col justify-center">
                          <span className="max-w-[120px] truncate font-semibold text-[13px] leading-[1.1]">
                            {displayName}
                          </span>
                          <span className={cn(
                            "inline-flex items-center gap-1 mt-0.5 self-start max-w-[130px]",
                            subDisplay.color,
                            subDisplay.bg
                          )}>
                            <span className="text-[11px] font-medium tracking-[0.015em] leading-[1.2] truncate">
                              {subDisplay.title}
                            </span>
                            <span className="text-[11px] leading-none shrink-0">{subDisplay.icon}</span>
                          </span>
                        </div>
                        <ChevronDown className="h-4 w-4 opacity-70 ml-0.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[260px] rounded-2xl p-2 mt-2 shadow-xl border-slate-100">
                      <DropdownMenuLabel className="font-normal flex flex-col gap-1 p-3 pb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] border border-[#1C2F55]/10 flex items-center justify-center shrink-0">
                            <span className="text-2xl leading-none">{avatarEmoji}</span>
                          </div>
                          <div className="flex flex-col truncate">
                            <span className="font-bold text-slate-800 truncate">{displayName}</span>
                            <span className="max-w-[180px] truncate text-[12px] font-normal text-slate-500 leading-tight mt-0.5">
                              {user?.email || ""}
                            </span>
                          </div>
                        </div>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator className="bg-slate-100 my-1" />
                      <DropdownMenuItem asChild className="rounded-xl cursor-pointer p-3 hover:bg-slate-50">
                        <RouterNavLink to="/lista-de-compras" className="flex items-center w-full">
                          <span className="text-lg mr-3">🛒</span>
                          <span className="font-semibold text-slate-700">Compras</span>
                          {pendingCount > 0 && (
                            <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-white">
                              {pendingCount}
                            </span>
                          )}
                        </RouterNavLink>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild className="rounded-xl cursor-pointer p-3 hover:bg-slate-50">
                        <RouterNavLink to="/perfil" className="flex items-center w-full">
                          <span className="text-lg mr-3">👤</span>
                          <span className="font-semibold text-slate-700">Meu Perfil</span>
                        </RouterNavLink>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-slate-100 my-1" />
                      <DropdownMenuItem 
                        onClick={signOut}
                        className="rounded-xl cursor-pointer p-3 text-red-600 focus:text-red-600 focus:bg-red-50"
                      >
                        <LogOut className="h-5 w-5 mr-3" strokeWidth={2.5} />
                        <span className="font-semibold">Sair da Conta</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                      className="w-[280px] border-l-0 p-0 shadow-2xl overflow-hidden bg-white flex flex-col [&>button]:top-[10px] [&>button]:right-[10px] [&>button]:text-white [&>button]:opacity-100 hover:[&>button]:opacity-90"
                    >
                      <SheetHeader 
                        className="relative text-left pt-10 pb-5 px-5 border-none shadow-sm flex flex-row items-center gap-[12px]"
                        style={{
                          backgroundImage: "url('/sky.webp')",
                          backgroundSize: "cover",
                          backgroundPosition: "center top",
                          backgroundRepeat: "no-repeat"
                        }}
                      >
                        <div className="w-[48px] h-[48px] rounded-[16px] border-[1.5px] border-[#1C2F55] shadow-sm overflow-hidden bg-[#EEF4FF] flex items-center justify-center shrink-0">
                          <span className="text-[34px] leading-none">
                            {avatarEmoji}
                          </span>
                        </div>
                        <div className="flex flex-col overflow-hidden justify-center flex-1">
                          <span className="text-[16px] font-bold text-white truncate drop-shadow-sm leading-tight">
                            {displayName}
                          </span>
                          <span className={cn(
                            "inline-flex items-center gap-1 mt-0.5 self-start max-w-full",
                            subDisplay.color,
                            subDisplay.bg
                          )}>
                            <span className="text-[12px] font-semibold tracking-[0.015em] leading-none truncate">
                              {subDisplay.title}
                            </span>
                            <span className="text-[12px] leading-none shrink-0">{subDisplay.icon}</span>
                          </span>
                        </div>
                      </SheetHeader>

                      <div className="flex-1 overflow-y-auto pb-4">
                        <div className="flex flex-col gap-0.5 mt-1 px-3">
                          {navItems.map((item) => (
                            <RouterNavLink
                              key={item.to}
                              to={item.to}
                              onClick={() => setIsOpen(false)}
                              className={({ isActive }) => cn(
                                "flex items-center gap-3 px-4 py-1 transition-all mx-1 rounded-xl",
                                isActive
                                  ? "bg-[#EEF5FF] text-[#1E3A8B] font-bold"
                                  : "text-[#344054] hover:bg-slate-50 hover:text-[#1E3A8B] font-medium"
                              )}
                            >
                              <span className="text-[18px]">{item.icon}</span>
                              <span className="text-[15px] tracking-tight">{item.label}</span>
                            </RouterNavLink>
                          ))}
                          
                          <RouterNavLink
                            to="/perfil"
                            onClick={() => setIsOpen(false)}
                            className={({ isActive }) => cn(
                              "flex items-center gap-3 px-4 py-1 transition-all mx-1 rounded-xl",
                              isActive
                                ? "bg-[#EEF5FF] text-[#1E3A8B] font-bold"
                                : "text-[#344054] hover:bg-slate-50 hover:text-[#1E3A8B] font-medium"
                            )}
                          >
                            <span className="text-[18px]">👤</span>
                            <span className="text-[15px] tracking-tight">Meu Perfil</span>
                          </RouterNavLink>

                          <Button
                            variant="ghost"
                            onClick={signOut}
                            className="w-full justify-start px-4 h-8 mx-1 text-[#DC2626] hover:bg-red-50 hover:text-[#B91C1C] rounded-xl font-medium transition-colors mt-0.5"
                          >
                            <LogOut className="h-4 w-4 mr-3" strokeWidth={2.5} />
                            <span className="text-[15px]">Sair da Conta</span>
                          </Button>
                        </div>
                      </div>
                      
                      {/* Rodapé Elegante */}
                      <div className="bg-[#F1F5F9] px-5 py-[13px] flex items-center justify-between border-t border-[#E5E7EB] mt-auto">
                        <div className="flex items-center gap-3">
                          <img src="/icons/logo.png" alt="Logo" className="w-[34px] h-[34px]" />
                          <div className="flex flex-col">
                            <span className="text-[15px] font-extrabold text-[#1E3A8B] tracking-tight leading-none mb-0.5">
                              Minhas Finança<span className="text-[#22c55e]">$</span>
                            </span>
                            <span className="text-[11px] font-medium text-slate-400 leading-none mt-0.5">Versão 3.0.0</span>
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
