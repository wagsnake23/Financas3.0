import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CategoryForm } from "@/components/CategoryForm";
import { AppCategory } from "@/types/finance";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface EditCategoryModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  editingCategory: AppCategory | null;
  onUpdateCategory: (id: string, category: Omit<AppCategory, "id" | "user_id" | "created_at">) => void;
  onCancelEdit: () => void;
  allCategories: AppCategory[];
}

export const EditCategoryModal: React.FC<EditCategoryModalProps> = ({
  isOpen,
  onOpenChange,
  editingCategory,
  onUpdateCategory,
  onCancelEdit,
  allCategories,
}) => {
  const isMobile = useIsMobile();

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        isMobile ? "dialog-mobile pb-6" : "sm:max-w-[425px] sm:max-h-[90vh] overflow-y-auto"
      )}>
        <DialogHeader
          className={cn(
            "flex flex-row items-center justify-center gap-2",
            isMobile && "absolute top-3.5 left-4 right-12 text-left"
          )}
        >
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#DBEAFE] flex items-center justify-center">
            <span className="text-sm select-none" style={{ color: '#1E40AF' }}>✏️</span>
          </div>
          <DialogTitle className={cn("font-bold pb-[1px]", isMobile ? "text-lg" : "text-xl")}>
            Editar Subcategoria
          </DialogTitle>
        </DialogHeader>
        <div className={cn(isMobile && "form-body pb-10")}>
          {editingCategory && (
            <CategoryForm
              onAddCategory={() => { }} // Não usado no modo de edição
              onUpdateCategory={onUpdateCategory}
              editingCategory={editingCategory}
              onCancelEdit={onCancelEdit}
              allCategories={allCategories}
              hideCardWrapper={true} // Passando a nova prop aqui
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};