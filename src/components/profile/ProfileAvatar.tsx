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
            <Crown className="w-7 h-7 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)] fill-amber-400/30" />
          </div>
        )}

        {/* Outer Ring */}
        <div className={cn("rounded-full p-1 transition-all duration-300", ringClassName || "ring-4 ring-slate-200")}>
          <div 
            className={cn(
              "w-28 h-28 md:w-32 md:h-32 rounded-full border-[5px] border-white shadow-[0_8px_25px_rgba(0,0,0,0.08)] overflow-hidden bg-slate-50 flex items-center justify-center cursor-pointer relative transition-all duration-300 group-hover:scale-[1.02]",
              isUploading ? 'opacity-50' : ''
            )}
            onClick={() => setIsEmojiPickerOpen(true)}
          >
            <div className="text-5xl md:text-6xl select-none">
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
            "absolute bottom-1 right-1 w-11 h-11 text-white rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 z-20",
            buttonBg || "bg-gradient-to-b from-[#4A72BA] to-[#3B5B96] shadow-[0_4px_12px_rgba(59,91,150,0.4)]"
          )}
          disabled={isUploading}
        >
          <SmilePlus className="w-[22px] h-[22px]" />
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

