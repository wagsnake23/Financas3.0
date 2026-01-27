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
        "card-yellow border-2 border-white shadow-md",
        isMobile ? "dialog-mobile pb-2 w-[99vw] max-w-[99vw] !rounded-[32px]" : "sm:max-w-[425px] sm:max-h-[90vh] overflow-y-auto !rounded-[32px]"
      )} style={{ backgroundColor: "#FEF9C3", backdropFilter: "none" }}>
        <DialogHeader
          className={cn(
            "flex flex-row items-center justify-center gap-2",
            isMobile && "absolute top-3.5 left-4 right-12 text-left"
          )}
        >
          <span className="text-2xl select-none mr-2">🗂️</span>
          <DialogTitle className={cn("font-black pb-[1px] text-[#374151] text-lg")}>
            Editar Subcategoria
          </DialogTitle>
        </DialogHeader>
        <div className={cn(isMobile && "form-body pb-2")}>
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