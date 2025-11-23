import React, { useState, useMemo, useEffect } from "react";
import { AppCategory } from "@/types/finance";
import { categories as defaultCategories } from "@/data/categories"; // Manter para referência, mas não para uso direto
import { CategoryForm } from "@/components/CategoryForm";
import { Navigation } from "@/components/Navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import Loading from "@/components/Loading";
import { Footer } from "@/components/Footer";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card } from "@/components/ui/card";

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
const toastSuccessStyle = { backgroundColor: '#F3FFF3', color: '#006000' };
const toastErrorStyle = { backgroundColor: '#F3FFF3', color: '#FF2929' };

const Categories = () => {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<AppCategory | null>(null);
  const isMobile = useIsMobile();

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
      return data as AppCategory[];
    },
    enabled: !!user && !authLoading,
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
      toast.success("Subcategoria adicionada!", { // Mensagem atualizada
        style: toastSuccessStyle,
        duration: toastDuration
      });
    },
    onError: (error) => {
      toast.error("Erro ao adicionar subcategoria", { description: error.message, duration: toastDuration, style: toastErrorStyle }); // Mensagem atualizada
    },
    enabled: !!user && !authLoading,
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
    },
    onError: (error) => {
      toast.error("Erro ao atualizar subcategoria", { description: error.message, duration: toastDuration, style: toastErrorStyle }); // Mensagem atualizada
    },
    enabled: !!user && !authLoading,
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
    enabled: !!user && !authLoading,
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
      return;
    }
    // Se a categoria selecionada para edição for uma categoria principal (parent_id === null),
    // não permitimos a edição via este formulário, pois ele é para subcategorias.
    if (category.parent_id === null) {
      toast.info("Edite apenas subcategorias. Para categorias principais, crie subcategorias.", { duration: toastDuration });
      setEditingCategory(null);
      return;
    }
    setEditingCategory(category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (authLoading || isLoadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando Categorias...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navigation />

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div>
            <CategoryForm 
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              editingCategory={editingCategory}
              onCancelEdit={() => setEditingCategory(null)}
              allCategories={allCategories} // Passar todas as categorias para o formulário
            />
          </div>

          <div>
            <React.Suspense fallback={
              <Card className="p-6 flex flex-col rounded-xl shadow-sm">
                <div className="flex-shrink-0 mb-4">
                  <h2 className="text-2xl font-bold">Categorias Cadastradas</h2>
                </div>
                <div className="p-6 text-center text-muted-foreground">Carregando lista de categorias...</div>
              </Card>
            }>
              <CategoriesList 
                categories={hierarchicalCategories}
                onDeleteCategory={handleDeleteCategory}
                onEditCategory={handleEditCategory}
                isMobile={isMobile} 
                allFlatCategories={allCategories} // NEW: Pass allCategories here
              />
            </React.Suspense>
          </div>
        </div>
      </main>

      <Footer isMobile={isMobile} />
    </div>
  );
};

export default Categories;