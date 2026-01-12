import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { ShoppingItem } from "@/types/finance";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { parse, isValid as isValidDate } from "date-fns";

interface ShoppingListContentProps {
  user: User | null;
  isMobile: boolean;
}

const EMPTY_ITEM: Omit<ShoppingItem, "id" | "created_at" | "updated_at"> = {
  product: "",
  status: false,
  date: "",
  order: 0,
};

const toastDuration = 1000;
const toastSuccessStyle = { backgroundColor: "#FFFFFF", color: "#006000", border: "1px solid #E5FFE5" };
const toastErrorStyle = { backgroundColor: "#FFFFFF", color: "#FF2929", border: "1px solid #FFE5E5" };

export const ShoppingListContent: React.FC<ShoppingListContentProps> = ({
  user,
  isMobile,
}) => {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [sortPendingFirst, setSortPendingFirst] = useState(false); // New state for sorting
  const [searchTerm, setSearchTerm] = useState("");

  const newItemInputRef = useRef<HTMLInputElement>(null);

  // Contagens (ignorando linhas vazias)
  const filledItems = items.filter((item) => item.product.trim() !== "");
  const totalItems = filledItems.length;
  const pendingItems = filledItems.filter((item) => !item.status).length;
  const boughtItems = filledItems.filter((item) => item.status).length;

  // Fetch shopping items
  const {
    data: fetchedItems = [],
    isLoading,
    isError,
    error,
  } = useQuery<ShoppingItem[]>({
    queryKey: ["shopping_items", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("shopping_items")
        .select("*")
        .eq("user_id", user.id)
        .order("order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id, // This ensures it waits for the user
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Initialize items state from fetched data when user is available and data is loaded
  useEffect(() => {
    if (user && !isLoading && !isError && !initialLoadComplete) {
      setItems(fetchedItems); // Just set fetched items, no empty row needed
      setInitialLoadComplete(true);
    }
    // If user logs out, reset initialLoadComplete to allow re-initialization on next login
    if (!user && initialLoadComplete) {
      setInitialLoadComplete(false);
      setItems([]); // Clear items when user logs out
    }
  }, [user, fetchedItems, isLoading, isError, initialLoadComplete]);



  // Mutations for Supabase operations
  const upsertItemsMutation = useMutation({
    mutationFn: async (
      itemsToUpsert: (
        | TablesInsert<"shopping_items">
        | TablesUpdate<"shopping_items">
      )[]
    ) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");

      const itemsWithUserId = itemsToUpsert.map((item) => ({
        ...item,
        user_id: user.id,
      }));

      const { data, error } = await supabase
        .from("shopping_items")
        .upsert(itemsWithUserId as any, { onConflict: "id" })
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping_items", user?.id] });
      // atualiza também o badge do carrinho
      queryClient.invalidateQueries({
        queryKey: ["shopping_items_pending_count", user?.id],
      });
      toast.success("Atualizado com sucesso", {
        duration: toastDuration,
        style: toastSuccessStyle,
      });
    },
    onError: (err) => {
      toast.error("Erro ao salvar lista de compras", {
        description: err.message,
        duration: toastDuration,
        style: toastErrorStyle,
      });
      console.error("Supabase error saving shopping list:", err);
    },
  });

  const deleteItemsMutation = useMutation({
    mutationFn: async (idsToDelete: string[]) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");
      const { error } = await supabase
        .from("shopping_items")
        .delete()
        .in("id", idsToDelete)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping_items", user?.id] });
      queryClient.invalidateQueries({
        queryKey: ["shopping_items_pending_count", user?.id],
      });
      toast.success("Item removido com sucesso!", {
        duration: toastDuration,
        style: toastSuccessStyle,
        className: "shopping-list-toast-success",
      });
    },
    onError: (err) => {
      toast.error("Erro ao remover itens", {
        description: err.message,
        duration: toastDuration,
        style: toastErrorStyle,
      });
      console.error("Supabase error deleting shopping items:", err);
    },
  });

  const handleSearchTermChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formattedValue =
      value.length > 0
        ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
        : "";
    setSearchTerm(formattedValue);
  };

  const handleSearchClick = () => {
    // A busca agora é "live" (conforme digita),
    // mas mantemos a função caso queira focar no input ou outra lógica futura.
    newItemInputRef.current?.focus();
  };

  const handleNewItemSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const product = searchTerm.trim();
      if (!product) return;

      if (!user?.id) {
        toast.error("Usuário não autenticado.");
        return;
      }

      // Calculate new order
      const maxOrder = items.length > 0 ? Math.max(...items.map((i) => i.order || 0)) : 0;
      const newOrder = maxOrder + 1;

      const optimisticId = crypto.randomUUID();
      const newItem: TablesInsert<"shopping_items"> = {
        id: optimisticId,
        user_id: user.id,
        product: product,
        status: false,
        date: "",
        order: newOrder,
      };

      try {
        const optimisticItem: ShoppingItem = {
          id: optimisticId,
          ...newItem,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as ShoppingItem;

        setItems((prev) => [...prev, optimisticItem]);
        setSearchTerm(""); // Clear input

        // Save to Supabase
        await upsertItemsMutation.mutateAsync([newItem]);

        // Invalidate queries to sync with DB
        queryClient.invalidateQueries({
          queryKey: ["shopping_items", user?.id],
        });
        queryClient.invalidateQueries({
          queryKey: ["shopping_items_pending_count", user?.id],
        });

      } catch (error) {
        console.error("Error adding item:", error);
        // Revert on error (optional, complex to implement perfectly without refetch)
      }
    }
  };

  // New function for trash icon deletion
  const handleDeleteRow = async (itemId: string) => {
    const itemToDelete = items.find((item) => item.id === itemId);
    if (!itemToDelete) return;

    const newItems = items.filter((item) => item.id !== itemId);

    // If the item was saved to DB, trigger deletion mutation
    if (
      itemToDelete.id &&
      fetchedItems.some((fi) => fi.id === itemToDelete.id)
    ) {
      await deleteItemsMutation.mutateAsync([itemToDelete.id]);
    }
    setItems(newItems);
  };

  // Status toggle handler
  // Status toggle handler
  const handleStatusChange = (id: string, checked: boolean) => {
    // Atualiza localmente usando ID
    setItems((prevItems) =>
      prevItems.map((item) =>
        item.id === id
          ? {
            ...item,
            status: checked,
            date: checked
              ? format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
              : "",
          }
          : item
      )
    );

    const item = items.find((i) => i.id === id);
    if (!item) return;

    // Update in Supabase
    if (item.product.trim() !== "") {
      const itemToUpsert: TablesUpdate<"shopping_items"> = {
        id: item.id,
        product: item.product,
        status: checked,
        date: checked ? format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : "",
        order: item.order, // Mantém a ordem original
      };
      upsertItemsMutation.mutate([itemToUpsert], {
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: ["shopping_items_pending_count", user?.id],
          });
        }
      });
    }
  };

  // ✅ handleSaveList mantém comportamento de salvar tudo de uma vez
  const handleSaveList = async () => {
    if (!user?.id) {
      toast.error("Usuário não autenticado.", {
        duration: toastDuration,
        style: toastErrorStyle,
      });
      return;
    }

    // Só trabalha com itens preenchidos
    const filteredItems = items.filter((item) => item.product.trim() !== "");

    // Monta objetos para upsert (mantendo sempre o UUID original)
    const itemsToUpsert: (
      | TablesInsert<"shopping_items">
      | TablesUpdate<"shopping_items">
    )[] = filteredItems.map((item, index) => ({
      id: item.id, // mantém UUID
      product: item.product,
      status: item.status,
      date: item.date,
      order: index + 1, // renumera ordem
    }));

    // Tudo que existe no banco mas não está mais na lista → deletar
    const idsToDelete = fetchedItems
      .filter(
        (fetchedItem) =>
          !filteredItems.some(
            (currentItem) => currentItem.id === fetchedItem.id
          )
      )
      .map((item) => item.id);

    try {
      if (itemsToUpsert.length > 0) {
        await upsertItemsMutation.mutateAsync(itemsToUpsert);
      }

      if (idsToDelete.length > 0) {
        await deleteItemsMutation.mutateAsync(idsToDelete);
      }

      // Recarrega do banco
      queryClient.invalidateQueries({
        queryKey: ["shopping_items", user?.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["shopping_items_pending_count", user?.id],
      });
    } catch (error) {
      console.error("Erro ao salvar lista de compras:", error);
    }
  };

  const handleClearList = () => {
    if (!user?.id) {
      toast.error("Usuário não autenticado.", {
        duration: toastDuration,
        style: toastErrorStyle,
      });
      return;
    }
    const idsToDelete = fetchedItems.map((item) => item.id);
    if (idsToDelete.length > 0) {
      deleteItemsMutation.mutate(idsToDelete, {
        onSuccess: () => {
          setItems([]);
        },
      });
      setItems([]);
    }
  };

  // Function to toggle pending items sort
  const handleTogglePendingSort = () => {
    setSortPendingFirst((prev) => {
      const next = !prev;

      // Ativar ordenação: pendentes primeiro
      if (next) {
        setItems((prevItems) => {
          const nonEmpty = prevItems.filter(
            (item) => item.product.trim() !== ""
          );
          const empty = prevItems.filter((item) => item.product.trim() === "");

          // Pendentes (status === false) primeiro, depois comprados (true)
          const sortedNonEmpty = [...nonEmpty].sort((a, b) => {
            if (a.status === b.status) return 0;
            return a.status ? 1 : -1; // false (pendente) vem antes de true (comprado)
          });

          return [...sortedNonEmpty, ...empty];
        });
      } else {
        // Desativar ordenação: voltar para ordem original (campo 'order')
        setItems((prevItems) => {
          const cloned = [...prevItems];
          cloned.sort((a, b) => (a.order || 0) - (b.order || 0));
          return cloned;
        });
      }

      return next;
    });
  };

  // FILTERED ITEMS (DERIVED STATE)
  const filteredItems = searchTerm
    ? items.filter((item) =>
      item.product.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : items;

  if (isLoading) {
    return (
      <div className={cn("p-6", isMobile && "p-4")}>
        <div className="animate-pulse text-muted-foreground text-center py-8">
          Carregando lista de compras...
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("p-6", isMobile && "p-4")}>
        <div className="text-destructive text-center py-8">
          Erro ao carregar lista: {error?.message}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full flex flex-col",
        isMobile ? "h-full overflow-hidden pt-0 px-2 pb-2" : "h-full p-6"
      )}
    >
      {/* Main container with padding */}
      <div className={cn("flex flex-col items-center gap-1 w-full text-center", isMobile ? "mb-2" : "mb-4")}>
        <h2
          className={cn(
            "text-2xl font-bold text-primary w-full",
            isMobile && "text-xl"
          )}
        >
          🛒 Lista de Compras
        </h2>

        <p className="text-sm text-muted-foreground">
          Total Itens: <span className="font-semibold">{totalItems}</span> •
          Pendentes:{" "}
          <button
            type="button"
            onClick={handleTogglePendingSort}
            className={cn(
              "font-semibold underline-offset-2",
              sortPendingFirst
                ? "text-destructive underline"
                : "text-destructive hover:underline"
            )}
          >
            {pendingItems}
          </button> • Comprados: <span className="font-semibold text-success">{boughtItems}</span>
        </p>
      </div>

      <div className="flex-1 flex flex-col w-full min-h-0">
        <div className={cn("mb-4 shrink-0 relative", isMobile ? "w-full px-1" : "w-full")}>
          <input
            ref={newItemInputRef}
            type="text"
            placeholder="Digite para adicionar… Enter salvar…"
            value={searchTerm}
            onChange={handleSearchTermChange}
            onKeyDown={handleNewItemSubmit}
            className="w-full p-3 pr-11 rounded-xl border border-input bg-white ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium text-sm font-normal placeholder:text-gray-400 placeholder:font-normal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
          <button
            onClick={handleSearchClick}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xl select-none cursor-pointer hover:scale-110 transition-transform"
            title="Pesquisar"
          >
            🔎
          </button>
        </div>

        <div
          className={cn(
            "w-full flex-1 min-h-0 overflow-y-auto no-scrollbar",
            isMobile ? "px-1" : "rounded-xl border bg-lancamentos-mobile-bg mb-2 font-roboto"
          )}
        >
          {/* Sticky Header - Oculto em mobile */}
          {!isMobile && (
            <div
              className="sticky top-0 z-10 grid grid-cols-12 py-[6px] min-h-[42px] items-center border-b border-gray-300 text-sm text-gray-700 bg-gray-100"
            >
              <div className="col-span-2 text-center font-bold">Nº</div>
              <div className="col-span-5 font-bold">Produto</div>
              <div className="col-span-2 text-center font-bold">Status</div>
              <div className="col-span-3 text-right font-bold pr-4">Ações</div>
            </div>
          )}

          {/* LISTA COM SCROLL */}
          <div className={cn("bg-transparent", !isMobile && "divide-y divide-gray-200 bg-lancamentos-mobile-bg")}>
            {filteredItems.length === 0 && (
              searchTerm ? (
                <div className="p-8 text-center text-sm text-muted-foreground animate-fade-in">
                  Nenhum item encontrado
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center pt-8 pb-16 px-4 animate-fade-in select-none">
                  <div className="mb-1">
                    <img
                      src="/empty/cart.webp"
                      alt="Carrinho vazio"
                      className="w-[340px] max-w-[90vw] h-auto object-contain opacity-95"
                    />
                  </div>
                  <h3 className="text-lg font-bold text-[#1E3A8A]/80 mb-1 tracking-tight font-roboto">
                    Sua lista está vazia
                  </h3>
                  <p className="text-sm text-[#64748B] font-medium max-w-[240px] text-center leading-relaxed">
                    Adicione itens para organizar suas compras
                  </p>
                </div>
              )
            )}
            {filteredItems.map((item, index) => (
              isMobile ? (
                <div
                  key={item.id}
                  className={cn(
                    "bg-white rounded-2xl py-2 px-4 shadow-sm border border-gray-100 flex items-center justify-between mb-2 animate-fade-in active:bg-gray-50 transition-all",
                    item.status ? "border-l-4 border-l-success" : "border-l-4 border-l-destructive/30"
                  )}
                >
                  <div className="flex flex-col w-full gap-1">
                    {/* 📌 PRIMEIRA LINHA: Nº e Produto */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Nº */}
                        <span className="text-[0.80rem] text-primary font-black whitespace-nowrap min-w-[28px] text-center leading-none">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        {/* Produto */}
                        <span className={cn(
                          "font-bold text-gray-700 text-[0.80rem] leading-none truncate",
                          item.status && "text-gray-400"
                        )}>
                          {item.product}
                        </span>
                      </div>
                      {/* Status Label */}
                      <span className={cn(
                        "text-[0.75rem] tracking-tight shrink-0 ml-3 leading-none",
                        item.status ? "text-success font-bold" : "text-gray-400 italic"
                      )}>
                        {item.status ? "COMPRADO" : "Pendente"}
                      </span>
                    </div>

                    {/* 📌 SEGUNDA LINHA: Data e Ações */}
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        {/* Ícone alinhado com o Nº */}
                        <div className="min-w-[28px] flex justify-center shrink-0">
                          {item.status && item.date && (
                            <span className="text-[12px]">📅</span>
                          )}
                        </div>
                        {/* Data alinhada com o Produto */}
                        <div className="min-w-0 flex-1">
                          {item.status && item.date && (
                            <span className="text-[0.75rem] text-gray-400 truncate block">
                              {item.date}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Ações Group (Toggle + Delete) */}
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <div
                          onClick={() => handleStatusChange(item.id, !item.status)}
                          className={cn(
                            "h-5 w-5 rounded-full flex items-center justify-center transition-all border shadow-sm cursor-pointer",
                            item.status
                              ? "bg-success border-success text-white scale-110"
                              : "bg-white border-destructive/50 text-transparent hover:border-success/50"
                          )}
                        >
                          {item.status && (
                            <span className="text-[12px] font-[1000] drop-shadow-sm">✓</span>
                          )}
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full flex items-center justify-center transition-colors">
                              <DynamicIcon name="Trash2" className="h-4 w-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="max-w-[320px] rounded-2xl">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center justify-center gap-2">
                                <DynamicIcon name="Trash2" className="h-5 w-5" color="#E85454" />
                                Excluir Item?
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-center">
                                Deseja remover "{item.product}" da sua lista?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="flex-row gap-2">
                              <AlertDialogCancel className="flex-1 rounded-xl border border-blue-100 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-bold mt-0">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteRow(item.id)}
                                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  key={item.id}
                  className={cn(
                    "grid grid-cols-12 items-center py-[6px] min-h-[50px] hover:bg-slate-50",
                    item.status && "bg-green-50"
                  )}
                >
                  {/* Nº */}
                  <div className={cn("col-span-2 text-center font-bold text-primary text-base", item.status && "opacity-60")}>
                    {index + 1}
                  </div>

                  {/* Produto + Data */}
                  <div className="col-span-5">
                    <span
                      className={cn(
                        "text-sm",
                        item.status && "text-gray-400"
                      )}
                    >
                      {item.product}
                    </span>

                    {item.status && item.date && (
                      <p className="mt-[1px] text-[10px] text-gray-500">
                        📅 {item.date}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="col-span-2 flex justify-center">
                    <button
                      onClick={() => handleStatusChange(item.id, !item.status)}
                      className={cn(
                        "flex items-center justify-center rounded-full cursor-pointer select-none transition-all border-2",
                        item.status
                          ? "bg-[#44E37F] border-[#44E37F] text-white font-extrabold"
                          : "border-gray-400 bg-transparent text-transparent",
                        isMobile
                          ? "h-[20px] w-[20px] text-[10px]"
                          : "h-[24px] w-[24px] text-[12px]"
                      )}
                    >
                      {item.status && "✓"}
                    </button>
                  </div>

                  {/* Ações - Excluir */}
                  <div className="col-span-3 flex justify-end pr-4">
                    {item.product.trim() !== "" && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="text-destructive hover:text-red-700">
                            <DynamicIcon name="Trash2" className="h-5 w-5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                              <DynamicIcon name="Trash2" className="h-5 w-5" color="#E85454" />
                              Excluir Item
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              Deseja realmente excluir o produto "{item.product}" da lista?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="rounded-xl border border-blue-100 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-bold">Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteRow(item.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl"
                            >
                              Confirmar
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      </div>

      {/* Buttons Container */}
      <div className={cn(
        "shrink-0 flex w-full gap-3 justify-between",
        isMobile ? "fixed bottom-[34px] left-0 right-0 px-4 py-2 bg-transparent z-40 mb-0" : "mt-4 mb-2"
      )}>
        {/* Limpar Lista Button with Confirmation Modal */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              className={cn(
                "btn-3d",
                "rounded-xl flex-1 h-9 text-sm font-bold"
              )}
              style={
                {
                  "--cor-topo": "#FF6D6D",
                  "--cor-base": "#E85454",
                } as React.CSSProperties
              }
              disabled={totalItems === 0}
            >
              <DynamicIcon name="Trash2" className="mr-2 h-4 w-4" /> Limpar Lista
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="rounded-3xl w-[90%] max-w-[400px]">
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center justify-center gap-2">
                <DynamicIcon name="Trash2" className="h-5 w-5" color="#E85454" />
                Confirmação
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center">
                Deseja realmente excluir todos os itens da lista?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex flex-row gap-2 items-center">
              <AlertDialogCancel className="rounded-xl border border-blue-100 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 font-bold flex-1 mt-0">
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearList}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-xl flex-1 mt-0"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Salvar Button */}
        {/* Salvar Button (Removed) */}
      </div>
    </div>
  );
};
