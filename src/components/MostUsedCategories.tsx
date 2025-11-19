import { Card } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";

interface MostUsedCategoriesProps {
  expenses: Tables<'despesas'>[];
  categories: AppCategory[];
}

interface CategoryUsage {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  totalAmount: number;
  transactionCount: number;
}

export const MostUsedCategories = ({ expenses, categories }: MostUsedCategoriesProps) => {
  const allCategories: AppCategory[] = categories;

  const categoryUsage: Record<string, CategoryUsage> = {};

  expenses
    .filter(d => !d.is_fixed) // Filter out legacy fixed expenses
    .forEach(expense => {
      const category = allCategories.find(c => c.id === expense.categoria_id);
      const categoryId = expense.categoria_id || "outros_diversos";
      const categoryNome = category?.nome || "Outros";
      const categoryIcone = category?.icone || "MoreHorizontal";
      const categoryCor = category?.cor || "hsl(215, 15%, 50%)";

      if (!categoryUsage[categoryId]) {
        categoryUsage[categoryId] = {
          id: categoryId,
          nome: categoryNome,
          icone: categoryIcone,
          cor: categoryCor,
          totalAmount: 0,
          transactionCount: 0,
        };
      }

      categoryUsage[categoryId].totalAmount += expense.valor_total;
      categoryUsage[categoryId].transactionCount += 1;
    });

  const mostUsedCategories = Object.values(categoryUsage)
    .sort((a, b) => b.transactionCount - a.transactionCount)
    .slice(0, 5);

  return (
    <Card className="p-6 animate-fade-in rounded-xl shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Categorias Mais Utilizadas</h2>
      {mostUsedCategories.length === 0 ? (
        <div className="h-60 flex items-center justify-center text-muted-foreground">
          Nenhuma despesa registrada
        </div>
      ) : (
        <div className="space-y-4">
          {mostUsedCategories.map((category, index) => (
            <div key={category.id} className="flex items-center justify-between p-3 border border-border rounded-lg hover:border-primary/50 transition-all">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                  {index + 1}
                </div>
                <div 
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: category.cor, opacity: 0.2 }}
                >
                  <span style={{ opacity: 1 }}>
                    <DynamicIcon name={category.icone} className="h-6 w-6" />
                  </span>
                </div>
                <div>
                  <p className="font-medium">{category.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    R$ {category.totalAmount.toFixed(2)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">{category.transactionCount}</p>
                <p className="text-xs text-muted-foreground">transações</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};