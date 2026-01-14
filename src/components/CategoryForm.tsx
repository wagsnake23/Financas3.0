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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"; // Import Dialog components
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
  excludeCategoryIds?: string[]; // Prop para excluir categorias específicas
  defaultParentId?: string; // Prop para definir uma categoria pai padrão e travada
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
  excludeCategoryIds = [], // Valor padrão é vazio
  defaultParentId,
}: CategoryFormProps) => {
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("😀");
  const [cor, setCor] = useState("hsl(210, 70%, 50%)");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(defaultParentId || null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  // Removed emojiPickerRef as it's no longer needed for modal
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

      // If there's a default parent, set its color
      if (defaultParentId) {
        const parent = allCategories.find(c => c.id === defaultParentId);
        if (parent) {
          setCor(getCategoryColor(parent, allCategories));
        } else {
          setCor("hsl(210, 70%, 50%)");
        }
        setSelectedParentId(defaultParentId);
      } else {
        setCor("hsl(210, 70%, 50%)");
        setSelectedParentId(null);
      }
    }
  }, [editingCategory, defaultParentId, allCategories]);

  // Removed outside click handler effect as Dialog handles closing


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
    return allCategories.filter((cat) =>
      cat.parent_id === null && !excludeCategoryIds.includes(cat.id)
    );
  }, [allCategories, excludeCategoryIds]);

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
        <div className={cn(isMobile && "space-y-1")}>
          <Label htmlFor="parent_id" className={cn("text-gray-800 font-medium mb-1 inline-block", isMobile && "text-xs")}>
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
            disabled={editingCategory?.user_id === null || !!defaultParentId}
          >
            <SelectTrigger
              id="parent_id"
              className={cn("rounded-xl transition-all duration-200 input-3d-premium text-gray-800 !border-[#E2E8F0] border", isMobile ? "h-9 text-sm" : "h-10", hideCardWrapper && "bg-white")}
            >
              <SelectValue placeholder="Selecione a Categoria Principal" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
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

        <div className={cn(isMobile && "space-y-1")}>
          <Label htmlFor="nome" className={cn("text-gray-800 font-medium mb-1 inline-block", isMobile && "text-xs")}>
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
              "rounded-xl transition-all duration-200 input-3d-premium text-gray-800 placeholder:text-gray-400 !border-[#E2E8F0] border",
              isMobile ? "h-9 text-sm" : "h-10",
              hideCardWrapper && "bg-white"
            )}
            disabled={editingCategory?.user_id === null}
          />
        </div>

        <div className={cn(isMobile && "space-y-1")}>
          <Label className={cn("text-gray-800 font-medium mb-1 inline-block", isMobile && "text-xs")}>Ícone / Emoji</Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                "w-full rounded-xl flex items-center justify-center text-4xl transition-all duration-200 input-3d-premium !border-[#E2E8F0] border",
                "bg-white",
                isMobile ? "p-2 text-3xl h-16" : "p-4 h-20"
              )}
              disabled={editingCategory?.user_id === null}
            >
              {icone}
            </button>

            <Dialog open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <DialogContent
                className={cn(
                  "p-0 border-none bg-white overflow-hidden shadow-2xl flex flex-col gap-0",
                  isMobile ? "w-[98vw] max-w-[500px] rounded-[24px]" : "sm:max-w-[550px] rounded-xl"
                )}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="h-14 flex items-center px-6 border-b bg-gray-50/50">
                  <DialogTitle className="font-bold text-[#1E40AF] text-sm">
                    Escolha um ícone
                  </DialogTitle>
                </div>

                <div className="p-2 bg-white flex justify-center">
                  <EmojiPicker
                    onEmojiClick={handleEmojiClick}
                    width="100%"
                    height={isMobile ? 440 : 480}
                    autoFocusSearch={false}
                    searchDisabled={false}
                    previewConfig={{ showPreview: false }}
                    skinTonesDisabled={true}
                    searchPlaceholder="Buscar..."
                  />
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isMobile && <div className="h-4" />}
        <div className={cn("flex gap-4 w-full", isMobile ? "mt-0" : "mt-6")}>
          {editingCategory && ( // Botão Cancelar à esquerda quando editando
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className={cn(
                "flex-1 rounded-xl border border-blue-100 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-bold transition-all",
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
