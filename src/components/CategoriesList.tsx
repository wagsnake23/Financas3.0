import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import {
  Search,
  Pencil,
  Trash2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { PAYMENT_METHODS } from "@/data/colorPalette";
import { cn } from "@/lib/utils";
import { getCategoryColor } from "@/lib/categoryColors";
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

// Helper interface for hierarchical categories
interface HierarchicalCategory extends AppCategory {
  subCategories?: HierarchicalCategory[];
}

interface CategoryItemProps {
  category: HierarchicalCategory;
  onDeleteCategory: (id: string) => void;
  onEditCategory: (category: AppCategory) => void;
  level?: number;
  initialExpanded?: boolean; // Control initial expansion state
  allFlatCategories: AppCategory[]; // NEW: Pass all flat categories to find parent color
  categoryNumber?: string; // NEW: Prop for category number
  isMobile: boolean; // Add isMobile prop
}

const getPaymentMethodLabel = (value?: string | null) => {
  if (!value || value === "none") return null;
  const method = PAYMENT_METHODS.find((m) => m.value === value);
  return method?.label || value;
};

const CategoryItem = ({
  category,
  onDeleteCategory,
  onEditCategory,
  level = 0,
  initialExpanded = false,
  allFlatCategories,
  categoryNumber,
  isMobile,
}: CategoryItemProps) => {
  const paymentLabel = getPaymentMethodLabel(category.forma_pagamento);
  const hasSubcategories =
    category.subCategories && category.subCategories.length > 0;
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const isDefault = category.user_id === null;

  // Determine the effective color based on level and parent
  const effectiveColor = useMemo(() => {
    return getCategoryColor(category, allFlatCategories);
  }, [category, allFlatCategories]);

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between p-3 border rounded-xl hover:border-primary/50 transition-all !bg-white w-full"
        )}
        style={{
          borderColor: effectiveColor,
          borderWidth: level === 0 ? "1px" : "0.5px",
        }} // Apply effectiveColor to border
      >
        <div className="flex items-center flex-1 min-w-0 gap-2">
          {categoryNumber && (
            <span className="font-bold text-[12px] text-muted-foreground min-w-[28px] text-left ml-1">
              {categoryNumber}
            </span>
          )}

          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center relative transition-all duration-300 flex-shrink-0"
            style={{ 
                background: `linear-gradient(135deg, ${effectiveColor} 0%, ${effectiveColor}dd 100%)`,
                boxShadow: `inset 0 1px 0 rgba(255,255,255,0.3), 0 3px 0 ${effectiveColor}aa, 0 4px 8px rgba(0,0,0,0.15)`,
                border: `1px solid ${effectiveColor}33`
            }}
          >
            <DynamicIcon name={category.icone} className="h-5 w-5 text-white drop-shadow-sm" />
          </div>
          <div className="flex-1 min-w-0 py-1 ml-0.5">
            <p className="font-semibold line-clamp-2 break-words leading-tight">{category.nome}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {paymentLabel && <span>{paymentLabel}</span>}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          {!isDefault && category.parent_id !== null && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditCategory(category)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}

          {!isDefault && category.parent_id !== null && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent 
                className={cn(
                  isMobile ? "dialog-mobile w-[99%] max-w-[99%] !rounded-[22px] !px-4 !pb-6" : "sm:max-w-[425px] !rounded-[22px] !pb-6",
                  "!border border-slate-200 shadow-none"
                )}
                style={{
                  background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
                  backgroundBlendMode: "soft-light",
                  backdropFilter: "blur(6px)",
                  outline: "1px solid rgba(220, 38, 38, 0.08)",
                  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.03), inset 0 0 18px rgba(220, 38, 38, 0.12)"
                }}
              >
                <AlertDialogHeader className="pt-2">
                  <AlertDialogTitle className="flex items-center justify-center gap-2 text-center text-xl font-bold text-slate-800">
                    <Trash2 className="h-6 w-6 text-red-500" />
                    Confirmar Exclusão
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-center text-slate-600 font-medium pt-2">
                    Tem certeza que deseja excluir a subcategoria{" "}
                    <span className="font-bold text-foreground">"{category.nome}"</span>?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className={cn(
                  "flex flex-row gap-2 mt-4",
                  isMobile && "items-center justify-between"
                )}>
                  <AlertDialogCancel className={cn(
                    "flex-1 rounded-[14px] btn-3d font-black !text-slate-700 border border-slate-300 transition-all active:scale-95 text-lg h-11 mt-0",
                    isMobile && "h-11"
                  )}
                  style={{ 
                    "--cor-topo": "#E2E8F0", 
                    "--cor-base": "#CBD5E1",
                    boxShadow: "inset 0px 1px 1px rgba(255, 255, 255, 0.4), inset 0px -1px 0px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0,0,0,0.05)"
                  } as any}
                  >Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => onDeleteCategory(category.id)}
                    className={cn(
                      "flex-1 rounded-[14px] btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                      isMobile && "h-11"
                    )}
                    style={{ "--cor-topo": "#FF6B6B", "--cor-base": "#E54D4D" } as any}
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          {hasSubcategories && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded((prev) => !prev)}
              className={cn(
                "h-8 w-8 text-muted-foreground hover:bg-muted/50 hover:text-primary transition-all",
                isExpanded && "text-primary rotate-180"
              )}
            >
              <ChevronDown className="h-5 w-5" strokeWidth={4} />
            </Button>
          )}
        </div>
      </div>
      {isExpanded && hasSubcategories && (
        <div className="space-y-2 mt-2">
          {category.subCategories?.map((subCat, index) => (
            <CategoryItem
              key={subCat.id}
              category={subCat}
              onDeleteCategory={onDeleteCategory}
              onEditCategory={onEditCategory}
              level={level + 1}
              initialExpanded={initialExpanded}
              allFlatCategories={allFlatCategories} // Pass down to sub-subcategories
              categoryNumber={`${categoryNumber}.${index + 1}`} // Pass sub-number
              isMobile={isMobile}
            />
          ))}
        </div>
      )}
    </>
  );
};

