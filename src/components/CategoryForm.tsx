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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppCategory } from "@/types/finance";
import { toast } from "sonner";
import EmojiPicker, { EmojiClickData, Categories } from "emoji-picker-react";
import { PAYMENT_METHODS } from "@/data/colorPalette";
import { X, Search as SearchIcon } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn, getBorderClass } from "@/lib/utils";
import DynamicIcon from "./DynamicIcon";
import { getCategoryColor } from "@/lib/categoryColors";
import { BRANDS } from "@/data/brands";

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
  allCategories: AppCategory[];
  hideCardWrapper?: boolean;
  excludeCategoryIds?: string[];
  defaultParentId?: string;
}

const UNSELECTED_VALUE = "unselected";
const toastDuration = 1000;
const toastSuccessStyle = { backgroundColor: "#FFFFFF", color: "#006000", border: "1px solid #E5FFE5" };
const toastErrorStyle = { backgroundColor: "#FFFFFF", color: "#FF2929", border: "1px solid #FFE5E5" };

export const CategoryForm = ({
  onAddCategory,
  onUpdateCategory,
  editingCategory,
  onCancelEdit,
  allCategories,
  hideCardWrapper = false,
  excludeCategoryIds = [],
  defaultParentId,
}: CategoryFormProps) => {
  const [nome, setNome] = useState("");
  const [icone, setIcone] = useState("😀");
  const [cor, setCor] = useState("hsl(210, 70%, 50%)");
  const [selectedParentId, setSelectedParentId] = useState<string | null>(defaultParentId || null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [activeTab, setActiveTab] = useState("emojis");
  const [searchBrandQuery, setSearchBrandQuery] = useState("");
  const isMobile = useIsMobile();

  useEffect(() => {
    if (editingCategory) {
      setNome(editingCategory.nome);
      setIcone(editingCategory.icone);
      setCor(editingCategory.cor);
      setSelectedParentId(editingCategory.parent_id);
    } else {
      setNome("");
      setIcone("😀");

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

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setIcone(emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleBrandClick = (brandId: string) => {
    setIcone(`brand:${brandId}`);
    setShowEmojiPicker(false);
  };

  const filteredBrands = useMemo(() => {
    if (!searchBrandQuery) return BRANDS;
    const q = searchBrandQuery.toLowerCase();
    return BRANDS.filter(b => b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q));
  }, [searchBrandQuery]);

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

    if (!editingCategory && onCancelEdit) {
      onCancelEdit();
    }
  };

  const handleCancel = () => {
    if (onCancelEdit) {
      onCancelEdit();
    }
  };

  const possibleParentCategories = useMemo(() => {
    return allCategories.filter((cat) =>
      cat.parent_id === null && !excludeCategoryIds.includes(cat.id)
    );
  }, [allCategories, excludeCategoryIds]);

  const formContent = (
    <>
      {!hideCardWrapper && (
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
        id="category-form"
        onSubmit={handleSubmit}
        className={cn(isMobile ? "space-y-2" : "space-y-[20px]")}
      >
        <div className="space-y-1">
          <Label className={cn("text-gray-800 font-medium mb-0.5 inline-block", isMobile && "text-xs")}>
            Categoria Principal
          </Label>
          <Select
            value={selectedParentId || UNSELECTED_VALUE}
            onValueChange={(value) => {
              const newParentId = value === UNSELECTED_VALUE ? null : value;
              setSelectedParentId(newParentId);

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
              className={cn(
                "rounded-xl text-gray-800 font-bold transition-all duration-200 input-3d-premium",
                isMobile ? "h-9 text-sm" : "h-[42px]",
                getBorderClass({ variant: "yellow" }),
                "input-white"
              )}
            >
              <SelectValue placeholder="Selecione a Categoria Principal" />
            </SelectTrigger>
            <SelectContent className="max-h-[280px] w-[--radix-select-trigger-width] rounded-2xl border-none shadow-xl">
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

        <div className="space-y-1">
          <Label htmlFor="nome" className={cn("text-gray-800 font-medium mb-0.5 inline-block", isMobile && "text-xs")}>
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
              "rounded-xl text-gray-800 font-bold transition-all duration-200 input-3d-premium input-white",
              isMobile ? "h-9 text-sm" : "h-[42px]",
              getBorderClass({ variant: "yellow" })
            )}
            disabled={editingCategory?.user_id === null}
          />
        </div>

        <div className="space-y-1 !mb-4">
          <Label className={cn("text-gray-800 font-medium mb-0.5 inline-block", isMobile && "text-xs")}>Ícone / Emoji</Label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className={cn(
                "w-full rounded-xl flex items-center justify-center text-4xl transition-all duration-200 input-3d-premium input-white",
                isMobile ? "p-2 text-3xl h-16" : "p-4 h-20",
                getBorderClass({ variant: "yellow" })
              )}
              disabled={editingCategory?.user_id === null}
            >
              <DynamicIcon name={icone} className={cn(isMobile ? "w-10 h-10" : "w-12 h-12")} />
            </button>

            <Dialog open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
              <DialogContent
                className={cn(
                  "p-0 overflow-hidden flex flex-col gap-0 !rounded-[28px] !border-2 !border-white shadow-2xl",
                  isMobile ? "w-[98vw] h-[85vh] max-h-[600px]" : "sm:max-w-[500px] h-[600px]"
                )}
                onOpenAutoFocus={(e) => e.preventDefault()}
              >
                <div className="h-14 shrink-0 flex items-center justify-center border-b bg-gray-50/50">
                  <DialogTitle className="font-black text-center text-lg">
                    Escolha um Ícone
                  </DialogTitle>
                </div>

                <div className="flex-1 bg-white flex flex-col overflow-hidden">
                  <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full h-full flex flex-col">
                    <div className="px-4 pt-3 pb-2 shrink-0">
                      <TabsList className="w-full grid grid-cols-2 bg-gray-100 p-1 rounded-xl h-12">
                        <TabsTrigger value="emojis" className="rounded-lg text-sm sm:text-base font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm h-full">
                          😀 Emojis
                        </TabsTrigger>
                        <TabsTrigger value="brands" className="rounded-lg text-sm sm:text-base font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm h-full flex items-center gap-2">
                          <span>🏢</span> Marcas
                        </TabsTrigger>
                      </TabsList>
                    </div>
                    
                    <div className="flex-1 relative overflow-hidden">
                      <TabsContent value="emojis" className="absolute inset-0 m-0 border-none outline-none data-[state=inactive]:hidden flex justify-center">
                        <EmojiPicker
                          onEmojiClick={handleEmojiClick}
                          width="100%"
                          height="100%"
                          autoFocusSearch={false}
                          searchDisabled={false}
                          previewConfig={{ showPreview: false }}
                          skinTonesDisabled={true}
                          searchPlaceholder="Buscar emojis..."
                          categories={[
                            { name: 'Sugeridos', category: Categories.SUGGESTED },
                            { name: 'Smileys', category: Categories.SMILEYS_PEOPLE },
                            { name: 'Animais', category: Categories.ANIMALS_NATURE },
                            { name: 'Comida', category: Categories.FOOD_DRINK },
                            { name: 'Viagens', category: Categories.TRAVEL_PLACES },
                            { name: 'Atividades', category: Categories.ACTIVITIES },
                            { name: 'Objetos', category: Categories.OBJECTS },
                            { name: 'Símbolos', category: Categories.SYMBOLS },
                          ]}
                        />
                      </TabsContent>
                      
                      <TabsContent value="brands" className="absolute inset-0 m-0 flex flex-col data-[state=inactive]:hidden bg-white">
                        <div className="px-4 pb-3 shrink-0">
                          <div className="relative">
                            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                              type="text"
                              placeholder="Buscar marcas..."
                              value={searchBrandQuery}
                              onChange={(e) => setSearchBrandQuery(e.target.value)}
                              className="w-full pl-9 h-11 bg-gray-100/50 border-gray-200 rounded-xl focus-visible:ring-1 focus-visible:ring-gray-300"
                            />
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto px-4 pb-4">
                          <div className="grid grid-cols-4 sm:grid-cols-4 gap-2">
                            {filteredBrands.map(brand => (
                              <button
                                key={brand.id}
                                type="button"
                                onClick={() => handleBrandClick(brand.id)}
                                className="flex flex-col items-center justify-start gap-2 p-2 rounded-xl border-2 border-transparent hover:border-blue-100 hover:bg-blue-50/50 active:scale-95 transition-all group"
                              >
                                <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center group-hover:bg-white transition-colors p-2 shadow-sm border border-gray-100">
                                  <img src={brand.icon} alt={brand.name} className="w-full h-full object-contain" />
                                </div>
                                <span className="text-[10px] sm:text-[11px] font-semibold text-center text-gray-600 leading-tight line-clamp-2 w-full px-1">
                                  {brand.name}
                                </span>
                              </button>
                            ))}
                            {filteredBrands.length === 0 && (
                              <div className="col-span-4 py-8 text-center text-gray-500 text-sm">
                                Nenhuma marca encontrada para "{searchBrandQuery}"
                              </div>
                            )}
                          </div>
                        </div>
                      </TabsContent>
                    </div>
                  </Tabs>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isMobile && <div className="h-4" />}
        <div className={cn("flex gap-4 w-full", isMobile ? "mt-0" : "!mt-[38px]")}>
          {editingCategory && (
            <Button
              type="button"
              onClick={handleCancel}
              className={cn(
                "flex-1 rounded-xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg",
                isMobile && "h-11 text-lg"
              )}
              style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}
              size="lg"
            >
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            className={cn(
              "flex-1 rounded-xl btn-3d font-black !text-[#374151] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg",
              isMobile && "h-11 text-lg"
            )}
            style={{ "--cor-topo": "#FFD54F", "--cor-base": "#FFC107" } as any}
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
