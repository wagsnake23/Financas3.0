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
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

// Helper type matching CategoriesList expectation
interface HierarchicalCategory extends AppCategory {
  subCategories?: HierarchicalCategory[];
}

export default function Categorias() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
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
        "flex flex-col min-h-screen bg-background md:pt-16",
        isMobile && "bg-lancamentos-mobile-bg"
      )}
    >
      <Navigation />

      {/* HEADER PREMIUM — FINTECH STYLE (CATEGORIAS THEME) */}
      <div className={cn(
        "relative h-[220px] w-full overflow-hidden",
        isMobile ? "bg-gradient-to-b from-[#1E6BCE] via-[#1E6BCE] via-45% to-transparent" : "bg-background"
      )}>
        <div className={cn(
          "container mx-auto px-6 relative z-10 max-w-[1200px]",
          isMobile ? "fixed top-[46px] left-0 right-0 h-[70px] z-40 px-4 flex items-center bg-transparent justify-between" : "pt-12 md:pt-16 flex justify-between items-start"
        )}>
          <div>
            <div className="flex items-start gap-3">
              <Button
                variant="ghost"
                className={cn("btn-3d p-2 rounded-xl flex items-center justify-center shadow-sm border-none cursor-pointer hover:scale-105 active:scale-95 transition-all h-auto w-auto", isMobile ? "mt-0" : "mt-1")}
                style={isMobile ? { "--cor-topo": "#E6F0FF", "--cor-base": "#DCEBFF" } as any : { "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
                onClick={() => navigate(-1)}
              >
                <DynamicIcon
                  name="Tags"
                  className={cn("!text-[#1E6BCE]", isMobile ? "h-4 w-4" : "h-5 w-5")}
                  strokeWidth={4}
                />
              </Button>
              <div className="flex flex-col">
                <h1 className={cn("font-black tracking-tight -mt-0.5", isMobile ? "text-xl text-white" : "text-2xl text-slate-800")}>
                  Categorias
                </h1>
                <p className={cn("font-bold -mt-0.5 leading-none", isMobile ? "text-xs text-white" : "text-sm text-slate-500")}>
                  Gerencie suas categorias de despesas e receitas
                </p>
              </div>
            </div>
          </div>

          <Button
            onClick={() => navigate(-1)}
            className={cn(
              "btn-3d h-9 px-3 rounded-xl font-black text-xs shadow-sm border-none transition-all active:scale-95 !text-[#1E6BCE] bg-white hover:bg-white/90",
              isMobile ? "h-8 px-2" : ""
            )}
            style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
          >
            <DynamicIcon name="ChevronLeft" className="mr-1 h-4 w-4 !text-[#1E6BCE]" strokeWidth={3} />
            Voltar
          </Button>
        </div>
      </div>

      <main
        className={cn(
          "container mx-auto px-4 relative z-20 max-w-[1200px] space-y-6",
          isMobile ? "-mt-32 pb-32" : "-mt-24 pb-20",
          !isMobile && "px-6"
        )}
      >
        {isMobile ? (
          <div className="space-y-6">
            <Card className="w-full !max-w-full p-6 rounded-[24px] shadow-md border-2 border-white space-y-4 card-yellow relative overflow-hidden">
              <h2 className="text-xl font-black flex items-center gap-2 text-[#374151]">
                <div className="p-2 rounded-full bg-[#374151]/10 flex items-center justify-center">
                  <DynamicIcon
                    name="PlusCircle"
                    className="h-6 w-6 text-[#374151]"
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

            <Card className="w-full !max-w-full p-6 rounded-[24px] shadow-md border-2 border-white space-y-4 card-yellow relative overflow-hidden">
              <h2 className="text-xl font-black flex items-center gap-2 text-[#374151]">
                <div className="p-2 rounded-full bg-[#374151]/10 flex items-center justify-center">
                  <DynamicIcon
                    name="List"
                    className="h-6 w-6 text-[#374151]"
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
            </Card>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card
              className="p-6 rounded-[24px] shadow-md border-2 border-white card-yellow relative overflow-hidden"
              style={{ backgroundColor: "transparent" }}
            >
              <h2 className="text-xl font-black flex items-center gap-2 text-[#374151] mb-4">
                <div className="p-2 rounded-full bg-[#374151]/10 flex items-center justify-center">
                  <DynamicIcon
                    name="PlusCircle"
                    className="h-6 w-6 text-[#374151]"
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

            <Card
              className="rounded-[24px] shadow-md border-2 border-white card-yellow overflow-hidden relative"
              style={{ backgroundColor: "transparent" }}
            >
              <div className="p-6 pb-0">
                <h2 className="text-xl font-black flex items-center gap-2 text-[#374151] mb-4">
                  <div className="p-2 rounded-full bg-[#374151]/10 flex items-center justify-center">
                    <DynamicIcon
                      name="List"
                      className="h-6 w-6 text-[#374151]"
                    />
                  </div>
                  🗃️Categorias Cadastradas
                </h2>
              </div>
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
      </main>

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