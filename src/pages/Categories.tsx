import React, { useState, useMemo, useEffect } from "react";
import { AppCategory } from "@/types/finance";
import { categories as defaultCategories } from "@/data/categories"; // Manter para referência, mas não para uso direto
import { CategoryForm } from "@/components/CategoryForm";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import Loading from "@/components/Loading";
import { Footer } from "@/components/Footer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import DynamicIcon from "@/components/DynamicIcon";
import { EditCategoryModal } from "@/components/EditCategoryModal";
import { Card } from "@/components/ui/card";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const CategoriesList = React.lazy(() => import("../components/CategoriesList").then(module => ({ default: module.default })));

// Helper function to build hierarchical categories
interface HierarchicalCategory extends AppCategory {
  subCategories?: HierarchicalCategory[];
}

const buildCategoryHierarchy = (flatCategories: AppCategory[]): HierarchicalCategory[] => {
  const categoriesMap = new Map<string, HierarchicalCategory>();
  const rootCategories: HierarchicalCategory[] = [];

  flatCategories.forEach(cat => {
    categoriesMap.set(cat.id, { ...cat, subCategories: [] });
  });

  flatCategories.forEach(cat => {
    if (cat.parent_id && categoriesMap.has(cat.parent_id)) {
      const parent = categoriesMap.get(cat.parent_id);
      if (parent) {
        parent.subCategories?.push(categoriesMap.get(cat.id)!);
      }
    } else {
      rootCategories.push(categoriesMap.get(cat.id)!);
    }
  });

  // Sort root categories and their sub-categories by name
  const sortCategories = (cats: HierarchicalCategory[]) => {
    cats.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    cats.forEach(cat => {
      if (cat.subCategories && cat.subCategories.length > 0) {
        sortCategories(cat.subCategories);
      }
    });
  };

  sortCategories(rootCategories);
  return rootCategories;
};

const toastDuration = 1000; // 1 segundo para todos os dispositivos
const toastSuccessStyle = { backgroundColor: '#FFFFFF', color: '#006000', border: '1px solid #E5FFE5' };
const toastErrorStyle = { backgroundColor: '#FFFFFF', color: '#FF2929', border: '1px solid #FFE5E5' };

