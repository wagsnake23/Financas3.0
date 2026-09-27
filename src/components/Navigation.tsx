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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/hooks/useAuth";
import DynamicIcon from "./DynamicIcon";
import { FinancialNotificationsPopover } from "./FinancialNotificationsPopover";
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
    { to: "/orcamentos", label: "Planejamento", icon: "🧮", color: "hsl(340, 70%, 55%)" },
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

  // Cor única fixa para o topo de todas as páginas no mobile (limitação do WebAPK)
  const pageTopColor = "#FAFAFA";

  // Texto/ícones sempre escuros pois o fundo agora é sempre claro
  const mobileTextColor = "text-slate-800";
  const mobileIconColor = "text-slate-700";
  const mobileSubtitleColor = "text-[#262626]";

  useEffect(() => {
    // Atualiza theme-color para acompanhar a superfície da página em toda troca de rota
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", pageTopColor);
    }

    // Garante que o body tenha a mesma cor (elimina flash branco e vaz. de cor)
    document.body.style.backgroundColor = pageTopColor;

    // DEBUG TEMPORÁRIO — remover após confirmar funcionamento
    console.log(
      "[theme-color]",
      location.pathname,
      pageTopColor,
      document.querySelector('meta[name="theme-color"]')?.getAttribute("content")
    );
  }, [isMobile, pageTopColor, location.pathname]);

  return (
    <>
      <nav className={cn(
        "fixed top-0 left-0 right-0 z-[60]",
        !isMobile && "transition-all duration-300",
        isMobile && isOpen && "opacity-0 pointer-events-none",
        isMobile
          ? "shadow-none border-0"
          : "h-[72px] text-white"
      )}
      style={isMobile ? {
        backgroundColor: isDarkPage ? "transparent" : pageTopColor,
        paddingTop: "env(safe-area-inset-top)",
        height: "calc(3.5rem + env(safe-area-inset-top))"
      } : {
        background: "linear-gradient(135deg, #1d3357 0%, #243b63 55%, #2b4975 100%)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        boxShadow: "0 2px 10px rgba(15,23,42,0.10)"
      }}>
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
                className={cn(
                  "h-8 w-8 md:h-[42px] md:w-[42px] transition-transform group-hover:scale-110",
                  isMobile && "-translate-y-[2px]"
                )}
              />
              <div className="flex flex-col justify-center whitespace-nowrap">
                <span className={cn(
                  "tracking-[0.5px]",
                  isMobile ? "text-[18px] leading-none font-[900]" : "text-[19px] leading-tight font-bold",
                  !isMobile && "transition-all duration-300",
                  isMobile ? "text-[#0556C3]" : "text-white/95",
                  isModalOpen && "shadow-none drop-shadow-none filter-none"
                )}
                style={{
                  fontFamily: "'Inter', sans-serif",
                  filter: !isMobile ? "drop-shadow(0px 1px 1px rgba(0,0,0,0.1))" : "none",
                  textShadow: isMobile
                    ? "0px 1px 0px rgba(255,255,255,0.8)"
                    : undefined
                }}>
                  Minhas Finança<span style={{ color: "#22c55e", fontWeight: isMobile ? "600" : 500, textShadow: isMobile ? "0 0 10px rgba(34, 197, 94, 0.3)" : "0 0 10px rgba(34, 197, 94, 0.4)" }}>$</span>
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
                  {navItems.filter(item => item.label !== "Lista de Compras" && item.label !== "Metas").map((item) => (
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

                  <FinancialNotificationsPopover />

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
                        <RouterNavLink to="/metas" className="flex items-center w-full">
                          <span className="text-lg mr-3">🎯</span>
                          <span className="font-semibold text-slate-700">Metas</span>
                        </RouterNavLink>
                      </DropdownMenuItem>
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
                <div className="flex items-center gap-[6px] -mr-[4px]">
                  <FinancialNotificationsPopover />

                  <button
                    onClick={() => navigate("/lista-de-compras")}
                    className={cn(
                      "relative flex items-center justify-center w-[40px] h-[40px] rounded-full",
                      !isMobile && "transition-colors",
                      isMobile ? `${mobileIconColor} hover:bg-current/10 -translate-y-[2px] translate-x-[2px]` : "text-white hover:bg-white/10"
                    )}
                  >
                    <ShoppingCart className="h-[22px] w-[22px]" strokeWidth={2.5} />
                    {pendingCount > 0 && (
                      <span className="absolute top-[3px] right-[2px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white border-[2px] border-white">
                        {pendingCount}
                      </span>
                    )}
                  </button>

                  {/* Menu Lateral redundante para outras opções */}
                  <Sheet open={isOpen} onOpenChange={setIsOpen}>
                    <SheetTrigger asChild>
                      <button className={cn(
                        "relative flex items-center justify-center w-[40px] h-[40px] rounded-full",
                        !isMobile && "transition-colors",
                        isMobile ? `${mobileIconColor} hover:bg-current/10 -translate-y-[2px]` : "text-white hover:bg-white/10"
                      )}>
                        <DynamicIcon name="Menu" className="h-[24px] w-[24px]" strokeWidth={3} />
                      </button>
                    </SheetTrigger>
                    <SheetContent
                      side="right"
                      className="w-[85%] max-w-[340px] p-0 [&>button]:hidden flex flex-col h-full bg-white shadow-2xl border-l-0"
                    >
                      {/* Cabeçalho Integrado com Dashboard */}
                      <div className="relative px-5 py-4 flex items-center w-full bg-[linear-gradient(to_bottom,#FAFAFA_0px,#FAFAFA_10px,#fcfdff_20px,#f9fbfe_30px,#f6fafe_40px,#f4f8ff_60px,#f4f8ff_100%)] border-b border-[rgba(180,200,230,0.5)] shadow-[0_4px_20px_rgba(15,23,42,0.04)] overflow-hidden shrink-0 rounded-bl-[20px] min-h-[90px]">
                        <div className="relative z-10 flex items-center w-full gap-[11px] -ml-[3px]">
                          <div 
                            className="h-[56px] w-[56px] rounded-[16px] border-[1.5px] border-[rgba(180,200,230,0.5)] overflow-hidden bg-[#EEF4FF] flex items-center justify-center shrink-0"
                            style={{ boxShadow: '0 2px 8px rgba(37, 99, 235, 0.12)' }}
                          >
                            <span className="text-[34px] leading-none">
                              {avatarEmoji}
                            </span>
                          </div>
                          <div className="flex flex-col flex-1 min-w-0 justify-center">
                            <h3 className="text-[18px] font-bold text-[#295BA7] tracking-tight truncate pr-2 leading-tight drop-shadow-sm text-left">
                              {displayName}
                            </h3>
                            <div className="inline-flex mt-1 text-left">
                              <div className={cn(
                                "px-[8px] py-[6px] rounded-[8px] border-[0.5px] text-[10px] font-bold uppercase tracking-wider leading-none shadow-[0_1px_2px_rgba(0,0,0,0.05)] flex items-center justify-center text-center",
                                "border-amber-200/80 bg-amber-50 text-amber-700"
                              )}>
                                {subDisplay.title}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Área Rolável */}
                      <div className="flex-1 overflow-y-auto bg-white scrollbar-hide relative z-0 pb-4">
                        <div className="flex flex-col pt-1">
                          <div className="py-[6px] flex flex-col gap-[2px]">
                            {[
                              { to: "/", label: "Home", icon: "🏠" },
                              { to: "/despesas", label: "Despesas", icon: "💸" },
                              { to: "/receitas", label: "Receitas", icon: "💰" },
                              { to: "/lancamentos", label: "Lançamentos", icon: "📝" },
                              { to: "/dashboard", label: "Dashboard", icon: "📊" },
                            ].map((item) => (
                              <RouterNavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setIsOpen(false)}
                                className={({ isActive }) => cn(
                                  "relative w-[calc(100%-24px)] mx-3 flex items-center justify-start gap-[10px] px-3 py-1 min-h-[34px] rounded-[14px] transition-colors duration-200 outline-none",
                                  isActive 
                                    ? "bg-[#F1F6FF] border border-[#D6E4FF] shadow-[0_2px_7px_rgba(15,23,42,0.02)] text-[#295BA7] font-semibold" 
                                    : "bg-transparent text-slate-700 font-semibold hover:bg-[#F8FAFC] active:bg-[#F1F5F9] border border-transparent"
                                )}
                              >
                                {({ isActive }) => (
                                  <>
                                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[60%] w-[3px] bg-[#295BA7] rounded-r-[3px]" />}
                                    <span className="flex items-center justify-center w-5 h-5 text-[18px] shrink-0">{item.icon}</span>
                                    <span className="text-[14px] font-semibold">{item.label}</span>
                                  </>
                                )}
                              </RouterNavLink>
                            ))}
                          </div>
                          
                          <div className="shrink-0" style={{ borderTop: '1px solid #D7E3F4', margin: '10px 14px' }} />
                          
                          <div className="py-[6px] flex flex-col gap-[2px]">
                            {[
                              { to: "/investimentos", label: "Investimentos", icon: "📈" },
                              { to: "/metas", label: "Metas", icon: "🎯" },
                              { to: "/orcamentos", label: "Planejamento", icon: "🧮" },
                            ].map((item) => (
                              <RouterNavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setIsOpen(false)}
                                className={({ isActive }) => cn(
                                  "relative w-[calc(100%-24px)] mx-3 flex items-center justify-start gap-[10px] px-3 py-1 min-h-[34px] rounded-[14px] transition-colors duration-200 outline-none",
                                  isActive 
                                    ? "bg-[#F1F6FF] border border-[#D6E4FF] shadow-[0_2px_7px_rgba(15,23,42,0.02)] text-[#295BA7] font-semibold" 
                                    : "bg-transparent text-slate-700 font-semibold hover:bg-[#F8FAFC] active:bg-[#F1F5F9] border border-transparent"
                                )}
                              >
                                {({ isActive }) => (
                                  <>
                                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[60%] w-[3px] bg-[#295BA7] rounded-r-[3px]" />}
                                    <span className="flex items-center justify-center w-5 h-5 text-[18px] shrink-0">{item.icon}</span>
                                    <span className="text-[14px] font-semibold">{item.label}</span>
                                  </>
                                )}
                              </RouterNavLink>
                            ))}
                          </div>

                          <div className="shrink-0" style={{ borderTop: '1px solid #D7E3F4', margin: '10px 14px' }} />

                          <div className="py-[6px] flex flex-col gap-[2px]">
                            {[
                              { to: "/categorias", label: "Categorias", icon: "🗂️" },
                              { to: "/lista-de-compras", label: "Lista de Compras", icon: "🛒" },
                              { to: "/perfil", label: "Meu Perfil", icon: "👤" },
                            ].map((item) => (
                              <RouterNavLink
                                key={item.to}
                                to={item.to}
                                onClick={() => setIsOpen(false)}
                                className={({ isActive }) => cn(
                                  "relative w-[calc(100%-24px)] mx-3 flex items-center justify-start gap-[10px] px-3 py-1 min-h-[34px] rounded-[14px] transition-colors duration-200 outline-none",
                                  isActive 
                                    ? "bg-[#F1F6FF] border border-[#D6E4FF] shadow-[0_2px_7px_rgba(15,23,42,0.02)] text-[#295BA7] font-semibold" 
                                    : "bg-transparent text-slate-700 font-semibold hover:bg-[#F8FAFC] active:bg-[#F1F5F9] border border-transparent"
                                )}
                              >
                                {({ isActive }) => (
                                  <>
                                    {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[60%] w-[3px] bg-[#295BA7] rounded-r-[3px]" />}
                                    <span className="flex items-center justify-center w-5 h-5 text-[18px] shrink-0">{item.icon}</span>
                                    <span className="text-[14px] font-semibold">{item.label}</span>
                                  </>
                                )}
                              </RouterNavLink>
                            ))}
                          </div>
                        </div>
                      </div>
                      
                      {/* Rodapé Fixo Compacto */}
                      <div className="shrink-0 pt-[14px] pb-[18px] px-4 bg-[linear-gradient(135deg,#ffffff_0%,#fbfdff_50%,#f4f8ff_100%)] border-t border-[rgba(180,200,230,0.5)] shadow-[0_-4px_20px_rgba(15,23,42,0.02)] flex items-center justify-between relative">
                        <div className="flex items-center gap-2.5">
                          <img src="/icons/logo.png" alt="Logo" className="w-[34px] h-[34px] shrink-0" />
                          <div className="flex flex-col text-left">
                            <span className="text-[15px] font-extrabold text-[#1E3A8B] tracking-tight leading-[1] mb-0.5">
                              Minhas Finança<span className="text-[#22c55e]">$</span>
                            </span>
                            <p className="text-[11px] text-slate-600 font-medium leading-tight mb-0">Controle Financeiro</p>
                            <p className="text-[10px] text-slate-400 leading-tight m-0">Versão 3.0.0</p>
                          </div>
                        </div>
                        <button 
                          onClick={signOut}
                          className="flex items-center gap-1.5 py-1 px-2 -mr-2 rounded-lg hover:bg-red-50 active:bg-red-100 transition-colors shrink-0"
                        >
                          <span className="text-[14px] font-semibold text-[#dc2626]">Sair</span>
                          <LogOut className="w-[18px] h-[18px] text-[#dc2626]" strokeWidth={2.5} />
                        </button>
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
