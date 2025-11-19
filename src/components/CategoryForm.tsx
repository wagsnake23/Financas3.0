import { useState, useRef, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppCategory } from "@/types/finance";
import { toast } from "sonner";
import EmojiPicker, { EmojiClickData } from "emoji-picker-react";
import { PAYMENT_METHODS } from "@/data/colorPalette";
import { X } from "lucide-react";

interface CategoryFormProps {
  onAddCategory: (category: Omit<AppCategory, "id" | "user_id" | "created_at">) => void;
  onUpdateCategory?: (id: string, category: Omit<AppCategory, "id" | "user_id" | "created_at">) => void;
  editingCategory?: AppCategory | null;
  onCancelEdit?: () => void;
  allCategories: AppCategory[]; // Agora recebe todas as categorias já do Supabase
}

const UNSELECTED_VALUE = "unselected"; // Valor único para representar 'não selecionado'

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
  // Removido o estado para forma_pagamento, pois o campo será removido
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement>(null);

  // Load editing data when editingCategory changes
  useEffect(() => {
    if (editingCategory) {
      setNome(editingCategory.nome);
      setIcone(editingCategory.icone);
      setCor(editingCategory.cor);
      // Não define forma_pagamento ao editar, pois o campo foi removido
      setSelectedParentId(editingCategory.parent_id);
    } else {
      // Reset form when not editing
      setNome("");
      setIcone("😀");
      setCor("hsl(210, 70%, 50%)");
      // Não define forma_pagamento ao resetar, pois o campo foi removido
      setSelectedParentId(null);
    }
  }, [editingCategory, allCategories]);

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
      toast.error("Selecione uma Categoria Principal.");
      return;
    }

    if (!nome.trim()) {
      toast.error("Preencha o nome da subcategoria");
      return;
    }

    const categoryData: Omit<AppCategory, "id" | "user_id" | "created_at"> = {
      nome: nome.trim(),
      icone,
      cor,
      forma_pagamento: null, // Definido como null, pois o campo foi removido
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
        <h2 className="text-2xl font-bold">
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
          >
            <SelectTrigger id="parent_id">
              <SelectValue placeholder="Selecione a Categoria Principal" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSELECTED_VALUE} disabled>Nenhuma</SelectItem> {/* Usando UNSELECTED_VALUE */}
              {possibleParentCategories
                .filter(cat => cat.id !== editingCategory?.id && cat.id !== "") 
                .map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.nome}
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
          />
        </div>
        
        {/* Campo Forma de Pagamento removido */}

        <div className="space-y-2">
          <Label>Ícone / Emoji</Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="w-full p-4 border-2 border-border rounded-lg hover:border-primary transition-colors flex items-center justify-center text-4xl bg-background"
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
          <Button type="submit" className="flex-1" size="lg">
            {editingCategory ? "Atualizar Subcategoria" : "Adicionar Subcategoria"}
          </Button>
          {editingCategory && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              size="lg"
            >
              Cancelar
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
};