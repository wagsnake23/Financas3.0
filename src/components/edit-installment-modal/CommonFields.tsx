import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppCategory } from "@/types/finance";
import { cn } from "@/lib/utils";
import { CurrencyInput } from "@/components/ui/currency-input"; // Importar CurrencyInput
import { StatusToggleButton } from "@/components/StatusToggleButton"; // NEW IMPORT
import { Database } from "@/integrations/supabase/types"; // NEW IMPORT for ReceitaStatus

type ReceitaStatus = Database['public']['Enums']['receita_status'];

interface CommonFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  value: number | undefined; // Alterado para number | undefined
  setValue: (value: number | undefined) => void; // Alterado para number | undefined
  categoryId: string;
  setCategoryId: (id: string) => void;
  filteredCategories: AppCategory[]; // Agora contém apenas subcategorias
  getCategoryDisplayName: (id: string) => string;
  loading: boolean;
  isMobile: boolean;
  hideTitle?: boolean; // Para esconder o título na opção "Somente este mês"
  categoryLabel?: string; // Nova prop para personalizar a label da categoria
  // NEW PROPS FOR STATUS TOGGLE
  isPaid: boolean;
  setIsPaid: (paid: boolean) => void;
  transactionType: "income" | "expense";
  editOption: "thisMonth" | "thisMonthForward" | "all";
}

const UNSELECTED_VALUE = "unselected";

export const CommonFields: React.FC<CommonFieldsProps> = ({
  title,
  setTitle,
  value,
  setValue,
  categoryId,
  setCategoryId,
  filteredCategories, // Usar filteredCategories diretamente (já são subcategorias)
  getCategoryDisplayName,
  loading,
  isMobile,
  hideTitle = false,
  categoryLabel = "Subcategoria", // Valor padrão alterado para Subcategoria
  // NEW PROPS FOR STATUS TOGGLE
  isPaid,
  setIsPaid,
  transactionType,
  editOption,
}) => {
  const showStatusToggleNextToValue = isMobile && editOption === "thisMonth";

  return (
    <div className="space-y-4">
      {!hideTitle && (
        <div className="space-y-2">
          <Label htmlFor="title" className={cn(isMobile && "text-xs")}>Título</Label>
          <Input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={loading}
            className={cn("rounded-xl", isMobile && "h-9 text-sm")}
          />
        </div>
      )}

      <div className={cn("grid gap-4", showStatusToggleNextToValue ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
        <div className="space-y-2">
          <Label htmlFor="value" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
          <div className={cn("flex items-end gap-2", showStatusToggleNextToValue && "flex-row")}> {/* Flex container for value and status */}
            <CurrencyInput
              id="value"
              value={value}
              onValueChange={(values) => setValue(values.floatValue)}
              placeholder="0,00"
              required
              disabled={loading}
              className={cn("rounded-xl", isMobile && "h-9 text-sm", showStatusToggleNextToValue && "flex-1")}
            />
            {showStatusToggleNextToValue && (
              <StatusToggleButton
                currentStatus={isPaid ? "Recebida" : "Pendente"}
                transactionType={transactionType}
                onToggle={() => setIsPaid(!isPaid)}
                isMobile={isMobile}
                disabled={loading}
              />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="category" className={cn(isMobile && "text-xs")}>{categoryLabel}</Label>
          <Select value={categoryId} onValueChange={setCategoryId} disabled={loading}>
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
              <SelectValue placeholder="Selecione a subcategoria" /> {/* Placeholder atualizado */}
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a subcategoria</SelectItem>
              {filteredCategories.length === 0 ? (
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem>
              ) : (
                filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icone}</span>
                      <span>{getCategoryDisplayName(cat.id)}</span>
                    </span>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
};