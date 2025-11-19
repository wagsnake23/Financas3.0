import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppCategory } from "@/types/finance";
import { cn } from "@/lib/utils";

interface CommonFieldsProps {
  title: string;
  setTitle: (title: string) => void;
  value: string;
  setValue: (value: string) => void;
  categoryId: string;
  setCategoryId: (id: string) => void;
  filteredCategories: AppCategory[];
  getCategoryDisplayName: (id: string) => string;
  loading: boolean;
  isMobile: boolean;
  hideTitle?: boolean; // Para esconder o título na opção "Somente este mês"
  categoryLabel?: string; // Nova prop para personalizar a label da categoria
}

const UNSELECTED_VALUE = "unselected";

export const CommonFields: React.FC<CommonFieldsProps> = ({
  title,
  setTitle,
  value,
  setValue,
  categoryId,
  setCategoryId,
  filteredCategories,
  getCategoryDisplayName,
  loading,
  isMobile,
  hideTitle = false,
  categoryLabel = "Categoria", // Valor padrão
}) => {
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="value" className={cn(isMobile && "text-xs")}>Valor (R$)</Label>
          <Input
            id="value"
            type="number"
            step="0.01"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            disabled={loading}
            className={cn("rounded-xl", isMobile && "h-9 text-sm")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category" className={cn(isMobile && "text-xs")}>{categoryLabel}</Label> {/* Usando a nova prop */}
          <Select value={categoryId} onValueChange={setCategoryId} disabled={loading}>
            <SelectTrigger className={cn("rounded-xl", isMobile && "h-9 text-sm")}>
              <SelectValue placeholder="Selecione a categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a categoria</SelectItem>
              {filteredCategories.length === 0 ? (
                <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma categoria disponível</SelectItem>
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