interface CategoriesListProps {
  categories: HierarchicalCategory[];
  onDeleteCategory: (id: string) => void;
  onEditCategory: (category: AppCategory) => void;
  maxHeight?: string;
  isMobile: boolean;
  allFlatCategories: AppCategory[]; // NEW: Receive all flat categories
  hideCardWrapper?: boolean;
  hideTitle?: boolean;
}

const CategoriesList = ({
  categories,
  onDeleteCategory,
  onEditCategory,
  maxHeight,
  isMobile,
  allFlatCategories, // Use the new prop
  hideCardWrapper = false,
  hideTitle = false,
}: CategoriesListProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const effectiveMaxHeight = maxHeight || (isMobile ? "925px" : "600px");

  const flatCategories = useMemo(() => {
    const flatten = (cats: HierarchicalCategory[], acc: AppCategory[] = []) => {
      cats.forEach((cat) => {
        acc.push(cat);
        if (cat.subCategories) {
          flatten(cat.subCategories, acc);
        }
      });
      return acc;
    };
    return flatten(categories);
  }, [categories]);

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) {
      return categories.filter((cat) => cat.parent_id === null);
    }

    const term = searchTerm.toLowerCase();
    const categoriesToInclude = new Set<string>();

    flatCategories.forEach((cat) => {
      if (cat.nome.toLowerCase().includes(term)) {
        let currentCat: AppCategory | undefined = cat;
        while (currentCat && !categoriesToInclude.has(currentCat.id)) {
          categoriesToInclude.add(currentCat.id);
          currentCat = flatCategories.find(
            (c) => c.id === currentCat?.parent_id
          );
        }
      }
    });

    const includedFlatCategories = flatCategories.filter((cat) =>
      categoriesToInclude.has(cat.id)
    );

    const buildFilteredHierarchy = (
      flat: AppCategory[]
    ): HierarchicalCategory[] => {
      const map = new Map<string, HierarchicalCategory>();
      const roots: HierarchicalCategory[] = [];

      flat.forEach((cat) => {
        map.set(cat.id, { ...cat, subCategories: [] });
      });

      flat.forEach((cat) => {
        if (cat.parent_id && map.has(cat.parent_id)) {
          const parent = map.get(cat.parent_id);
          if (parent) {
            parent.subCategories?.push(map.get(cat.id)!);
          }
        } else {
          roots.push(map.get(cat.id)!);
        }
      });

      const sortNodes = (nodes: HierarchicalCategory[]) => {
        nodes.sort((a, b) => (a.nome || "").localeCompare(b.nome || ""));
        nodes.forEach((node) => {
          if (node.subCategories && node.subCategories.length > 0) {
            sortNodes(node.subCategories);
          }
        });
      };
      sortNodes(roots);
      return roots;
    };

    return buildFilteredHierarchy(includedFlatCategories);
  }, [searchTerm, flatCategories, categories]);

  const Container = hideCardWrapper ? "div" : Card;

  return (
    <Container
      className={cn(
        "flex flex-col",
        !hideCardWrapper && "p-4 rounded-xl shadow-sm",
        hideCardWrapper && (isMobile ? "px-4 pb-6 pt-5" : "px-4 pb-6 pt-2")
      )}
    >
      <div className={cn("flex-shrink-0", isMobile ? "mb-2" : "mb-4")}>
        <div className={cn("flex flex-col sm:flex-row sm:items-center gap-4", isMobile ? "mb-2" : "mb-4", !hideTitle ? "sm:justify-between" : "sm:justify-start")}>
          {!hideTitle && (
            <h2 className={cn("text-2xl font-bold", isMobile && "text-xl")}>
              🗃️ Categorias Cadastradas
            </h2>
          )}

          <div className="relative flex-1 px-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 w-full rounded-xl"
            />
          </div>
        </div>
      </div>

      <div className="flex-1">
        {filteredCategories.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {searchTerm
              ? "Nenhuma categoria encontrada."
              : "Nenhuma categoria cadastrada ainda."}
          </p>
        ) : (
          <div className="space-y-2 px-1">
            {filteredCategories.map((category, index) => (
              <CategoryItem
                key={category.id}
                category={category}
                onDeleteCategory={onDeleteCategory}
                onEditCategory={onEditCategory}
                initialExpanded={!!searchTerm.trim()}
                allFlatCategories={allFlatCategories} // Pass allFlatCategories here
                categoryNumber={`${index + 1}`} // Pass initial number for root categories
                isMobile={isMobile}
              />
            ))}
          </div>
        )}
      </div>
    </Container>
  );
};

export default CategoriesList;
