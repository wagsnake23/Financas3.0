import React, { useState, useMemo, useEffect } from "react";
import { AppCategory } from "@/types/finance";
import { categories as defaultCategories } from "@/data/categories";
import { CategoryForm } from "@/components/CategoryForm";
import { Navigation } from "@/components/Navigation";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import Loading from "@/components/Loading";
import { Footer } from "@/components/Footer";
import { useIsMobile } from "@/hooks/use-mobile"; // Importar o hook useIsMobile
import { Card } from "@/components/ui/card"; // Importar Card para CategoriesList fallback

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


const Categories = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<AppCategory | null>(null);
  const isMobile = useIsMobile(); // Usar o hook para detectar se é mobile

  // Fetch ALL categories from Supabase (user-specific and default ones with user_id: null)
  const { data: fetchedCategories = [], isLoading: isLoadingCategories } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`) // Fetch user's categories OR categories with null user_id
        .order("nome");
      if (error) throw error;
      return data as AppCategory[];
    },
    enabled: !!user?.id,
  });

  const allCategories = fetchedCategories;

  const hierarchicalCategories = useMemo(() => {
    const hierarchy = buildCategoryHierarchy(allCategories);
    return hierarchy;
  }, [allCategories]);

  // Mutation for adding a new category
  const addCategoryMutation = useMutation({
    mutationFn: async (newCategory: Omit<TablesInsert<'categorias'>, 'id'>) => { // Changed type to omit 'id'
      const categoryToInsert = {
        ...newCategory,
        id: crypto.randomUUID(), // Generate UUID on client-side
        user_id: user?.id
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
      toast.success("Categoria adicionada!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao adicionar categoria", { description: error.message });
    },
  });

  // Mutation for updating an existing category
  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, updatedCategory }: { id: string; updatedCategory: TablesUpdate<'categorias'> }) => {
      const { data, error } = await supabase
        .from("categorias")
        .update(updatedCategory)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", user?.id] });
      toast.success("Categoria atualizada!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
      setEditingCategory(null);
    },
    onError: (error) => {
      toast.error("Erro ao atualizar categoria", { description: error.message });
    },
  });

  // Mutation for deleting a category
  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if it's a default category (user_id is null)
      const categoryToDelete = allCategories.find(c => c.id === id);
      if (categoryToDelete?.user_id === null) {
        throw new Error("Não é possível deletar categorias padrão.");
      }

      // Check if it has subcategories
      const hasSubcategories = allCategories.some(cat => cat.parent_id === id);
      if (hasSubcategories) {
        throw new Error("Não é possível deletar uma categoria que possui subcategorias. Remova as subcategorias primeiro.");
      }

      const { error } = await supabase
        .from("categorias")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories", user?.id] });
      toast.success("Categoria removida!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
    },
    onError: (error) => {
      toast.error("Erro ao remover categoria", { description: error.message });
    },
  });

  const handleAddCategory = (category: Omit<AppCategory, "id" | "user_id" | "created_at">) => {
    addCategoryMutation.mutate({
      nome: category.nome,
      icone: category.icone,
      cor: category.cor,
      forma_pagamento: category.forma_pagamento || null,
      parent_id: category.parent_id || null,
    });
  };

  const handleUpdateCategory = (id: string, categoryData: Omit<AppCategory, "id" | "user_id" | "created_at">) => {
    updateCategoryMutation.mutate({
      id,
      updatedCategory: {
        nome: categoryData.nome,
        icone: categoryData.icone,
        cor: categoryData.cor,
        forma_pagamento: categoryData.forma_pagamento || null,
        parent_id: categoryData.parent_id || null,
      },
    });
  };

  const handleDeleteCategory = (id: string) => {
    deleteCategoryMutation.mutate(id);
  };

  const handleEditCategory = (category: AppCategory) => {
    // Check if it's a default category (user_id is null)
    if (category.user_id === null) {
      toast.info("Não é possível editar categorias padrão.");
      setEditingCategory(null);
      return;
    }
    setEditingCategory(category);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (isLoadingCategories) {
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
              allCategories={allCategories} // Pass all categories (now all from DB)
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
                categories={hierarchicalCategories} // Pass hierarchical categories
                onDeleteCategory={handleDeleteCategory}
                onEditCategory={handleEditCategory}
              />
            </React.Suspense>
          </div>
        </div>
      </main>

      <Footer isMobile={isMobile} /> {/* Usando o componente Footer e passando isMobile */}
    </div>
  );
};

export default Categories;