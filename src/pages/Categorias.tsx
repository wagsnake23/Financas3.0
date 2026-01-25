import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";
import { AppCategory } from "@/types/finance";
import { Card } from "@/components/ui/card";
import { CategoryForm } from "@/components/CategoryForm";
import CategoriesList from "@/components/CategoriesList";
import DynamicIcon from "@/components/DynamicIcon";
import { toast } from "sonner";
import { EditCategoryModal } from "@/components/EditCategoryModal";

// Helper type matching CategoriesList expectation
interface HierarchicalCategory extends AppCategory {
  subCategories?: HierarchicalCategory[];
}

export default function Categorias() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [editingCategory, setEditingCategory] = useState<AppCategory | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const {
    data: categories = [],
    isLoading: isLoadingCategories,
    error: categoriesError,
  } = useQuery<AppCategory[]>({
    queryKey: ["categories", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("categorias")
        .select("*")
        .or(`user_id.eq.${user.id},user_id.is.null`)
        .order("nome");
      if (error) throw error;

      // Normalização: Garante que "Família e Filhos" seja exibido sempre como "Família"
      const normalizedData = (data as AppCategory[]).map(cat => {
        if (cat.id === "familia_filhos" || cat.nome === "Família e Filhos" || cat.nome === "Família e filhos") {
          return { ...cat, nome: "Família" };
        }
        return cat;
      });

      return normalizedData;
    },
    enabled: !!user && !authLoading,
  });

  const hierarchicalCategories = useMemo(() => {
    const buildHierarchy = (flat: AppCategory[]): HierarchicalCategory[] => {
      const map = new Map<string, HierarchicalCategory>();
      const roots: HierarchicalCategory[] = [];

      flat.forEach((cat) => {
        map.set(cat.id, { ...cat, subCategories: [] });
      });

      flat.forEach((cat) => {
        if (cat.parent_id && map.has(cat.parent_id)) {
          const parent = map.get(cat.parent_id);
          if (parent) {
            parent.subCategories?.push(map.get(cat.id)!);
          }
        } else {
          roots.push(map.get(cat.id)!);
        }
      });

      // Sort alpha
      const sortNodes = (nodes: HierarchicalCategory[]) => {
        nodes.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
        nodes.forEach((node) => {
          if (node.subCategories && node.subCategories.length > 0) {
            sortNodes(node.subCategories);
          }
        });
      };
      sortNodes(roots);
      return roots;
    };
    return buildHierarchy(categories);
  }, [categories]);

  const handleAddCategory = async (categoryData: Omit<AppCategory, "id" | "user_id" | "created_at">) => {
    try {
      if (!user) return;
      const { error } = await supabase.from("categorias").insert({
        ...categoryData,
        id: crypto.randomUUID(),
        user_id: user.id,
      });

      if (error) throw error;

      toast.success("Subcategoria adicionada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error: any) {
      toast.error("Erro ao adicionar categoria: " + error.message);
    }
  };

  const handleUpdateCategory = async (id: string, categoryData: Omit<AppCategory, "id" | "user_id" | "created_at">) => {
    try {
      const { error } = await supabase
        .from("categorias")
        .update(categoryData)
        .eq("id", id);

      if (error) throw error;

      toast.success("Categoria atualizada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setIsEditModalOpen(false);
      setEditingCategory(null);
    } catch (error: any) {
      toast.error("Erro ao atualizar categoria: " + error.message);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const { error } = await supabase.from("categorias").delete().eq("id", id);
      if (error) throw error;
      toast.success("Categoria excluída com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["categories"] });
    } catch (error: any) {
      toast.error("Erro ao excluir categoria: " + error.message);
    }
  };

  if (authLoading || isLoadingCategories) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">
          Carregando Categorias...
        </div>
      </div>
    );
  }

  if (categoriesError) {
    return (
      <div className="min-h-screen flex items-center justify-center text-red-500">
        Erro ao carregar categorias: {categoriesError.message}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col min-h-screen bg-background pt-16",
        isMobile && "bg-lancamentos-mobile-bg"
      )}
    >
      <Navigation />

      <div
        className={cn(
          "mx-auto space-y-6",
          !isMobile && "flex-grow",
          isMobile ? "p-4 pt-2" : "max-w-[1200px] px-6 py-8"
        )}
      >
        {!isMobile && (
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Categorias</h1>
              <p className="text-muted-foreground">
                Gerencie suas categorias de despesas e receitas
              </p>
            </div>
          </div>
        )}

        {isMobile ? (
          <Card className="w-full !max-w-full p-4 rounded-xl shadow-none border-none space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary">
              <div className="p-2 rounded-full bg-soft-blue/50 flex items-center justify-center">
                <DynamicIcon
                  name="PlusCircle"
                  className="h-6 w-6 text-primary"
                />
              </div>
              🗂️Nova Subcategoria
            </h2>
            <CategoryForm
              onAddCategory={handleAddCategory}
              allCategories={categories}
              hideCardWrapper={true}
            />

            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary mt-6">
              <div className="p-2 rounded-full bg-soft-blue/50 flex items-center justify-center">
                <DynamicIcon
                  name="List"
                  className="h-6 w-6 text-primary"
                />
              </div>
              🗃️Categorias Cadastradas
            </h2>
            <CategoriesList
              categories={hierarchicalCategories}
              onDeleteCategory={handleDeleteCategory}
              onEditCategory={(cat) => {
                setEditingCategory(cat);
                setIsEditModalOpen(true);
              }}
              isMobile={isMobile}
              allFlatCategories={categories}
            />

            <Footer isMobile={isMobile} className="pt-2" user={user} />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card className="p-6 rounded-xl shadow-sm max-w-[700px] mx-auto w-full">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-primary mb-4">
                <div className="p-2 rounded-full bg-soft-blue/50 flex items-center justify-center">
                  <DynamicIcon
                    name="PlusCircle"
                    className="h-6 w-6 text-primary"
                  />
                </div>
                🗂️Nova Subcategoria
              </h2>
              <CategoryForm
                onAddCategory={handleAddCategory}
                allCategories={categories}
                hideCardWrapper={true}
              />
            </Card>

            <Card className="rounded-xl shadow-sm max-w-[700px] mx-auto w-full">
              {/* Title is inside CategoriesList for consistency or I should wrap it? 
                  CategoriesList has title inside it. Let's rely on CategoriesList styling but it has a Card inside.
                  Wait, CategoriesList returns a Card. So I should NOT wrap it in a Card.
              */}
              <CategoriesList
                categories={hierarchicalCategories}
                onDeleteCategory={handleDeleteCategory}
                onEditCategory={(cat) => {
                  setEditingCategory(cat);
                  setIsEditModalOpen(true);
                }}
                isMobile={isMobile}
                allFlatCategories={categories}
              />
            </Card>
          </div>
        )}
      </div>

      <EditCategoryModal
        isOpen={isEditModalOpen}
        onOpenChange={setIsEditModalOpen}
        editingCategory={editingCategory}
        onUpdateCategory={handleUpdateCategory}
        onCancelEdit={() => {
          setIsEditModalOpen(false);
          setEditingCategory(null);
        }}
        allCategories={categories}
      />

      {!isMobile && <Footer isMobile={isMobile} user={user} />}
    </div>
  );
}