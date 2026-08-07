import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileAccountForm } from "@/components/profile/ProfileAccountForm";
import { ProfilePasswordModal } from "@/components/profile/ProfilePasswordModal";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { CreditCard } from "lucide-react";
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

  const getSubscriptionDisplay = () => {
    if (sub?.subscription_status === 'blocked') {
      return {
        bg: "bg-red-50/50 border-red-100/50",
        badgeBg: "bg-red-100/60 text-red-700 shadow-[0_2px_10px_rgba(239,68,68,0.1)]",
        icon: "🔴",
        title: "Conta Bloqueada",
        subtitle: "Nenhum recurso pago disponível"
      };
    }

    const expiresAt = sub?.expires_at ? new Intl.DateTimeFormat("pt-BR").format(new Date(sub.expires_at)) : "";
    const hasActiveSub = profile?.hasActiveSubscription;

    if (hasActiveSub) {
      if (type.includes('lifetime')) {
        return {
          bg: "bg-amber-50/50 border-amber-100/50",
          badgeBg: "bg-amber-100/60 text-amber-700 shadow-[0_2px_10px_rgba(245,158,11,0.1)]",
          icon: "👑",
          title: "Vitalício",
          subtitle: "Acesso permanente"
        };
      }
      if (type.includes('premium')) {
        return {
          bg: "bg-blue-50/50 border-blue-100/50",
          badgeBg: "bg-blue-100/60 text-blue-700 shadow-[0_2px_10px_rgba(59,130,246,0.1)]",
          icon: "💎",
          title: "Premium",
          subtitle: `Válido até ${expiresAt}`
        };
      }
    }

    if (type.includes('premium') || type.includes('lifetime')) {
      if (isExpired) {
        return {
          bg: "bg-red-50/50 border-red-100/50",
          badgeBg: "bg-red-100/60 text-red-700 shadow-[0_2px_10px_rgba(239,68,68,0.1)]",
          icon: "💎",
          title: "Assinatura Expirada",
          subtitle: `Expirou em ${expiresAt}`
        };
      }
    }

    if (isExpired) {
      return {
        bg: "bg-red-50/50 border-red-100/50",
        badgeBg: "bg-red-100/60 text-red-700 shadow-[0_2px_10px_rgba(239,68,68,0.1)]",
        icon: "🧪",
        title: "Trial Expirado",
        subtitle: `Expirou em ${expiresAt}`
      };
    }

    return {
      bg: "bg-emerald-50/50 border-emerald-100/50",
      badgeBg: "bg-emerald-100/60 text-emerald-700 shadow-[0_2px_10px_rgba(16,185,129,0.1)]",
      icon: "🧪",
      title: "Trial",
      subtitle: expiresAt ? `Expira em ${expiresAt}` : "30 dias de avaliação"
    };
  };

  const subDisplay = getSubscriptionDisplay();

  return (
    <div
      className={cn(
        "flex flex-col min-h-screen bg-background md:pt-[72px]",
        isMobile && "bg-[#F9FAFB]"
      )}
    >
      {/* HEADER PREMIUM — FINTECH STYLE (DESKTOP) */}
      {!isMobile && (
        <div className="relative h-[220px] w-full overflow-hidden bg-background">
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
          <div className="w-full md:w-[40%] bg-white rounded-[32px] shadow-[0_8px_30px_rgb(0,0,0,0.06),_inset_0_2px_4px_rgba(255,255,255,0.5)] border border-slate-100 p-5 md:p-8 flex flex-col items-center relative overflow-hidden">
            <ProfileAvatar 
              userId={user!.id} 
              currentAvatarEmoji={profile.avatar} 
            />

            <h2 className="mt-5 text-2xl font-extrabold text-slate-800 tracking-tight text-center">{profile.nome || "Usuário"}</h2>
            <p className="text-slate-500/80 font-medium text-[15px] text-center mb-8">{user?.email}</p>

            <div className="w-full flex flex-col gap-4 mb-4">
              <div className={`flex items-center justify-between px-4 py-3.5 rounded-[20px] border ${subDisplay.bg}`}>
                <span className="text-sm font-semibold text-slate-500">{subDisplay.subtitle}</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[13px] font-bold ${subDisplay.badgeBg}`}>
                  <span className="text-base leading-none">{subDisplay.icon}</span>
                  {subDisplay.title}
                </span>
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

            <div className="w-full flex flex-col">
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
