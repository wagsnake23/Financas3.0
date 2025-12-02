import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Navigation } from "@/components/Navigation";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import Loading from "@/components/Loading";
import { useIsMobile } from "@/hooks/use-mobile";
import { Footer } from "@/components/Footer";
import { cn } from "@/lib/utils";
import { AppCategory } from "@/types/finance";
import { Card } from "@/components/ui/card";
import { CategoryForm } from "@/components/CategoryForm";
import { CategoryList } from "@/components/CategoryList";
import DynamicIcon from "@/components/DynamicIcon";

export default function Categorias() {
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

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
      return data as AppCategory[];
    },
    enabled: !!user && !authLoading,
  });

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
              🗂️Nova Categoria
            </h2>
            <CategoryForm user={user} queryClient={queryClient} />

            <h2 className="text-xl font-semibold flex items-center gap-2 text-primary mt-6">
              <div className="p-2 rounded-full bg-soft-blue/50 flex items-center justify-center">
                <DynamicIcon
                  name="List"
                  className="h-6 w-6 text-primary"
                />
              </div>
              🗃️Categorias Cadastradas
            </h2>
            <CategoryList
              categories={categories}
              user={user}
              queryClient={queryClient}
            />

            <Footer isMobile={isMobile} className="pt-2" user={user} />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <Card className="p-6 rounded-xl shadow-sm max-w-[700px] mx-auto">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-primary mb-4">
                <div className="p-2 rounded-full bg-soft-blue/50 flex items-center justify-center">
                  <DynamicIcon
                    name="PlusCircle"
                    className="h-6 w-6 text-primary"
                  />
                </div>
                🗂️Nova Categoria
              </h2>
              <CategoryForm user={user} queryClient={queryClient} />
            </Card>

            <Card className="p-6 rounded-xl shadow-sm max-w-[700px] mx-auto">
              <h2 className="text-xl font-semibold flex items-center gap-2 text-primary mb-4">
                <div className="p-2 rounded-full bg-soft-blue/50 flex items-center justify-center">
                  <DynamicIcon
                    name="List"
                    className="h-6 w-6 text-primary"
                  />
                </div>
                🗃️Categorias Cadastradas
              </h2>
              <CategoryList
                categories={categories}
                user={user}
                queryClient={queryClient}
              />
            </Card>
          </div>
        )}
      </div>

      {!isMobile && <Footer isMobile={isMobile} user={user} />}
    </div>
  );
}