import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { ShoppingItem } from "@/types/finance";
import { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import DynamicIcon from "./DynamicIcon";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge"; // Importar Badge

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
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });

  // Initialize items state from fetched data
  useEffect(() => {
    if (fetchedItems && !initialLoadComplete) {
      if (fetchedItems.length === 0) {
        setItems([{ ...EMPTY_ITEM, id: crypto.randomUUID(), order: 1 }]);
      } else {
        setItems([...fetchedItems, { ...EMPTY_ITEM, id: crypto.randomUUID(), order: fetchedItems.length + 1 }]);
      }
      setInitialLoadComplete(true);
    }
  }, [fetchedItems, initialLoadComplete]);

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
      toast.success("Itens removidos!", { duration: toastDuration, style: toastSuccessStyle });
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
    if (itemToRemove.product.trim() === "" && itemToRemove.id && itemToRemove.id !== newItems[newItems.length -1].id) {
      // Only remove if it's an empty row and not the last empty row
      setItems(newItems);
    } else if (itemToRemove.product.trim() !== "") {
      // If it's a non-empty item, allow deletion
      setItems(newItems);
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

  const handleMarkAll = (status: boolean) => {
    const newItems = items.map(item => ({
      ...item,
      status: item.product.trim() !== "" ? status : false, // Only mark non-empty items
      date: item.product.trim() !== "" && status ? format(new Date(), "MMM/dd", { locale: ptBR }) : "",
    }));
    setItems(newItems);
  };

  const handleCancel = () => {
    // Reset to the last fetched state + one empty row
    if (fetchedItems.length === 0) {
      setItems([{ ...EMPTY_ITEM, id: crypto.randomUUID(), order: 1 }]);
    } else {
      setItems([...fetchedItems, { ...EMPTY_ITEM, id: crypto.randomUUID(), order: fetchedItems.length + 1 }]);
    }
    toast.info("Alterações canceladas.", { duration: toastDuration });
  };

  if (isLoading) {
    return (
      <Card className={cn("p-6 rounded-xl shadow-sm", isMobile && "p-4")}>
        <div className="animate-pulse text-muted-foreground text-center py-8">Carregando lista de compras...</div>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className={cn("p-6 rounded-xl shadow-sm", isMobile && "p-4")}>
        <div className="text-destructive text-center py-8">Erro ao carregar lista: {error?.message}</div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-6 rounded-xl shadow-sm", isMobile && "p-4")}>
      <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-2">
        <h2 className={cn("text-2xl font-bold text-primary", isMobile && "text-xl")}>Lista de Compras</h2>
        {!isMobile && (
          <div className="flex gap-2">
            <Button onClick={() => handleMarkAll(true)} variant="outline" className="rounded-xl">
              <DynamicIcon name="CheckCircle" className="mr-2 h-4 w-4 text-success" /> Marcar tudo comprado
            </Button>
            <Button onClick={() => handleMarkAll(false)} variant="outline" className="rounded-xl">
              <DynamicIcon name="Circle" className="mr-2 h-4 w-4 text-destructive" /> Marcar tudo pendente
            </Button>
          </div>
        )}
      </div>

      {isMobile && (
        <div className="flex justify-center gap-2 mb-4">
          <Button onClick={() => handleMarkAll(true)} variant="outline" className="rounded-xl h-9 text-sm flex-1">
            <DynamicIcon name="CheckCircle" className="mr-1 h-4 w-4 text-success" /> Comprado
          </Button>
          <Button onClick={() => handleMarkAll(false)} variant="outline" className="rounded-xl h-9 text-sm flex-1">
            <DynamicIcon name="Circle" className="mr-1 h-4 w-4 text-destructive" /> Pendente
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <div className="max-h-[350px] overflow-y-auto rounded-md border">
          <Table className="min-w-full">
            <TableHeader className="sticky top-0 z-10 bg-slate-200 rounded-t-md"> {/* Updated header styling and rounded corners */}
              <TableRow>
                <TableHead className="text-slate-800 font-bold w-[5%] text-center">Nº</TableHead> {/* Changed title */}
                <TableHead className="text-slate-800 font-bold w-[55%]">Produto</TableHead> {/* Changed title */}
                <TableHead className="text-slate-800 font-bold w-[25%] text-center">Status</TableHead>
                <TableHead className="text-slate-800 font-bold w-[15%] text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, index) => (
                <TableRow key={item.id} className={cn("shadow-sm hover:bg-gray-50")}>
                  <TableCell className="py-2 px-2 text-center text-sm font-medium">
                    {index + 1}
                  </TableCell>
                  <TableCell className="py-2 px-2">
                    <Input
                      ref={el => (inputRefs.current[index] = el)}
                      type="text"
                      value={item.product}
                      onChange={(e) => handleProductChange(index, e.target.value)}
                      onKeyDown={(e) => handleInputKeyDown(index, e)}
                      placeholder="Adicionar item..."
                      className="border-none focus-visible:ring-0 focus-visible:outline-none px-0 py-0 h-auto text-base"
                    />
                  </TableCell>
                  <TableCell className="py-2 px-2 text-center">
                    <div className="flex flex-col items-center justify-center gap-1">
                      <Checkbox
                        checked={item.status}
                        onCheckedChange={(checked: boolean) => handleStatusChange(index, checked)}
                        className="h-6 w-6 rounded-md border-2 data-[state=checked]:bg-success data-[state=checked]:text-success-foreground"
                      />
                      {item.product.trim() !== "" && (
                        <Badge
                          className={cn(
                            "px-2 py-1 text-xs font-semibold rounded-full",
                            item.status ? "bg-success text-success-foreground" : "bg-destructive text-destructive-foreground"
                          )}
                        >
                          {item.status ? "Comprado" : "Pendente"}
                        </Badge>
                      )}
                      {item.date && <span className="text-xs text-muted-foreground">{item.date}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="py-2 px-2 text-center">
                    {item.product.trim() !== "" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteRow(item.id)}
                        className="text-destructive hover:bg-destructive/10 hover:text-destructive-foreground"
                      >
                        <DynamicIcon name="Trash2" className="h-5 w-5" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-2">
        <Button onClick={handleClearList} variant="destructive" className="rounded-xl w-full sm:w-auto">
          <DynamicIcon name="Trash2" className="mr-2 h-4 w-4" /> Limpar Lista
        </Button>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleCancel} variant="outline" className="rounded-xl flex-1">
            <DynamicIcon name="XCircle" className="mr-2 h-4 w-4" /> Cancelar
          </Button>
          <Button onClick={handleSaveList} className="rounded-xl flex-1">
            <DynamicIcon name="CheckCircle" className="mr-2 h-4 w-4" /> Salvar
          </Button>
        </div>
      </div>
    </Card>
  );
};