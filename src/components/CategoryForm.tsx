import { useState, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppCategory } from "@/types/finance";
import { toast } from "sonner";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { PAYMENT_METHODS } from "@/data/colorPalette"; // Manter para referência, se necessário
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile"; // Importar useIsMobile
import { cn } from "@/lib/utils"; // Importar cn
import DynamicIcon from "./DynamicIcon"; // Importar DynamicIcon
import { getCategoryColor } from "@/lib/categoryColors";

interface CategoryFormProps {
  onAddCategory: (
    category: Omit<AppCategory, "id" | "user_id" | "created_at">
  ) => void;
  onUpdateCategory?: (
    id: string,
    category: Omit<AppCategory, "id" | "user_id" | "created_at">
  ) => void;
  editingCategory?: AppCategory | null;
  onCancelEdit?: () => void;
  allCategories: AppCategory[]; // Agora recebe todas as categorias (principais e sub)
  hideCardWrapper?: boolean; // NOVA PROP
}

const UNSELECTED_VALUE = "unselected";
const toastDuration = 1000; // 1 segundo para todos os dispositivos
const toastSuccessStyle = { backgroundColor: "#FFFFFF", color: "#006000", border: "1px solid #E5FFE5" };
const toastErrorStyle = { backgroundColor: "#FFFFFF", color: "#FF2929", border: "1px solid #FFE5E5" };

