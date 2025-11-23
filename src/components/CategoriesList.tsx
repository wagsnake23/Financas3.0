import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon"; // Importar DynamicIcon
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
            <DynamicIcon name={category.icone} className="h-6 w-6" /> {/* Usar DynamicIcon */}
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
  isMobile: boolean; // Adicionado a prop isMobile
}

const CategoriesList = ({ 
  categories, 
  onDeleteCategory, 
  onEditCategory,
  maxHeight = "600px",
  isMobile // Receber a prop isMobile
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

    // Reconstruir a hierarquia para as categorias filtradas
    const filteredMap = new Map<string, HierarchicalCategory>();
    filteredFlat.forEach(cat => filteredMap.set(cat.id, { ...cat, subCategories: [] }));

    const rootFiltered: HierarchicalCategory[] = [];
    filteredFlat.forEach(cat => {
      if (cat.parent_id && filteredMap.has(cat.parent_id)) {
        const parent = filteredMap.get(cat.parent_id);
        if (parent) {
          // Adicionar subcategoria ao pai, se o pai também estiver filtrado
          if (!parent.subCategories?.some(sub => sub.id === cat.id)) {
            parent.subCategories?.push(filteredMap.get(cat.id)!);
          }
        }
      } else if (!cat.parent_id) {
        // Adicionar categoria raiz se ela estiver filtrada
        if (!rootFiltered.some(root => root.id === cat.id)) {
          rootFiltered.push(filteredMap.get(cat.id)!);
        }
      }
    });

    // Garantir que as subcategorias sejam adicionadas aos pais corretos
    rootFiltered.forEach(root => {
      const processNode = (node: HierarchicalCategory): HierarchicalCategory => {
        const newNode: HierarchicalCategory = { ...node, subCategories: [] };
        if (node.subCategories) {
          node.subCategories.forEach(sub => {
            if (filteredMap.has(sub.id)) {
              const processedSub = processNode(sub);
              newNode.subCategories?.push(processedSub);
            }
          });
        }
        return newNode;
      };
      // Limpar e re-adicionar subcategorias para evitar duplicação e garantir ordem
      root.subCategories = root.subCategories?.filter(sub => filteredMap.has(sub.id)).map(processNode) || [];
    });

    // Filtrar categorias raiz que não têm subcategorias correspondentes no filtro
    // e que não são elas mesmas o resultado de uma busca
    const finalFilteredHierarchy = rootFiltered.filter(root => 
      root.subCategories?.length > 0 || filteredMap.has(root.id)
    );

    return finalFilteredHierarchy;
  }, [categories, searchTerm, flatCategories]);

  return (
    <Card className="p-6 flex flex-col rounded-xl shadow-sm" style={{ height: maxHeight }}>
      <div className="flex-shrink-0 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className={cn("text-2xl font-bold", isMobile && "text-xl")}>Categorias Cadastradas</h2> {/* Ajuste aqui */}
          
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