const Categories = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<AppCategory | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false); // Novo estado para o modal
  const [formKey, setFormKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState(""); // Estado para resetar o formulário
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Fetch ALL categories (both main and subcategories) for the Categories page
  // A filtragem para subcategorias será feita no CategoryForm e CategoryList
  const { data: fetchedCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("nome");
      if (error) throw error;

      // Normalização e Limpeza de Categorias (Sincronizado com Categories.tsx)
      let cryptoAdded = false;
      let poupancaAdded = false;
      const normalizedData = (data as AppCategory[])
        .filter(cat => {
          const lowerNome = cat.nome.toLowerCase();
          
          // Filtro de Aportes
          if (lowerNome.includes("aportes") || lowerNome.includes("entrada de capital")) return false;

          // Filtro de Ações: remover dividendos e venda
          if (lowerNome.includes("ações") || lowerNome.includes("acoes")) {
            if (lowerNome.includes("dividendos") || lowerNome.includes("venda")) return false;
          }
          
          // Consolidação de Criptomoedas
          if (lowerNome.includes("criptomoedas") || lowerNome.includes("crypto") || lowerNome.includes("bitcoin")) {
            if (cryptoAdded) return false;
            cryptoAdded = true;
          }

          // Consolidação de Poupança
          if (lowerNome.includes("poupança") || lowerNome.includes("poupanca")) {
            if (poupancaAdded) return false;
            poupancaAdded = true;
          }

          // Novos filtros solicitados: remover subcategorias específicas
          const filterOut = [
            "juros sobre capital",
            "reembolsos",
            "tesouro",
            "rendimentos de fundos",
            "outros rendimentos",
            "dividendos",
            "receitas extras",
            "aluguel de imóveis",
            "criptomoedas"
          ];
          
          if (filterOut.some(term => lowerNome.includes(term))) return false;
          
          return true;
        })
        .map(cat => {
          // Normalização padrão para Família
          if (cat.id === "familia_filhos") {
            return { ...cat, nome: "Família" };
          }
          const lowerNome = cat.nome.toLowerCase();
          // Normalização para Criptomoedas
          if (lowerNome.includes("criptomoedas") || lowerNome.includes("crypto") || lowerNome.includes("bitcoin")) {
            return { ...cat, nome: "Criptomoedas" };
          }
          // Normalização para Poupança
          if (lowerNome.includes("poupança") || lowerNome.includes("poupanca")) {
            return { ...cat, nome: "Poupança" };
          }
          return cat;
        });

      return normalizedData;
    },
    enabled: !!user,
  });

  const allCategories = fetchedCategories;

  const hierarchicalCategories = useMemo(() => {
    const hierarchy = buildCategoryHierarchy(allCategories);
    return hierarchy;
  }, [allCategories]);

  // Mutation for adding a new category (now always a subcategory)
  const addCategoryMutation = useMutation({
    mutationFn: async (newCategory: Omit<TablesInsert<'categorias'>, 'id'>) => {
      if (!user?.id) throw new Error("User not authenticated.");
      if (!newCategory.parent_id) throw new Error("Subcategorias devem ter uma categoria principal."); // Validação adicionada
      const categoryToInsert = {
        ...newCategory,
        id: crypto.randomUUID(),
        user_id: user.id
      };
      const { data, error } = await supabase
        .from("categorias")
        .insert(categoryToInsert)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", user?.id] });
      toast.success("Subcategoria adicionada com sucesso ", { // Mensagem atualizada
        style: toastSuccessStyle,
        duration: toastDuration
      });
      setFormKey(prev => prev + 1); // Limpa o formulário após o sucesso
    },
    onError: (error) => {
      toast.error("Erro ao adicionar subcategoria", { description: error.message, duration: toastDuration, style: toastErrorStyle }); // Mensagem atualizada
    },
  });

  // Mutation for updating an existing category (now always a subcategory)
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, updatedCategory }: { id: string; updatedCategory: TablesUpdate<'categorias'> }) => {
      if (!user?.id) throw new Error("User not authenticated.");
      if (!updatedCategory.parent_id) throw new Error("Subcategorias devem ter uma categoria principal."); // Validação adicionada
      const { data, error } = await supabase
        .from("categorias")
        .update(updatedCategory)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", user?.id] });
      toast.success("Subcategoria atualizada!", { // Mensagem atualizada
        style: toastSuccessStyle,
        duration: toastDuration
      });
      setEditingCategory(null);
      setIsEditModalOpen(false); // Fechar o modal após a atualização
    },
    onError: (error) => {
      toast.error("Erro ao atualizar subcategoria", { description: error.message, duration: toastDuration, style: toastErrorStyle }); // Mensagem atualizada
    },
  });

  // Mutation for deleting a category
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!user?.id) throw new Error("User not authenticated.");
      const categoryToDelete = allCategories.find(c => c.id === id);
      if (categoryToDelete?.user_id === null) {
        throw new Error("Não é possível deletar categorias padrão.");
      }

      // Check if it has subcategories (only relevant for main categories)
      const hasSubcategories = allCategories.some(cat => cat.parent_id === id);
      if (hasSubcategories) {
        throw new Error("Não é possível deletar uma categoria que possui subcategorias. Remova as subcategorias primeiro.");
      }

      const { error } = await supabase
        .from("categorias")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", user?.id] });
      toast.success("Categoria removida!", {
        style: toastSuccessStyle,
        duration: toastDuration
      });
    },
    onError: (error) => {
      toast.error("Erro ao remover categoria", { description: error.message, duration: toastDuration, style: toastErrorStyle });
    },
  });

  const handleAddCategory = (category: Omit<AppCategory, "id" | "user_id" | "created_at">) => {
    addCategoryMutation.mutate({
      nome: category.nome,
      icone: category.icone,
      cor: category.cor,
      forma_pagamento: null,
      parent_id: category.parent_id,
    });
  };

  const handleUpdateCategory = (id: string, categoryData: Omit<AppCategory, "id" | "user_id" | "created_at">) => {
    updateCategoryMutation.mutate({
      id,
      updatedCategory: {
        nome: categoryData.nome,
        icone: categoryData.icone,
        cor: categoryData.cor,
        forma_pagamento: null,
        parent_id: categoryData.parent_id,
      },
    });
  };

  const handleDeleteCategory = (id: string) => {
    deleteCategoryMutation.mutate(id);
  };

  const handleEditCategory = (category: AppCategory) => {
    if (category.user_id === null) {
      toast.info("Não é possível editar categorias padrão.", { duration: toastDuration });
      setEditingCategory(null);
      setIsEditModalOpen(false); // Garante que o modal não abra
      return;
    }
    // Se a categoria selecionada para edição for uma categoria principal (parent_id === null),
    // não permitimos a edição via este formulário, pois ele é para subcategorias.
    if (category.parent_id === null) {
      toast.info("Edite apenas subcategorias. Para categorias principais, crie subcategorias.", { duration: toastDuration });
      setEditingCategory(null);
      setIsEditModalOpen(false); // Garante que o modal não abra
      return;
    }
    setEditingCategory(category);
    setIsEditModalOpen(true); // Abrir o modal
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingCategory(null);
    setIsEditModalOpen(false);
  };



  return (
    <div
      className={cn(
        "flex flex-col min-h-screen global-bg md:pt-[72px]",
        isMobile && "bg-[#F9FAFB]"
      )}
    >

      {/* HEADER PREMIUM — FINTECH STYLE (CATEGORIAS THEME) */}
      {!isMobile && (
        <div className="relative h-[220px] w-full overflow-hidden bg-transparent">
          <div className="container-app relative z-10 pt-[28px] md:pt-[42px] flex justify-between items-start">
            <div>
              <div className="flex items-start gap-3">
                <Button
                  variant="ghost"
                  className="btn-3d btn-3d-icon p-2 rounded-xl flex items-center justify-center border-none cursor-pointer hover:scale-105 active:scale-95 transition-all h-auto w-auto mt-1"
                  style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
                  onClick={() => navigate(-1)}
                >
                  <span className="text-xl">📚</span>
                </Button>
                <div className="flex flex-col">
                  <h1 className="text-2xl font-black tracking-tight -mt-0.5 text-slate-800">
                    Categorias
                  </h1>
                  <p className="text-sm font-bold text-slate-500 -mt-0.5 tracking-wider opacity-80">
                    Gerencie suas categorias e subcategorias
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
          isMobile ? "pt-[calc(4rem+env(safe-area-inset-top))] pb-10" : "-mt-14 pb-[40px]"
        )}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4 items-start">
          <div className={cn("flex flex-col", isMobile ? "gap-4" : "gap-[21px] max-w-[420px]")}>
            {!isMobile && (
              <Card
                className="p-[14px] rounded-[24px] border border-[rgba(245,158,11,0.4)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] relative overflow-hidden"
                style={{ background: "linear-gradient(to bottom, #f3efe3, #f7f4ea)" }}
              >
                <div className="flex items-center gap-2 mb-3 px-1">
                  <Search className="h-4 w-4 text-[#374151]" strokeWidth={3} />
                  <h4 className="text-xs font-black text-[#374151] uppercase tracking-widest">Buscar Categoria</h4>
                </div>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="O que você procura?"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-10 rounded-xl bg-white/80 border-slate-200 focus:bg-white transition-all pl-3"
                  />
                </div>
              </Card>
            )}

            <Card
              className={cn(
                "rounded-[24px] relative overflow-hidden card-yellow",
                isMobile 
                  ? "p-6 border-2 border-white shadow-md" 
                  : "p-[28px_24px] border border-[rgba(245,158,11,0.4)] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
              )}
              style={{
                backgroundColor: "rgba(255, 255, 255, 0.45)",
                backgroundImage: "none"
              }}
            >
              <div className={cn("flex items-center mb-6", isMobile ? "gap-1.5" : "gap-2")}>
                {!isMobile ? (
                  <div className="p-2 rounded-full bg-[#374151]/10 flex items-center justify-center">
                    <span className="text-xl">🗂️</span>
                  </div>
                ) : (
                  <span className="text-xl">🗂️</span>
                )}
                <h2 className="text-xl font-black text-[#374151]">Nova Subcategoria</h2>
              </div>
              <CategoryForm
                key={formKey}
                onAddCategory={handleAddCategory}
                onUpdateCategory={handleUpdateCategory}
                editingCategory={null}
                onCancelEdit={handleCancelEdit}
                allCategories={allCategories}
                hideCardWrapper={true}
              />
            </Card>
          </div>

          <div className={cn(isMobile && "max-w-sm mx-auto w-full")}>
            <Card
              className={cn(
                "rounded-[24px] overflow-hidden relative card-yellow",
                isMobile 
                  ? "px-2 py-4 border-2 border-white shadow-md mb-1" 
                  : "p-5 border border-[rgba(245,158,11,0.4)] shadow-[0_2px_8px_rgba(0,0,0,0.04)] h-auto min-h-unset pb-2"
              )}
              style={{ backgroundColor: "rgba(255, 255, 255, 0.45)", backgroundImage: "none" }}
            >
                {isMobile && (
                  <div className={cn("flex items-center px-4 pb-0 gap-1.5")}>
                    <span className="text-xl">🗃️</span>
                    <h2 className="text-xl font-black text-[#374151]">Categorias Cadastradas</h2>
                  </div>
                )}
              <React.Suspense fallback={
                <div className="p-12 text-center text-muted-foreground animate-pulse font-medium">
                  Carregando lista de categorias...
                </div>
              }>
                <CategoriesList
                  categories={hierarchicalCategories}
                  onDeleteCategory={handleDeleteCategory}
                  onEditCategory={handleEditCategory}
                  isMobile={isMobile}
                  allFlatCategories={allCategories}
                  hideCardWrapper={true}
                  hideTitle={isMobile}
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                />
              </React.Suspense>
            </Card>
          </div>
        </div>
      </main>

      <Footer isMobile={isMobile} user={user} className={cn(isMobile ? "mt-0 mb-2 bg-transparent" : "mt-8")} />

      {/* Novo Modal de Edição */}
      <EditCategoryModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        editingCategory={editingCategory}
        onUpdateCategory={handleUpdateCategory}
        onCancelEdit={handleCancelEdit}
        allCategories={allCategories}
      />
    </div >
  );
};

export default Categories;
