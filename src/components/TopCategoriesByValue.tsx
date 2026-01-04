import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";
import DynamicIcon from "./DynamicIcon";
import { getCategoryColor } from "@/lib/categoryColors";

interface TopCategoriesByValueProps {
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
  percentage: number;
}

export const TopCategoriesByValue = ({ expenses, categories }: TopCategoriesByValueProps) => {
  const allSubcategories: AppCategory[] = categories;

  const categoryUsage: Record<string, CategoryUsage> = {};
  let totalExpenses = 0;

  expenses
    .forEach(expense => {
      const category = allSubcategories.find(c => c.id === expense.categoria_id);
      const categoryId = expense.categoria_id || "outros_diversos";
      const categoryNome = category?.nome || "Outros";
      const categoryIcone = category?.icone || "MoreHorizontal";
      const categoryCor = category ? getCategoryColor(category, allSubcategories) : "hsl(215, 15%, 50%)";

      if (!categoryUsage[categoryId]) {
        categoryUsage[categoryId] = {
          id: categoryId,
          nome: categoryNome,
          icone: categoryIcone,
          cor: categoryCor,
          totalAmount: 0,
          transactionCount: 0,
          percentage: 0,
        };
      }

      categoryUsage[categoryId].totalAmount += expense.valor_total;
      categoryUsage[categoryId].transactionCount += 1;
      totalExpenses += expense.valor_total;
    });

  Object.values(categoryUsage).forEach(cat => {
    cat.percentage = totalExpenses > 0 ? (cat.totalAmount / totalExpenses) * 100 : 0;
  });

  const topCategories = Object.values(categoryUsage)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 5);

  return (
    <Card className="p-6 animate-fade-in rounded-xl shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Top 5 Subcategorias por Valor</h2>
      {topCategories.length === 0 ? (
        <div className="h-60 flex items-center justify-center text-muted-foreground">
          Nenhuma despesa registrada
        </div>
      ) : (
        <div className="space-y-4">
          {topCategories.map((category) => (
            <div key={category.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-lg"
                    style={{ backgroundColor: category.cor, opacity: 0.2 }}
                  >
                    <span style={{ opacity: 1 }}>
                      <DynamicIcon name={category.icone} className="h-5 w-5" />
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{category.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {category.transactionCount} transaç{category.transactionCount === 1 ? 'ão' : 'ões'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">R$ {category.totalAmount.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">{category.percentage.toFixed(1)}%</p>
                </div>
              </div>
              <Progress
                value={category.percentage}
                className="h-2"
                style={{
                  // @ts-ignore
                  '--progress-background': category.cor
                }}
              />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};