import { useState, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppCategory } from "@/types/finance";
import { toast } from "sonner";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { PAYMENT_METHODS } from "@/data/colorPalette"; // Manter para referência, se necessário
import { X } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile"; // Importar useIsMobile
import { cn } from "@/lib/utils"; // Importar cn
import DynamicIcon from "./DynamicIcon"; // Importar DynamicIcon

interface CategoryFormProps {
  onAddCategory: (category: Omit<AppCategory, "id" | "user_id" | "created_at">) => void;
  onUpdateCategory?: (id: string, category: Omit<AppCategory, "id" | "user_id" | "created_at">) => void;
  editingCategory?: AppCategory | null;
  onCancelEdit?: () => void;
  allCategories: AppCategory[]; // Agora recebe todas as categorias (principais e sub)
}

const UNSELECTED_VALUE = "unselected";
const toastDuration = 1000; // 1 segundo para todos os dispositivos
const toastSuccessStyle = { backgroundColor: '#F3FFF3', color: '#006000' };
const toastErrorStyle = { backgroundColor: '#F3FFF3', color: '#FF2929' };

export const CategoryForm = ({ 
  onAddCategory, 
  onUpdateCategory,
  editingCategory,
  onCancelEdit,
  allCategories
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
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
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
    
    if (!selectedParentId || selectedParentId === UNSELECTED_VALUE) {
      toast.error("Selecione uma Categoria Principal para a subcategoria.", { duration: toastDuration, style: toastErrorStyle });
      return;
    }

    if (!nome.trim()) {
      toast.error("Preencha o nome da subcategoria", { duration: toastDuration, style: toastErrorStyle });
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
    return allCategories.filter(cat => cat.parent_id === null);
  }, [allCategories]);

  return (
    <Card className="p-6 animate-fade-in rounded-xl shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h2 className={cn("text-2xl font-bold", isMobile && "text-xl")}>
          {editingCategory ? "Editar Subcategoria" : "Nova Subcategoria"}
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

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="parent_id">Categoria Principal</Label>
          <Select 
            value={selectedParentId || UNSELECTED_VALUE} 
            onValueChange={(value) => setSelectedParentId(value === UNSELECTED_VALUE ? null : value)}
            disabled={editingCategory?.user_id === null} // Desabilitar para categorias padrão
          >
            <SelectTrigger id="parent_id" className="rounded-xl">
              <SelectValue placeholder="Selecione a Categoria Principal" />
            </SelectTrigger>
            <SelectContent>
              {possibleParentCategories
                .filter(cat => cat.id !== editingCategory?.id && cat.id !== "") 
                .map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <span className="flex items-center gap-2">
                    <DynamicIcon name={cat.icone} className="h-4 w-4" color={cat.cor} /> {/* Adicionado DynamicIcon com cor */}
                    {cat.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="nome">Nome da Subcategoria</Label>
          <Input
            id="nome"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Academia, Pet, etc."
            required
            className="rounded-xl"
            disabled={editingCategory?.user_id === null} // Desabilitar para categorias padrão
          />
        </div>
        
        <div className="space-y-2">
          <Label>Ícone / Emoji</Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-full p-4 border-2 border-border rounded-xl hover:border-primary transition-colors flex items-center justify-center text-4xl bg-background"
              disabled={editingCategory?.user_id === null} // Desabilitar para categorias padrão
            >
              {icone}
            </button>
            
            {showEmojiPicker && (
              <div ref={emojiPickerRef} className="absolute z-50 mt-2">
                <EmojiPicker
                  onEmojiClick={handleEmojiClick}
                  width={350}
                  height={400}
                  searchPlaceHolder="Buscar emoji..."
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="flex-1 rounded-xl" size="lg" disabled={editingCategory?.user_id === null}>
            {editingCategory ? "Atualizar Subcategoria" : "Adicionar Subcategoria"}
          </Button>
          {editingCategory && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              size="lg"
              className="rounded-xl"
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
};