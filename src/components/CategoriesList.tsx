import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AppCategory } from "@/types/finance";
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
}

const getPaymentMethodLabel = (value?: string | null) => {
  if (!value || value === "none") return null;
  const method = PAYMENT_METHODS.find(m => m.value === value);
  return method?.label || value;
};

const CategoryItem = ({ category, onDeleteCategory, onEditCategory, level = 0 }: CategoryItemProps) => {
  const paymentLabel = getPaymentMethodLabel(category.forma_pagamento);
  const hasSubcategories = category.subCategories && category.subCategories.length > 0;
  const [isExpanded, setIsExpanded] = useState(false);
  const isDefault = category.user_id === null; // Determine if it's a default category

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
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-6 w-6 text-muted-foreground"
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}

          <div 
            className="p-2 rounded-lg flex items-center justify-center text-2xl"
            style={{ backgroundColor: category.cor }}
          >
            <span>{category.icone}</span>
          </div>
          <div className="flex-1">
            <p className="font-semibold">{category.nome}</p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {/* Removido: {isDefault && <span>Categoria padrão</span>} */}
              {paymentLabel && (
                <>
                  {/* Removido: {isDefault && <span>•</span>} */}
                  <span>{paymentLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          {!isDefault && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEditCategory(category)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          
          {!isDefault && (
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
      {isExpanded && hasSubcategories && (
        <div className="space-y-2 mt-2">
          {category.subCategories?.map(subCat => (
            <CategoryItem
              key={subCat.id}
              category={subCat}
              onDeleteCategory={onDeleteCategory}
              onEditCategory={onEditCategory}
              level={level + 1}
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
}

const CategoriesList = ({ 
  categories, 
  onDeleteCategory, 
  onEditCategory,
  maxHeight = "600px"
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
    if (!searchTerm.trim()) return categories;
    
    const term = searchTerm.toLowerCase();
    const filteredFlat = flatCategories.filter(cat => 
      cat.nome.toLowerCase().includes(term)
    );

    const filteredMap = new Map<string, HierarchicalCategory>();
    filteredFlat.forEach(cat => filteredMap.set(cat.id, { ...cat, subCategories: [] }));

    const rootFiltered: HierarchicalCategory[] = [];
    filteredFlat.forEach(cat => {
      if (cat.parent_id && filteredMap.has(cat.parent_id)) {
        const parent = filteredMap.get(cat.parent_id);
        if (parent) {
          parent.subCategories?.push(filteredMap.get(cat.id)!);
        }
      } else if (!cat.parent_id) {
        rootFiltered.push(filteredMap.get(cat.id)!);
      }
    });

    const finalFilteredHierarchy: HierarchicalCategory[] = [];
    rootFiltered.forEach(root => {
      const processNode = (node: HierarchicalCategory): HierarchicalCategory | null => {
        const newNode: HierarchicalCategory = { ...node, subCategories: [] };
        if (node.subCategories) {
          node.subCategories.forEach(sub => {
            if (filteredMap.has(sub.id)) {
              const processedSub = processNode(sub);
              if (processedSub) {
                newNode.subCategories?.push(processedSub);
              }
            }
          });
        }
        return newNode;
      };
      const processedRoot = processNode(root);
      if (processedRoot) {
        finalFilteredHierarchy.push(processedRoot);
      }
    });

    return finalFilteredHierarchy;
  }, [categories, searchTerm, flatCategories]);

  return (
    <Card className="p-6 flex flex-col rounded-xl shadow-sm" style={{ height: maxHeight }}>
      <div className="flex-shrink-0 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-2xl font-bold">Categorias Cadastradas</h2>
          
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 w-full"
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
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </Card>
  );
};

export default CategoriesList;