export const CategoryForm = ({
  onAddCategory,
  onUpdateCategory,
  editingCategory,
  onCancelEdit,
  allCategories,
  hideCardWrapper = false, // Valor padrão é false
}: CategoryFormProps) => {
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("😀");
  const [cor, setCor] = useState("hsl(210, 70%, 50%)");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile(); // Usar o hook useIsMobile

  // Load editing data when editingCategory changes
  useEffect(() => {
    if (editingCategory) {
      setNome(editingCategory.nome);
      setIcone(editingCategory.icone);
      setCor(editingCategory.cor);
      setSelectedParentId(editingCategory.parent_id);
    } else {
      // Reset form when not editing
      setNome("");
      setIcone("😀");
      setCor("hsl(210, 70%, 50%)");
      setSelectedParentId(null);
    }
  }, [editingCategory]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setIcone(emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!selectedParentId || selectedParentId === UNSELECTED_VALUE) {
      toast.error("Selecione uma Categoria Principal para a subcategoria.", {
        duration: toastDuration,
        style: toastErrorStyle,
      });
      return;
    }

    if (!nome.trim()) {
      toast.error("Preencha o nome da subcategoria", {
        duration: toastDuration,
        style: toastErrorStyle,
      });
      return;
    }

    const categoryData: Omit<AppCategory, "id" | "user_id" | "created_at"> = {
      nome: nome.trim(),
      icone,
      cor,
      forma_pagamento: null,
      parent_id: selectedParentId,
    };

    if (editingCategory && onUpdateCategory) {
      onUpdateCategory(editingCategory.id, categoryData);
    } else {
      onAddCategory(categoryData);
    }

    // Reset form (handled by useEffect when editingCategory becomes null)
    if (!editingCategory && onCancelEdit) {
      onCancelEdit(); // This will clear the form
    }
  };

  const handleCancel = () => {
    if (onCancelEdit) {
      onCancelEdit();
    }
  };

  // Filter categories that can be selected as a parent (only root categories)
  const possibleParentCategories = useMemo(() => {
    return allCategories.filter((cat) => cat.parent_id === null);
  }, [allCategories]);

  const formContent = (
    <>
      {!hideCardWrapper && ( // Renderiza o título apenas se não estiver escondendo o Card Wrapper
        <div className="flex items-center justify-between mb-6">
          <h2 className={cn("text-2xl font-bold", isMobile && "text-xl")}>
            🗂️ {editingCategory ? "Editar Subcategoria" : "Nova Subcategoria"}
          </h2>
          {editingCategory && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCancel}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className={cn("space-y-4", isMobile && "space-y-2")}
      >
        <div className={cn("space-y-2", isMobile && "space-y-1")}>
          <Label htmlFor="parent_id" className={cn(isMobile && "text-xs")}>
            Categoria Principal
          </Label>
          <Select
            value={selectedParentId || UNSELECTED_VALUE}
            onValueChange={(value) => {
              const newParentId = value === UNSELECTED_VALUE ? null : value;
              setSelectedParentId(newParentId);

              // NEW: Automatically match the parent's color for the subcategory
              if (newParentId) {
                const parent = allCategories.find(c => c.id === newParentId);
                if (parent) {
                  setCor(getCategoryColor(parent, allCategories));
                }
              }
            }}
            disabled={editingCategory?.user_id === null}
          >
            <SelectTrigger
              id="parent_id"
              className={cn("rounded-xl border-blue-200 bg-white shadow-sm", isMobile && "h-11 text-sm", hideCardWrapper && "bg-white")}
            >
              <SelectValue placeholder="Selecione a Categoria Principal" />
            </SelectTrigger>
            <SelectContent>
              {possibleParentCategories
                .filter(
                  (cat) => cat.id !== editingCategory?.id && cat.id !== ""
                )
                .map((cat) => (
                  <SelectItem
                    key={cat.id}
                    value={cat.id}
                    className={cn(isMobile && "text-sm")}
                  >
                    <span className="flex items-center gap-2">
                      <DynamicIcon
                        name={cat.icone}
                        className="h-4 w-4"
                        color={getCategoryColor(cat, allCategories)}
                      />
                      {cat.nome}
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className={cn("space-y-2", isMobile && "space-y-1")}>
          <Label htmlFor="nome" className={cn(isMobile && "text-xs")}>
            Nome da Subcategoria
          </Label>
          <Input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Academia, Pet, etc."
            required
            className={cn(
              "rounded-xl border-blue-200 bg-white shadow-sm placeholder:text-gray-400",
              isMobile && "h-11 text-sm",
              hideCardWrapper && "bg-white"
            )}
            disabled={editingCategory?.user_id === null}
          />
        </div>

        <div className={cn("space-y-2", isMobile && "space-y-1")}>
          <Label className={cn(isMobile && "text-xs")}>Ícone / Emoji</Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                "w-full p-4 border-2 border-border rounded-xl hover:border-primary transition-colors flex items-center justify-center text-4xl",
                hideCardWrapper ? "bg-[#F5F5F5]" : "bg-background",
                isMobile && "p-2 text-3xl"
              )}
              disabled={editingCategory?.user_id === null}
            >
              {icone}
            </button>

            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="absolute z-50 mt-2 w-full left-0">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width="100%"
                  height={isMobile ? 300 : 400}
                  searchDisabled={true}
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </div>
        </div>

        {isMobile && <div className="h-10" />}
        <div className={cn("flex gap-4 w-full", isMobile ? "mt-0" : "mt-6")}>
          {editingCategory && ( // Botão Cancelar à esquerda quando editando
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className={cn(
                "flex-1 rounded-xl border-[#FEB2B2] bg-[#FFF5F5] text-[#E53E3E] hover:bg-[#FED7D7] hover:text-[#C53030] font-semibold transition-all",
                isMobile && "h-11 text-sm"
              )}
              size="lg"
            >
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            className={cn("flex-1 rounded-xl font-semibold shadow-md", isMobile && "h-11 text-sm")}
            size="lg"
            disabled={editingCategory?.user_id === null}
          >
            {editingCategory ? "Atualizar" : "Adicionar Subcategoria"}
          </Button>
        </div>
      </form>
    </>
  );

  return hideCardWrapper ? (
    formContent
  ) : (
    <Card
      className={cn(
        "p-6 animate-fade-in rounded-xl shadow-sm",
        isMobile && "p-4",
        !isMobile && "max-w-[700px] mx-auto"
      )}
    >
      {formContent}
    </Card>
  );
};
