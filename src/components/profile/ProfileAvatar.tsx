import { useState } from "react";
import { SmilePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from "@/components/ui/dialog";

interface ProfileAvatarProps {
  userId: string;
  currentAvatarEmoji?: string | null;
}

export function ProfileAvatar({ userId, currentAvatarEmoji }: ProfileAvatarProps) {
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
      <div className="relative group mb-2">
        <div 
          className={`w-36 h-36 md:w-40 md:h-40 rounded-[32px] border-[6px] border-white shadow-[0_12px_35px_rgba(0,0,0,0.12)] overflow-hidden bg-slate-50 flex items-center justify-center cursor-pointer relative transition-all duration-300 group-hover:scale-[1.02] ${isUploading ? 'opacity-50' : ''}`}
          onClick={() => setIsEmojiPickerOpen(true)}
        >
          <div className="text-6xl md:text-7xl">
            {displayEmoji}
          </div>
          
          <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <SmilePlus className="w-8 h-8 text-white mb-1" />
            <span className="text-white text-xs font-bold">Alterar</span>
          </div>
        </div>

        <button 
          onClick={() => setIsEmojiPickerOpen(true)}
          className="absolute bottom-1 right-1 w-11 h-11 bg-gradient-to-b from-[#4A72BA] to-[#3B5B96] hover:opacity-90 text-white rounded-full flex items-center justify-center shadow-[0_4px_12px_rgba(59,91,150,0.4)] transition-all hover:-translate-y-0.5 active:scale-95"
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
