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

export default function Profile() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const { data: profile, isLoading } = useProfile(user?.id);

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
          badgeBg: "bg-gradient-to-r from-amber-500/15 via-yellow-400/15 to-amber-500/15 border border-amber-500/35 text-amber-800 backdrop-blur-md shadow-sm font-black",
          ringClassName: "ring-4 ring-amber-400/70 shadow-[0_0_20px_rgba(245,158,11,0.35)]",
          buttonBg: "bg-gradient-to-b from-amber-400 to-amber-600 shadow-[0_4px_12px_rgba(245,158,11,0.4)]",
          icon: "👑",
          title: "Membro Vitalício",
          subtitle: "Acesso Permanente",
          subIcon: "⏳",
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
              onClick={() => navigate(-1)}
              className="btn-3d h-9 px-3 rounded-xl font-black text-xs shadow-sm border-none transition-all active:scale-95 !text-[#1E6BCE] bg-white hover:bg-white/90"
              style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
            >
              <DynamicIcon name="ChevronLeft" className="mr-1 h-4 w-4 !text-[#1E6BCE]" strokeWidth={3} />
              Voltar
            </Button>
          </div>
        </div>
      )}

      <main
        className={cn(
          "container-app relative z-20 space-y-6 flex-grow",
          isMobile ? "pt-16 pb-10" : "-mt-14 pb-[40px]"
        )}
      >
        {isMobile && (
          <div className="mb-6 md:mb-8">
            <h1 className="text-2xl md:text-3xl font-extrabold text-[#1e293b] tracking-tight mb-2 flex items-center gap-2">
              <span className="text-[26px] leading-none">{profile.avatar || "😎"}</span>
              Meu Perfil
            </h1>
            <p className="text-slate-500 font-medium text-sm md:text-base">Gerencie suas informações e configurações da conta</p>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Card Esquerdo - Avatar e Infos Rápidas */}
          <div className="w-full md:w-[40%] bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.05),_inset_0_2px_4px_rgba(255,255,255,0.6)] border border-slate-100/80 p-5 md:p-8 flex flex-col items-center relative overflow-hidden">
            {/* 1. Faixa Superior Temática */}
            <div className={cn("absolute top-0 left-0 right-0 h-28 bg-gradient-to-b pointer-events-none z-0", subDisplay.topGradient)} />

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
                <Sparkles className="w-5 h-5 text-amber-400/50 absolute top-4 right-5 pointer-events-none z-0" />
                <Sparkles className="w-4 h-4 text-amber-400/40 absolute top-6 left-6 pointer-events-none z-0" />
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

            <h2 className="mt-4 text-2xl font-extrabold text-slate-800 tracking-tight text-center relative z-10">{profile.nome || "Usuário"}</h2>
            <p className="text-slate-500/80 font-medium text-[15px] text-center mb-8 relative z-10">{user?.email}</p>

            <div className="w-full flex flex-col gap-4 mb-4 relative z-10">
              <div className="flex flex-col items-center justify-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[14px] font-bold transition-all", subDisplay.badgeBg)}>
                  <span className="text-[17px] leading-none">{subDisplay.icon}</span>
                  {subDisplay.title}
                </span>
                
                {subDisplay.subtitle && (
                  <div className={cn("flex items-center gap-1.5", subDisplay.subColor)}>
                    <span className="text-[14px] leading-none">{subDisplay.subIcon}</span>
                    <span className="text-[12px] font-medium tracking-wide">{subDisplay.subtitle}</span>
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
          <div className="w-full md:w-[60%] bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.06),_inset_0_2px_4px_rgba(255,255,255,0.5)] border border-slate-100 p-5 md:p-10">
            <ProfileAccountForm profile={profile} user={user!} />
          </div>
        </div>
      </main>

      <Footer isMobile={isMobile} user={user} className={cn(isMobile ? "mt-0 mb-2 bg-transparent" : "mt-8")} />
    </div>
  );
}

