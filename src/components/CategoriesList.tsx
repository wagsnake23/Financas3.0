import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { Search, Pencil, Trash2, ChevronRight, ChevronDown } from "lucide-react";
import { PAYMENT_METHODS } from "@/data/colorPalette";
import { cn } from "@/lib/utils";

// Helper interface for hierarchical categories
interface HierarchicalCategory extends AppCategory {
  subCategories?: HierarchicalCategory[];
}

interface CategoryItemProps {
  category: HierarchicalCategory;
  onDeleteCategory: (id: string) => void;
  onEditCategory: (category: AppCategory) => void;
  level?: number;
  initialExpanded?: boolean; // NEW PROP: Control initial expansion state
}

const getPaymentMethodLabel = (value?: string | null) => {
  if (!value || value === "none") return null;
  const method = PAYMENT_METHODS.find(m => m.value === value);
  return method?.label || value;
};

const CategoryItem = ({ category, onDeleteCategory, onEditCategory, level = 0, initialExpanded = false }: CategoryItemProps) => {
  const paymentLabel = getPaymentMethodLabel(category.forma_pagamento);
  const hasSubcategories = category.subCategories && category.subCategories.length > 0;
  const [isExpanded, setIsExpanded] = useState(initialExpanded); // Initialize with prop
  const isDefault = category.user_id === null;

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 transition-all",
          level > 0 && "bg-muted/30"
        )}
        style={{ borderColor: category.cor, borderWidth: level === 0 ? '1px' : '0.5px' }}
      >
        <div className="flex items-center gap-2 flex-1">
          {level > 0 && <div style={{ width: `${level * 1.5}rem` }} />} 

          {hasSubcategories && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(prev => !prev)} // Toggle internal state
              className={cn(
                "h-6 w-6 text-muted-foreground hover:bg-muted/50 hover:text-primary",
                isExpanded && "text-primary" // Highlight when expanded
              )}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}

          <div 
            className="p-2 rounded-lg flex items-center justify-center text-2xl"
            style={{ backgroundColor: category.cor }}
          >
            <DynamicIcon name={category.icone} className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold">{category.nome}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {paymentLabel && (
                <span>{paymentLabel}</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {!isDefault && category.parent_id !== null && ( // Apenas subcategorias não padrão podem ser editadas/excluídas
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditCategory(category)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          
          {!isDefault && category.parent_id !== null && ( // Apenas subcategorias não padrão podem ser editadas/excluídas
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDeleteCategory(category.id)}
              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      {isExpanded && hasSubcategories && ( // Use internal isExpanded state
        <div className="space-y-2 mt-2">
          {category.subCategories?.map(subCat => (
            <CategoryItem
              key={subCat.id}
              category={subCat}
              onDeleteCategory={onDeleteCategory}
              onEditCategory={onEditCategory}
              level={level + 1}
              initialExpanded={initialExpanded} // Pass initialExpanded to subcategories
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
}

const CategoriesList = ({ 
  categories, 
  onDeleteCategory, 
  onEditCategory,
  maxHeight = "600px",
  isMobile
}: CategoriesListProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const flatCategories = useMemo(() => {
    const flatten = (cats: HierarchicalCategory[], acc: AppCategory[] = []) => {
      cats.forEach(cat => {
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
      // Se o campo de busca estiver vazio, retorna apenas as categorias principais
      return categories.filter(cat => cat.parent_id === null);
    }

    const term = searchTerm.toLowerCase();
    const categoriesToInclude = new Set<string>();

    // First pass: identify all categories that match the search term directly
    // and add them and their ancestors to the set of categories to include.
    flatCategories.forEach(cat => {
      if (cat.nome.toLowerCase().includes(term)) {
        let currentCat: AppCategory | undefined = cat;
        while (currentCat && !categoriesToInclude.has(currentCat.id)) {
          categoriesToInclude.add(currentCat.id);
          currentCat = flatCategories.find(c => c.id === currentCat?.parent_id);
        }
      }
    });

    // Second pass: filter the original flat list to only include those in our set
    const includedFlatCategories = flatCategories.filter(cat => categoriesToInclude.has(cat.id));

    // Third pass: rebuild the hierarchy from the included flat list
    const buildFilteredHierarchy = (flat: AppCategory[]): HierarchicalCategory[] => {
      const map = new Map<string, HierarchicalCategory>();
      const roots: HierarchicalCategory[] = [];

      flat.forEach(cat => {
        map.set(cat.id, { ...cat, subCategories: [] });
      });

      flat.forEach(cat => {
        if (cat.parent_id && map.has(cat.parent_id)) {
          const parent = map.get(cat.parent_id);
          if (parent) {
            parent.subCategories?.push(map.get(cat.id)!);
          }
        } else {
          roots.push(map.get(cat.id)!);
        }
      });

      // Sort categories within their levels
      const sortNodes = (nodes: HierarchicalCategory[]) => {
        nodes.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        nodes.forEach(node => {
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

  return (
    <Card className="p-6 flex flex-col rounded-xl shadow-sm" style={{ height: maxHeight }}>
      <div className="flex-shrink-0 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className={cn("text-2xl font-bold", isMobile && "text-xl")}>Categorias Cadastradas</h2>
          
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full rounded-xl"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 -mr-4 pr-4">
        {filteredCategories.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            {searchTerm ? "Nenhuma categoria encontrada." : "Nenhuma categoria cadastrada ainda."}
          </p>
        ) : (
          <div className="space-y-2">
            {filteredCategories.map((category) => (
              <CategoryItem
                key={category.id}
                category={category}
                onDeleteCategory={onDeleteCategory}
                onEditCategory={onEditCategory}
                // If there's a search term, start expanded. Otherwise, start collapsed.
                initialExpanded={!!searchTerm.trim()}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};

export default CategoriesList;