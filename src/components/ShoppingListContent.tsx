import React, { useState, useEffect, useRef } from "react";
import { Check, Circle, Package } from "lucide-react";
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

  const [sortType, setSortType] = useState<'default' | 'pending' | 'bought'>('default');
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

  // Function to toggle sort
  const handleToggleSort = (type: 'pending' | 'bought') => {
    setSortType((prev) => {
      const next = prev === type ? 'default' : type;

      setItems((prevItems) => {
        const nonEmpty = prevItems.filter(
          (item) => item.product.trim() !== ""
        );
        const empty = prevItems.filter((item) => item.product.trim() === "");

        let sortedNonEmpty = [...nonEmpty];

        if (next === 'pending') {
          // Pendentes (false) primeiro
          sortedNonEmpty.sort((a, b) => {
            if (a.status === b.status) return 0;
            return a.status ? 1 : -1;
          });
        } else if (next === 'bought') {
          // Comprados (true) primeiro
          sortedNonEmpty.sort((a, b) => {
            if (a.status === b.status) return 0;
            return a.status ? -1 : 1;
          });
        } else {
          // Default: order
          sortedNonEmpty.sort((a, b) => (a.order || 0) - (b.order || 0));
        }

        return [...sortedNonEmpty, ...empty];
      });

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
        isMobile ? "h-full overflow-hidden pt-0 pb-2 px-[4px]" : "h-full p-6"
      )}
    >
      {/* Main container with padding */}
      <div className={cn("flex flex-col items-center gap-1 w-full text-center", isMobile ? "mb-2" : "mb-4")}>
        <h2
          className={cn(
            "flex items-center justify-center gap-2 text-2xl font-bold text-[#356DD8] w-full -mt-[4px] mb-[3px]",
            isMobile && "text-xl -mt-[5px]"
          )}
        >
          <DynamicIcon 
            name="ShoppingCart" 
            className={cn("shrink-0 fill-current", isMobile ? "h-[22px] w-[22px]" : "h-[26px] w-[26px]")} 
          />
          <span>Lista de Compras</span>
        </h2>

        <div className="flex items-center justify-between gap-2 mt-1 w-full px-1">
          {/* Total Items - Reset Sort */}
          <button
            type="button"
            onClick={() => setSortType('default')}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-[12px] border transition-all duration-200 active:scale-95 shadow-sm min-w-0",
              "bg-gray-100/70 border-gray-200 text-gray-600 font-medium hover:bg-gray-100"
            )}
          >
            <span className="text-[12px] xs:text-[13px] sm:text-[15px] flex items-center gap-1 whitespace-nowrap">
              {totalItems} Itens
            </span>
          </button>

          {/* Pending Items */}
          <button
            type="button"
            onClick={() => handleToggleSort('pending')}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-[12px] border transition-all duration-200 active:scale-95 shadow-sm min-w-0",
              sortType === 'pending'
                ? "bg-red-100 border-red-300 text-red-700 font-bold shadow-inner"
                : "bg-red-50/40 border-red-100/60 text-red-500/70 font-medium hover:bg-red-50"
            )}
          >
            <span className="text-[12px] xs:text-[13px] sm:text-[15px] flex items-center justify-center gap-1 whitespace-nowrap">
              {pendingItems} Pendentes
            </span>
          </button>

          {/* Bought Items */}
          <button
            type="button"
            onClick={() => handleToggleSort('bought')}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 px-2 sm:px-4 py-2 rounded-[12px] border transition-all duration-200 active:scale-95 shadow-sm min-w-0",
              sortType === 'bought'
                ? "bg-emerald-100 border-emerald-300 text-emerald-700 font-bold shadow-inner"
                : "bg-emerald-50/40 border-emerald-100/60 text-emerald-500/70 font-medium hover:bg-emerald-50"
            )}
          >
            <span className="text-[12px] xs:text-[13px] sm:text-[15px] flex items-center justify-center gap-1 whitespace-nowrap">
              {boughtItems} Comprados
            </span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col w-full min-h-0">
        <div className={cn("mb-4 shrink-0 relative mt-2 w-full")}>
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
            isMobile ? "" : "rounded-xl border bg-lancamentos-mobile-bg mb-2 font-roboto"
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
                    "bg-[#FCFDFE] rounded-[7px] py-2 px-4 border border-[#E2E8F0]/60 shadow-[0_1px_2px_rgba(15,23,42,0.03)] flex items-center justify-between mb-2 animate-fade-in active:scale-[0.99] transition-all",
                    item.status ? "border-l-[3px] border-l-[#25D366]" : "border-l-[3px] border-l-[#FF8888]"
                  )}
                >
                  <div className="flex flex-col w-full gap-1">
                    {/* 🟢 PRIMEIRA LINHA: Nº e Produto */}
                    <div className="flex items-center justify-between w-full mt-[2px]">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Nº */}
                        <span className="text-[0.80rem] text-[#356DD8] font-extrabold whitespace-nowrap min-w-[28px] text-center leading-none">
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
                        "text-[10px] tracking-tight shrink-0 ml-3 leading-none",
                        item.status ? "text-[#10B955] font-extrabold" : "text-[#FF8888] font-medium"
                      )}>
                        {item.status ? "COMPRADO" : "Pendente"}
                      </span>
                    </div>

                    {/* 🟢 SEGUNDA LINHA: Data e Ações */}
                    <div className="flex items-center justify-between w-full mt-[2px]">
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
                            "h-[18px] w-[18px] rounded-full flex items-center justify-center transition-all relative",
                            item.status
                              ? "bg-[#25D366] border border-[#25D366] shadow-sm"
                              : "bg-transparent border-none shadow-none"
                          )}
                        >
                          {item.status ? (
                            <Check className="absolute text-white w-[14px] h-[14px]" strokeWidth={4} />
                          ) : (
                            <Circle className="absolute text-[#FF8888] w-[16px] h-[16px]" strokeWidth={2.5} />
                          )}
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="h-7 w-7 text-red-400 bg-red-50 hover:bg-red-100 rounded-full flex items-center justify-center transition-colors">
                              <DynamicIcon name="Trash2" className="h-4 w-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent 
                            className={cn(isMobile ? "dialog-mobile w-[99%] max-w-[99%] !rounded-[22px] !pb-4 !border-2 !border-white shadow-2xl" : "sm:max-w-[425px] !pb-4 !rounded-[22px] !border-2 !border-white shadow-2xl")}
                            style={{
                              background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                              backdropFilter: "blur(8px)"
                            }}
                          >
                            <AlertDialogHeader>
                              <AlertDialogTitle className="flex items-center justify-center gap-2 text-xl font-black">
                                <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
                                Confirmar Exclusão
                              </AlertDialogTitle>
                              <AlertDialogDescription className="text-center text-gray-500 font-medium font-roboto">
                                Deseja remover "<span className="text-[#1E3A8A] font-bold">{item.product}</span>" da sua lista?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className={cn("flex flex-row gap-2", isMobile && "items-center justify-between mt-4")}>
                              <AlertDialogCancel className={cn(
                                "flex-1 rounded-2xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11 mt-0",
                                isMobile && "h-12 text-lg"
                              )} style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteRow(item.id)}
                                className={cn(
                                  "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                                  isMobile && "h-12 text-lg"
                                )}
                                style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
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
                  <div className={cn("col-span-2 text-center font-bold text-[#356DD8] text-base", item.status && "opacity-60")}>
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
                        <AlertDialogContent 
                          className={cn(isMobile ? "dialog-mobile w-[99%] max-w-[99%] !rounded-[22px] !pb-4 !border-2 !border-white shadow-2xl" : "sm:max-w-[425px] !pb-4 !rounded-[22px] !border-2 !border-white shadow-2xl")}
                          style={{
                            background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
                            backdropFilter: "blur(8px)"
                          }}
                        >
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center justify-center gap-2 text-xl font-black">
                              <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
                              Confirmar Exclusão
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-center text-gray-500 font-medium font-roboto">
                              Deseja remover "<span className="text-[#1E3A8A] font-bold">{item.product}</span>" da sua lista?
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className={cn("flex flex-row gap-2", isMobile && "items-center justify-between mt-4")}>
                            <AlertDialogCancel className={cn(
                              "flex-1 rounded-2xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11 mt-0",
                              isMobile && "h-12 text-lg"
                            )} style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}>Cancelar</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteRow(item.id)}
                              className={cn(
                                "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                                isMobile && "h-12 text-lg"
                              )}
                              style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
                            >
                              Excluir
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
        "shrink-0 w-full",
        isMobile ? "fixed bottom-[28px] left-0 right-0 py-2 bg-transparent z-40 mb-0 container-app" : "mt-4 mb-2"
      )}>
        <div className={cn("flex w-full gap-3 justify-between", isMobile && "px-[4px]")}>
        {/* Limpar Lista Button with Confirmation Modal */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              className={cn(
                "btn-3d",
                "rounded-xl flex-1",
                isMobile ? "h-[39px] text-[14.5px] font-[800]" : "h-9 text-sm font-bold"
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
          <AlertDialogContent 
            className={cn(isMobile ? "dialog-mobile w-[99%] max-w-[99%] !rounded-[22px] !pb-4 !border-2 !border-white shadow-2xl" : "sm:max-w-[450px] !pb-4 !rounded-[22px] !border-2 !border-white shadow-2xl")}
            style={{
              background: "linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)",
              backdropFilter: "blur(8px)"
            }}
          >
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center justify-center gap-2 text-xl font-black">
                <DynamicIcon name="Trash2" className="h-6 w-6 text-destructive" />
                Limpar Lista?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-center text-gray-500 font-medium font-roboto">
                Essa ação irá remover <span className="text-destructive font-bold">TODOS</span> os itens da sua lista permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className={cn("flex flex-row gap-2", isMobile && "items-center justify-between mt-4")}>
              <AlertDialogCancel className={cn(
                "flex-1 rounded-2xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11 mt-0",
                isMobile && "h-12 text-lg"
              )} style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleClearList}
                className={cn(
                  "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                  isMobile && "h-12 text-lg"
                )}
                style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
              >
                Limpar Tudo
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Salvar Button */}
        {/* Salvar Button (Removed) */}
        </div>
      </div>
    </div>
  );
};
