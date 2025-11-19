import React from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppCategory } from "@/types/finance";
import { cn } from "@/lib/utils";

interface CategorySelectorProps {
  rootExpenseCategories: AppCategory[];
  filteredSubcategories: AppCategory[];
  selectedParentCategoryId: string;
  setSelectedParentCategoryId: (id: string) => void;
  selectedSubcategoryId: string;
  setSelectedSubcategoryId: (id: string) => void;
  validationErrors: Record<string, boolean>;
  setValidationErrors: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  isMobile: boolean;
  UNSELECTED_VALUE: string;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
  rootExpenseCategories,
  filteredSubcategories,
  selectedParentCategoryId,
  setSelectedParentCategoryId,
  selectedSubcategoryId,
  setSelectedSubcategoryId,
  validationErrors,
  setValidationErrors,
  isMobile,
  UNSELECTED_VALUE,
}) => {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div>
        <Label htmlFor="categoria" className={cn(isMobile && "text-xs")}>Categoria Principal</Label>
        <Select 
          value={selectedParentCategoryId} 
          onValueChange={(value) => {
            setSelectedParentCategoryId(value);
            setSelectedSubcategoryId(UNSELECTED_VALUE);
          }}
        >
          <SelectTrigger className={cn(isMobile && "h-9 text-sm")}>
            <SelectValue placeholder="Selecione a categoria principal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a categoria principal</SelectItem>
            {rootExpenseCategories.length === 0 ? (
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma categoria principal disponível</SelectItem>
            ) : (
              rootExpenseCategories
                .map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icone}</span>
                      <span>{cat.nome}</span>
                    </span>
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="subcategoria" className={cn(isMobile && "text-xs")}>Subcategoria</Label>
        <Select 
          value={selectedSubcategoryId} 
          onValueChange={(value) => {
            setSelectedSubcategoryId(value);
            setValidationErrors(prev => ({ ...prev, selectedSubcategoryId: false }));
          }}
          disabled={selectedParentCategoryId === UNSELECTED_VALUE || filteredSubcategories.length === 0}
        >
          <SelectTrigger className={cn(isMobile && "h-9 text-sm", validationErrors.selectedSubcategoryId && "border-destructive")}>
            <SelectValue placeholder="Selecione a subcategoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Selecione a subcategoria</SelectItem>
            {filteredSubcategories.length === 0 ? (
              <SelectItem value={UNSELECTED_VALUE} disabled className={cn(isMobile && "text-sm")}>Nenhuma subcategoria disponível</SelectItem>
            ) : (
              filteredSubcategories
                .map((cat) => (
                  <SelectItem key={cat.id} value={cat.id} className={cn(isMobile && "text-sm")}>
                    <span className="flex items-center gap-2">
                      <span>{cat.icone}</span>
                      <span>{cat.nome}</span>
                    </span>
                  </SelectItem>
                ))
            )}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};