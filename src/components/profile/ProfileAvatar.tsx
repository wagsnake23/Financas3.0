import { useState } from "react";
import { SmilePlus, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  userId: string;
  currentAvatarEmoji?: string | null;
  ringClassName?: string;
  buttonBg?: string;
  decorType?: string;
}

export function ProfileAvatar({ userId, currentAvatarEmoji, ringClassName, buttonBg, decorType }: ProfileAvatarProps) {
  const LaurelBranch = ({ className, isLeft }: { className?: string; isLeft?: boolean }) => (
    <svg className={className} viewBox="0 0 100 150" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ transform: isLeft ? 'scaleX(-1)' : 'none' }}>
      <path d="M 50 150 C 40 100, 20 50, 70 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      <path d="M 45 125 C 20 110, 10 90, 30 80 C 40 85, 45 105, 45 125 Z" fill="currentColor"/>
      <path d="M 37 95 C 10 80, 0 60, 20 50 C 30 55, 37 75, 37 95 Z" fill="currentColor"/>
      <path d="M 33 65 C 5 50, -5 30, 15 20 C 25 25, 33 45, 33 65 Z" fill="currentColor"/>
      <path d="M 32 35 C 5 20, -5 0, 15 -10 C 25 -5, 32 15, 32 35 Z" fill="currentColor"/>
      <path d="M 50 110 C 70 95, 80 75, 60 65 C 50 70, 45 90, 50 110 Z" fill="currentColor"/>
      <path d="M 58 80 C 80 65, 90 45, 70 35 C 60 40, 53 60, 58 80 Z" fill="currentColor"/>
      <path d="M 64 50 C 90 35, 100 15, 80 5 C 70 10, 59 30, 64 50 Z" fill="currentColor"/>
    </svg>
  );
  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useToast();
  
  const [isUploading, setIsUploading] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

  const displayEmoji = currentAvatarEmoji || "😎";

  const handleEmojiClick = async (emojiData: EmojiClickData) => {
    try {
      setIsUploading(true);
      
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar: emojiData.emoji })
        .eq("id", userId);

      if (updateError) throw updateError;

      queryClient.setQueryData(["profile", userId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          avatar: emojiData.emoji
        };
      });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccessToast("Sucesso", "Avatar atualizado com sucesso!");
      setIsEmojiPickerOpen(false);

    } catch (error: any) {
      console.error("Update error:", error);
      showErrorToast("Erro", "Erro ao atualizar avatar.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <div className="relative group mt-6 mb-2 z-10">
        {/* Crown para o tema Vitalício */}
        {decorType === "vitalicio" && (
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 flex items-center justify-center text-amber-500 z-20">
            <Crown className="w-6 h-6 md:w-7 md:h-7 drop-shadow-[0_2px_4px_rgba(245,158,11,0.4)] fill-amber-400/40" strokeWidth={2} />
          </div>
        )}

        {/* Folhas para o tema Vitalício */}
        {decorType === "vitalicio" && (
          <>
            <div className="absolute top-1/2 -translate-y-1/2 -left-8 md:-left-10 text-amber-400/80 z-0 opacity-90">
              <LaurelBranch className="w-8 h-20 md:w-10 md:h-24 drop-shadow-sm" isLeft={true} />
            </div>
            <div className="absolute top-1/2 -translate-y-1/2 -right-8 md:-right-10 text-amber-400/80 z-0 opacity-90">
              <LaurelBranch className="w-8 h-20 md:w-10 md:h-24 drop-shadow-sm" isLeft={false} />
            </div>
          </>
        )}

        {/* Outer Ring */}
        <div className={cn("rounded-full p-1 transition-all duration-300 relative z-10", ringClassName || "ring-4 ring-slate-200")}>
          <div 
            className={cn(
              "rounded-full border-[5px] border-white shadow-[0_8px_25px_rgba(0,0,0,0.08)] overflow-hidden bg-slate-50 flex items-center justify-center cursor-pointer relative transition-all duration-300 group-hover:scale-[1.02]",
              decorType === "vitalicio" ? "w-24 h-24 md:w-28 md:h-28" : "w-28 h-28 md:w-32 md:h-32",
              isUploading ? 'opacity-50' : ''
            )}
            onClick={() => setIsEmojiPickerOpen(true)}
          >
            <div className={cn(
              "select-none",
              decorType === "vitalicio" ? "text-5xl md:text-6xl" : "text-6xl md:text-7xl"
            )}>
              {displayEmoji}
            </div>
            
            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full">
              <SmilePlus className="w-8 h-8 text-white mb-1" />
              <span className="text-white text-xs font-bold">Alterar</span>
            </div>
          </div>
        </div>

        {/* Floating Button */}
        <button 
          onClick={() => setIsEmojiPickerOpen(true)}
          className={cn(
            "absolute bottom-0 right-0 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 z-20",
            decorType === "vitalicio" ? "w-7 h-7 md:w-8 md:h-8" : "w-8 h-8 md:w-9 md:h-9",
            buttonBg || "bg-gradient-to-b from-[#4A72BA] to-[#3B5B96] shadow-[0_4px_12px_rgba(59,91,150,0.4)]"
          )}
          disabled={isUploading}
        >
          <SmilePlus className={cn(
            decorType === "vitalicio" ? "w-3.5 h-3.5 md:w-4 md:h-4" : "w-4 h-4 md:w-5 md:h-5"
          )} />
        </button>
      </div>

      <Dialog open={isEmojiPickerOpen} onOpenChange={setIsEmojiPickerOpen}>
        <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl [&>button]:top-4 [&>button]:right-4">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-extrabold text-[#1E3A8B]">Escolher Avatar</DialogTitle>
            <DialogDescription className="text-slate-500">
              Selecione o emoji que melhor te representa.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center -mx-6 px-6 pb-2">
            <EmojiPicker
              onEmojiClick={handleEmojiClick}
              autoFocusSearch={false}
              theme={"light" as any}
              lazyLoadEmojis={true}
              searchPlaceHolder="Buscar emoji..."
              width="100%"
              height="400px"
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

