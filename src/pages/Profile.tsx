import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileAccountForm } from "@/components/profile/ProfileAccountForm";
import { ProfilePasswordModal } from "@/components/profile/ProfilePasswordModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreditCard, Sparkles, Gem, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { cn } from "@/lib/utils";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const { data: profile, isLoading } = useProfile(user?.id);

  const handleUpdateApp = async () => {
    toast.loading("Atualizando aplicação...", { id: "update-app" });
    try {
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(key => caches.delete(key)));
      }
      toast.success("Aplicação atualizada com sucesso", { id: "update-app" });
      setTimeout(() => {
        window.location.reload();
      }, 500);
    } catch (err) {
      toast.error("Erro ao atualizar a aplicação", { id: "update-app" });
    }
  };

  if (isLoading || !profile) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">Carregando Perfil...</div>
      </div>
    );
  }

  const sub = profile?.subscriptions;
  const type = sub?.subscription_type || 'trial';
  const isExpired = profile?.isExpired;
  const hasActiveSub = profile?.hasActiveSubscription;
  const expiresAt = sub?.expires_at ? new Intl.DateTimeFormat("pt-BR").format(new Date(sub.expires_at)) : "";

  const getSubscriptionDisplay = () => {
    // 1. Conta Bloqueada
    if (sub?.subscription_status === 'blocked') {
      return {
        key: 'blocked',
        topGradient: "from-rose-400/25 via-rose-100/10 to-transparent",
        bg: "bg-rose-50/40 border-rose-100/70",
        badgeBg: "bg-rose-500/15 border border-rose-500/25 text-rose-700 backdrop-blur-md shadow-sm",
        ringClassName: "ring-4 ring-rose-400/60 shadow-[0_0_16px_rgba(244,63,94,0.25)]",
        buttonBg: "bg-gradient-to-b from-rose-500 to-rose-600 shadow-[0_4px_12px_rgba(244,63,94,0.4)]",
        icon: "🔴",
        title: "Conta Bloqueada",
        subtitle: "Nenhum recurso disponível",
        subIcon: "❌",
        subColor: "text-rose-600",
        decorType: "alert"
      };
    }

    // 2. Assinaturas Ativas
    if (hasActiveSub) {
      if (type.includes('lifetime')) {
        return {
          key: 'lifetime',
          topGradient: "from-amber-400/25 via-amber-100/15 to-transparent",
          bg: "bg-amber-50/40 border-amber-100/70",
          badgeBg: "bg-gradient-to-r from-amber-500/15 via-yellow-400/15 to-amber-500/15 border border-amber-500/35 text-amber-800 backdrop-blur-md shadow-sm font-bold",
          ringClassName: "ring-[2px] ring-amber-400/70 shadow-[0_0_20px_rgba(245,158,11,0.25)]",
          buttonBg: "bg-gradient-to-b from-amber-400 to-amber-600 shadow-[0_2px_8px_rgba(245,158,11,0.3)]",
          icon: "👑",
          title: "Membro Vitalício",
          subtitle: "Acesso Permanente",
          subIcon: "✨",
          subColor: "text-amber-600",
          decorType: "vitalicio"
        };
      }

      if (type.includes('temp') || type.includes('por_tempo') || sub?.is_temporary) {
        return {
          key: 'premium_temp',
          topGradient: "from-sky-400/25 via-sky-100/15 to-transparent",
          bg: "bg-sky-50/40 border-sky-100/70",
          badgeBg: "bg-sky-500/15 border border-sky-500/25 text-sky-700 backdrop-blur-md shadow-sm",
          ringClassName: "ring-4 ring-sky-400/60 shadow-[0_0_16px_rgba(56,189,248,0.3)]",
          buttonBg: "bg-gradient-to-b from-sky-400 to-sky-500 shadow-[0_4px_12px_rgba(56,189,248,0.4)]",
          icon: "💎",
          title: "Premium",
          subtitle: expiresAt ? `Expira em ${expiresAt}` : "Assinatura ativa",
          subIcon: "📅",
          subColor: "text-sky-600",
          decorType: "premium_temp"
        };
      }

      if (type.includes('premium')) {
        return {
          key: 'premium',
          topGradient: "from-blue-500/20 via-blue-100/15 to-transparent",
          bg: "bg-blue-50/40 border-blue-100/70",
          badgeBg: "bg-blue-500/15 border border-blue-500/25 text-blue-700 backdrop-blur-md shadow-sm",
          ringClassName: "ring-4 ring-blue-500/60 shadow-[0_0_16px_rgba(59,130,246,0.3)]",
          buttonBg: "bg-gradient-to-b from-blue-500 to-blue-600 shadow-[0_4px_12px_rgba(37,99,235,0.4)]",
          icon: "💎",
          title: "Premium",
          subtitle: expiresAt ? `Válido até ${expiresAt}` : "Assinatura ativa",
          subIcon: "📅",
          subColor: "text-blue-600",
          decorType: "premium"
        };
      }
    }

    // 3. Expirado
    if (type.includes('premium') || type.includes('lifetime')) {
      if (isExpired) {
        return {
          key: 'premium_expired',
          topGradient: "from-rose-400/20 via-rose-100/15 to-transparent",
          bg: "bg-rose-50/40 border-rose-100/70",
          badgeBg: "bg-rose-500/15 border border-rose-500/25 text-rose-700 backdrop-blur-md shadow-sm",
          ringClassName: "ring-4 ring-rose-400/60 shadow-[0_0_16px_rgba(244,63,94,0.3)]",
          buttonBg: "bg-gradient-to-b from-rose-500 to-rose-600 shadow-[0_4px_12px_rgba(244,63,94,0.4)]",
          icon: "💎",
          title: "Assinatura Expirada",
          subtitle: expiresAt ? `Expirou em ${expiresAt}` : "Assinatura encerrada",
          subIcon: "❌",
          subColor: "text-rose-600",
          decorType: "alert"
        };
      }
    }

    if (isExpired) {
      return {
        key: 'trial_expired',
        topGradient: "from-rose-400/20 via-rose-100/15 to-transparent",
        bg: "bg-rose-50/40 border-rose-100/70",
        badgeBg: "bg-rose-500/15 border border-rose-500/25 text-rose-700 backdrop-blur-md shadow-sm",
        ringClassName: "ring-4 ring-rose-400/60 shadow-[0_0_16px_rgba(244,63,94,0.3)]",
        buttonBg: "bg-gradient-to-b from-rose-500 to-rose-600 shadow-[0_4px_12px_rgba(244,63,94,0.4)]",
        icon: "🧪",
        title: "Trial Expirado",
        subtitle: expiresAt ? `Expirou em ${expiresAt}` : "Avaliação encerrada",
        subIcon: "❌",
        subColor: "text-rose-600",
        decorType: "alert"
      };
    }

    // 4. Default: Trial (Menta)
    return {
      key: 'trial',
      topGradient: "from-emerald-300/35 via-emerald-100/15 to-transparent",
      bg: "bg-emerald-50/40 border-emerald-100/70",
      badgeBg: "bg-emerald-500/15 border border-emerald-500/25 text-emerald-700 backdrop-blur-md shadow-sm",
      ringClassName: "ring-4 ring-emerald-400/60 shadow-[0_0_16px_rgba(52,211,153,0.3)]",
      buttonBg: "bg-gradient-to-b from-emerald-500 to-emerald-600 shadow-[0_4px_12px_rgba(16,185,129,0.4)]",
      icon: "🧪",
      title: "Trial",
      subtitle: expiresAt ? `Expira em ${expiresAt}` : "30 dias de avaliação",
      subIcon: "📅",
      subColor: "text-emerald-600",
      decorType: "trial"
    };
  };

  const subDisplay = getSubscriptionDisplay();

  return (
    <div
      className={cn(
        "flex flex-col min-h-screen global-bg md:pt-[72px]",
        isMobile && "bg-[#F9FAFB]"
      )}
    >
      {/* HEADER PREMIUM — FINTECH STYLE (DESKTOP) */}
      {!isMobile && (
        <div className="relative h-[220px] w-full overflow-hidden bg-transparent">
          <div className="container-app relative z-10 pt-12 md:pt-[72px] flex justify-between items-start">
            <div>
              <div className="flex items-start gap-3">
                <Button
                  variant="ghost"
                  className="btn-3d p-2 rounded-xl flex items-center justify-center shadow-sm border-none cursor-pointer hover:scale-105 active:scale-95 transition-all h-auto w-auto mt-1"
                  style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
                  onClick={() => navigate(-1)}
                >
                  <span className="text-xl">👤</span>
                </Button>
                <div className="flex flex-col">
                  <h1 className="text-2xl font-black tracking-tight -mt-0.5 text-slate-800">
                    Meu Perfil
                  </h1>
                  <p className="text-sm font-bold -mt-0.5 leading-none text-slate-500">
                    Gerencie suas informações e configurações da conta
                  </p>
                </div>
              </div>
            </div>


            <Button
              onClick={handleUpdateApp}
              className="btn-3d h-9 w-9 p-0 rounded-xl flex items-center justify-center shadow-sm border-none transition-all active:scale-95 !text-[#1E6BCE] bg-white hover:bg-white/90"
              style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
              title="Atualizar Aplicação"
            >
              <DynamicIcon name="RefreshCw" className="w-4 h-4 !text-[#1E6BCE]" strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      )}

      <main
        className={cn(
          "container-app relative z-20 space-y-6 flex-grow",
          isMobile ? "pt-[calc(4rem+env(safe-area-inset-top))] pb-10" : "-mt-14 pb-[40px]"
        )}
      >
        {isMobile && (
          <div className="mb-6 md:mb-8 flex justify-between items-start w-full">
            <div className="flex gap-2 items-start">
              <span className="text-[26px] leading-none pt-1">{profile.avatar || "👽"}</span>
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-[#1e293b] tracking-tight mb-[2px] md:mb-[5px]">
                  Meu Perfil
                </h1>
                <p className="text-slate-500 font-medium text-sm md:text-base">Gerencie suas informações da conta.</p>
              </div>
            </div>
            <button
              onClick={handleUpdateApp}
              className="text-slate-400 hover:text-blue-500 transition-colors p-2 rounded-full hover:bg-slate-100 mt-1 -translate-y-[10px]"
              title="Atualizar Aplicação"
            >
              <DynamicIcon name="RefreshCw" className="w-5 h-5" />
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Card Esquerdo - Avatar e Infos Rápidas */}
          <div className={cn(
            "w-full md:w-[40%] -mt-1 md:mt-0 bg-white rounded-[25px] shadow-[0_8px_30px_rgb(0,0,0,0.05),_inset_0_2px_4px_rgba(255,255,255,0.6)] p-5 md:p-8 flex flex-col items-center relative overflow-hidden",
            subDisplay.decorType === "vitalicio" ? "border-[1px] border-amber-400/40 shadow-[0_0_20px_rgba(245,158,11,0.1),_0_8px_30px_rgb(0,0,0,0.05)]" : "border border-slate-100/80"
          )}>
            {/* 1. Faixa Superior Temática */}
            <div className={cn("absolute top-0 left-0 right-0 h-32 bg-gradient-to-b pointer-events-none z-0 rounded-t-[25px]", subDisplay.topGradient)}>
              {subDisplay.decorType === "vitalicio" && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_top,_rgba(245,158,11,0.15)_0%,_transparent_60%)]" />
              )}
            </div>

            {/* 6. Elementos Decorativos */}
            {subDisplay.decorType === "trial" && (
              <>
                <Sparkles className="w-5 h-5 text-emerald-400/40 absolute top-4 right-5 pointer-events-none z-0" />
                <Sparkles className="w-4 h-4 text-emerald-400/30 absolute top-7 left-6 pointer-events-none z-0" />
              </>
            )}
            {subDisplay.decorType === "premium" && (
              <Gem className="w-7 h-7 text-blue-400/35 absolute top-4 right-5 pointer-events-none z-0" />
            )}
            {subDisplay.decorType === "premium_temp" && (
              <Gem className="w-7 h-7 text-sky-400/25 absolute top-4 right-5 pointer-events-none z-0" />
            )}
            {subDisplay.decorType === "vitalicio" && (
              <>
                <Sparkles className="w-4 h-4 text-amber-400/70 absolute top-5 right-6 pointer-events-none z-0" />
                <Sparkles className="w-3 h-3 text-amber-400/60 absolute top-8 left-8 pointer-events-none z-0" />
                <div className="absolute top-10 left-12 w-1 h-1 rounded-full bg-amber-400/50 pointer-events-none" />
                <div className="absolute top-7 right-12 w-1.5 h-1.5 rounded-full bg-amber-400/40 pointer-events-none" />
              </>
            )}
            {subDisplay.decorType === "alert" && (
              <AlertCircle className="w-6 h-6 text-rose-400/40 absolute top-4 right-5 pointer-events-none z-0" />
            )}

            <ProfileAvatar 
              userId={user!.id} 
              currentAvatarEmoji={profile.avatar} 
              ringClassName={subDisplay.ringClassName}
              buttonBg={subDisplay.buttonBg}
              decorType={subDisplay.decorType}
            />

            <h2 className={cn(
              "text-slate-800 tracking-tight text-center relative z-10",
              subDisplay.decorType === "vitalicio" ? "mt-3 text-xl md:text-2xl font-bold" : "mt-4 text-2xl font-extrabold"
            )}>{profile.nome || "Usuário"}</h2>
            <p className={cn(
              "text-slate-500/80 text-center relative z-10",
              subDisplay.decorType === "vitalicio" ? "font-medium text-[13px] md:text-[14px] mb-6" : "font-medium text-[15px] mb-8"
            )}>{user?.email}</p>

            <div className="w-full flex flex-col gap-4 mb-4 relative z-10">
              <div className="w-full flex flex-col items-center justify-center gap-2">
                <span className={cn("flex items-center justify-center gap-2 w-full h-12 rounded-[16px] text-[16px] font-bold transition-all", subDisplay.badgeBg)}>
                  <span className="text-[20px] leading-none">{subDisplay.icon}</span>
                  {subDisplay.title}
                </span>
                
                {subDisplay.subtitle && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <span className="text-[15px] leading-none">{subDisplay.subIcon}</span>
                    <span className="text-[13px] font-semibold tracking-wide">{subDisplay.subtitle}</span>
                  </div>
                )}
              </div>
              
              <Button 
                onClick={() => window.dispatchEvent(new Event("open-subscription-modal"))}
                className="w-full rounded-[16px] bg-gradient-to-b from-[#3B82F6] to-[#2563EB] hover:opacity-90 text-white font-bold text-[17px] shadow-[0_4px_14px_rgba(37,99,235,0.3)] h-12 transition-all hover:translate-y-[-1px]"
              >
                {type.startsWith('premium') && isExpired ? (
                  <>
                    <span className="mr-2 text-lg leading-none">🔄</span>
                    Renovar Assinatura
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2 text-white/90" />
                    Gerenciar Assinatura
                  </>
                )}
              </Button>
            </div>

            <div className="w-full flex flex-col relative z-10">
              <ProfilePasswordModal />
            </div>
          </div>

          {/* Card Direito - Formulário */}
          <div className="w-full md:w-[60%] bg-white rounded-[25px] shadow-[0_8px_30px_rgb(0,0,0,0.06),_inset_0_2px_4px_rgba(255,255,255,0.5)] border border-slate-100 p-5 md:p-10">
            <ProfileAccountForm profile={profile} user={user!} />
          </div>
        </div>
      </main>

      <Footer isMobile={isMobile} user={user} className={cn(isMobile ? "mt-0 mb-2 bg-transparent" : "mt-8")} />
    </div>
  );
}

