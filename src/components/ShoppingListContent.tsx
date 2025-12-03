import React, { useState, useEffect, useRef, useCallback } from "react";
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
const toastSuccessStyle = { backgroundColor: '#F3FFF3', color: '#006000' };
const toastErrorStyle = { backgroundColor: '#F3FFF3', color: '#FF2929' };

export const ShoppingListContent: React.FC<ShoppingListContentProps> = ({ user, isMobile }) => {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Fetch shopping items
  const { data: fetchedItems = [], isLoading, isError, error } = useQuery<ShoppingItem[]>({
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
      if (fetchedItems.length === 0) {
        setItems([{ ...EMPTY_ITEM, id: crypto.randomUUID(), order: 1 }]);
      } else {
        setItems([...fetchedItems, { ...EMPTY_ITEM, id: fetchedItems.length + 1, order: fetchedItems.length + 1 }]);
      }
      setInitialLoadComplete(true);
    }
    // If user logs out, reset initialLoadComplete to allow re-initialization on next login
    if (!user && initialLoadComplete) {
      setInitialLoadComplete(false);
      setItems([]); // Clear items when user logs out
    }
  }, [user, fetchedItems, isLoading, isError, initialLoadComplete]);

  // Focus on the first input if it's an empty item and it's the only item
  useEffect(() => {
    if (items.length === 1 && items[0].product === "" && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [items]);

  // Mutations for Supabase operations
  const upsertItemsMutation = useMutation({
    mutationFn: async (itemsToUpsert: (TablesInsert<'shopping_items'> | TablesUpdate<'shopping_items'>)[]) => {
      if (!user?.id) throw new Error("Usuário não autenticado.");

      const itemsWithUserId = itemsToUpsert.map(item => ({
        ...item,
        user_id: user.id,
      }));

      const { data, error } = await supabase
        .from("shopping_items")
        .upsert(itemsWithUserId, { onConflict: 'id' })
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shopping_items", user?.id] });
      toast.success("Lista de compras salva!", { duration: toastDuration, style: toastSuccessStyle });
    },
    onError: (err) => {
      toast.error("Erro ao salvar lista de compras", { description: err.message, duration: toastDuration, style: toastErrorStyle });
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
      toast.success("Item removido com sucesso!", { duration: toastDuration, style: toastSuccessStyle, className: "shopping-list-toast-success" });
    },
    onError: (err) => {
      toast.error("Erro ao remover itens", { description: err.message, duration: toastDuration, style: toastErrorStyle });
      console.error("Supabase error deleting shopping items:", err);
    },
  });

  const handleProductChange = (index: number, value: string) => {
    const newItems = [...items];
    // Auto-capitalize first letter, rest lowercase
    const formattedValue = value.length > 0
      ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
      : "";
    newItems[index].product = formattedValue;
    setItems(newItems);

    // If typing in the last (empty) row, add a new empty row below
    if (index === items.length - 1 && formattedValue.length > 0) {
      setItems([...newItems, { ...EMPTY_ITEM, id: crypto.randomUUID(), order: items.length + 1 }]);
    }
  };

  const handleStatusChange = (index: number, checked: boolean) => {
    const newItems = [...items];
    newItems[index].status = checked;
    newItems[index].date = checked ? format(new Date(), "MMM/dd", { locale: ptBR }) : "";
    setItems(newItems);
  };

  // This function is for backspace on empty input
  const handleRemoveItemOnBackspace = (index: number) => {
    if (items.length === 1) return; // Don't remove the last item

    const itemToRemove = items[index];
    const newItems = items.filter((_, i) => i !== index);

    // If the item had an ID (was saved to DB), mark for deletion
    if (itemToRemove.product.trim() === "" && itemToRemove.id && fetchedItems.some(fi => fi.id === itemToRemove.id)) {
      // Only remove if it's an empty row and was a fetched item
      setItems(newItems);
      if (itemToRemove.id) {
        deleteItemsMutation.mutate([itemToRemove.id]);
      }
    } else if (itemToRemove.product.trim() !== "") {
      // If it's a non-empty item, allow deletion
      setItems(newItems);
      if (itemToRemove.id) {
        deleteItemsMutation.mutate([itemToRemove.id]);
      }
    }
  };

  const handleInputKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && items[index].product === "" && items.length > 1 && index !== items.length - 1) {
      e.preventDefault(); // Prevent default backspace behavior
      handleRemoveItemOnBackspace(index);
      // Focus on the previous input if available
      if (inputRefs.current[index - 1]) {
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "Enter") {
      e.preventDefault(); // Prevent default form submission or new line
      // If not the last item, or if it's the last item and it has content (meaning a new empty row was just added by handleProductChange)
      if (index < items.length - 1 || (index === items.length - 1 && items[index].product.trim() !== "")) {
        // Focus the next input. If a new row was added, this will be the input in that new row.
        // Using setTimeout to ensure the DOM element is rendered before attempting to focus.
        setTimeout(() => {
          inputRefs.current[index + 1]?.focus();
        }, 0);
      }
      // If it's the last item and it's empty, do nothing.
    }
  };

  // New function for trash icon deletion
  const handleDeleteRow = async (itemId: string) => {
    const itemToDelete = items.find(item => item.id === itemId);
    if (!itemToDelete) return;

    const newItems = items.filter(item => item.id !== itemId);

    // If the item was saved to DB, trigger deletion mutation
    if (itemToDelete.id && fetchedItems.some(fi => fi.id === itemToDelete.id)) {
      await deleteItemsMutation.mutateAsync([itemToDelete.id]);
    }

    // Ensure there's always at least one empty row if all non-empty items are gone
    if (newItems.filter(item => item.product.trim() !== "").length === 0) {
      // If all remaining items are empty, or if newItems is completely empty,
      // ensure there's exactly one empty row.
      setItems([{ ...EMPTY_ITEM, id: crypto.randomUUID(), order: 1 }]);
    } else {
      setItems(newItems);
    }
  };


  const handleSaveList = async () => {
    if (!user?.id) {
      toast.error("Usuário não autenticado.", { duration: toastDuration, style: toastErrorStyle });
      return;
    }

    const itemsToSave: TablesInsert<'shopping_items'>[] = [];
    const itemsToUpdate: TablesUpdate<'shopping_items'>[] = [];
    const existingItemIds = new Set(fetchedItems.map(item => item.id));
    let currentOrder = 1;

    items.forEach(item => {
      if (item.product.trim() !== "") { // Only save non-empty items
        const itemData = {
          ...item,
          user_id: user.id,
          order: currentOrder++,
        };
        if (existingItemIds.has(item.id)) {
          itemsToUpdate.push(itemData);
        } else {
          itemsToSave.push(itemData);
        }
      }
    });

    const idsToDelete = fetchedItems
      .filter(fetchedItem => !items.some(currentItem => currentItem.id === fetchedItem.id && currentItem.product.trim() !== ""))
      .map(item => item.id);

    try {
      if (itemsToSave.length > 0 || itemsToUpdate.length > 0) {
        await upsertItemsMutation.mutateAsync([...itemsToSave, ...itemsToUpdate]);
      }
      if (idsToDelete.length > 0) {
        await deleteItemsMutation.mutateAsync(idsToDelete);
      }
      // After saving, re-initialize the list to ensure a single empty row at the end
      queryClient.invalidateQueries({ queryKey: ["shopping_items", user?.id] });
    } catch (error) {
      // Error handled by mutations' onError
    }
  };

  const handleClearList = () => {
    if (!user?.id) {
      toast.error("Usuário não autenticado.", { duration: toastDuration, style: toastErrorStyle });
      return;
    }
    const idsToDelete = fetchedItems.map(item => item.id);
    if (idsToDelete.length > 0) {
      deleteItemsMutation.mutate(idsToDelete, {
        onSuccess: () => {
          setItems([{ ...EMPTY_ITEM, id: crypto.randomUUID(), order: 1 }]);
          if (inputRefs.current[0]) {
            inputRefs.current[0].focus();
          }
        }
      });
    } else {
      setItems([{ ...EMPTY_ITEM, id: crypto.randomUUID(), order: 1 }]);
      if (inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    }
  };

  if (isLoading) {
    return (
      <div className={cn("p-6", isMobile && "p-4")}>
        <div className="animate-pulse text-muted-foreground text-center py-8">Carregando lista de compras...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={cn("p-6", isMobile && "p-4")}>
        <div className="text-destructive text-center py-8">Erro ao carregar lista: {error?.message}</div>
      </div>
    );
  }

  return (
    <div className={cn("w-full p-4 lg:p-6")}> {/* Main container with padding */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
        <h2 className={cn("text-2xl font-bold text-primary", isMobile && "text-xl")}>🛒 Lista de Compras</h2>
      </div>

      <div className="overflow-x-auto">
        <div className="rounded-xl border"> {/* Applied rounded-xl here */}
          {/* Sticky Header */}
          <div className="sticky top-0 z-10 bg-slate-200 rounded-t-xl grid grid-cols-12 py-[6px] min-h-[42px] items-center border-b border-gray-200 text-sm text-gray-700"> {/* Adjusted font size and color */}
            <div className="col-span-2 text-center font-bold">Nº</div>
            <div className="col-span-5 font-bold">Produto</div> {/* Adjusted col-span */}
            <div className="col-span-2 text-center font-bold">Status</div>
            <div className="col-span-3 text-right font-bold pr-4">Ações</div> {/* Adjusted col-span and alignment */}
          </div>

          {/* LISTA COM SCROLL */}
          <div className="max-h-[350px] overflow-y-auto divide-y divide-gray-200 bg-white">
            {items.map((item, index) => (
              <div
                key={item.id}
                className={cn(
                  "grid grid-cols-12 items-center py-[6px] min-h-[50px] hover:bg-slate-50",
                  item.status && "bg-soft-green/20"
                )}
              >

                {/* Nº */}
                <div className="col-span-2 text-center font-medium">
                  {index + 1}
                </div>

                {/* Produto + Data */}
                <div className="col-span-5"> {/* Adjusted col-span */}
                  <input
                    ref={el => (inputRefs.current[index] = el)}
                    onKeyDown={(e) => handleInputKeyDown(index, e)}
                    className={cn(
                      "w-full bg-transparent outline-none text-sm border-none focus-visible:ring-0 focus-visible:outline-none px-0 py-0 h-auto",
                      item.status && "text-gray-400"
                    )}
                    value={item.product}
                    onChange={(e) => handleProductChange(index, e.target.value)}
                  />

                  {item.date && (
                    <p className="mt-[1px] text-[10px] text-gray-500">
                      {item.date}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-2 flex justify-center">
                  <button
                    onClick={() => handleStatusChange(index, !item.status)}
                    className={cn(
                      "flex items-center justify-center rounded-full cursor-pointer select-none transition-all border",

                      item.status
                        ? "bg-[#44E37F] border-[#44E37F] text-white font-black"
                        : "border-destructive bg-transparent text-transparent",

                      isMobile
                        ? "h-[17px] w-[17px] text-[8px]"
                        : "h-[21px] w-[21px] text-[10px]"
                    )}
                  >
                    {item.status && "✓"}
                  </button>
                </div>

                {/* Ações - Excluir */}
                <div className="col-span-3 flex justify-center pr-4"> {/* Adjusted col-span and alignment */}
                  {item.product.trim() !== "" && ( // Only show trash icon for non-empty items
                    <button
                      onClick={() => handleDeleteRow(item.id)}
                      className="text-destructive hover:text-red-700"
                    >
                      <DynamicIcon name="Trash2" className="h-5 w-5" />
                    </button>
                  )}
                </div>

              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Buttons Container */}
      <div className="mt-6 flex w-full gap-3 justify-between">
        {/* Limpar Lista Button with Confirmation Modal */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="destructive"
              className="rounded-xl flex-1"
            >
              <DynamicIcon name="Trash2" className="mr-2 h-4 w-4" /> Limpar Lista
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmação</AlertDialogTitle>
              <AlertDialogDescription>
                Deseja realmente excluir todos os itens da lista?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearList} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Salvar Button */}
        <Button
          onClick={handleSaveList}
          className="rounded-xl flex-1"
        >
          <DynamicIcon name="CheckCircle" className="mr-2 h-4 w-4" /> Salvar
        </Button>
      </div>
    </div>
  );
};