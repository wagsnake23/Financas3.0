import { Card } from "@/components/ui/card";
import { Tables } from "@/integrations/supabase/types";
import { AppCategory } from "@/types/finance";

interface CategoryDistributionSummaryProps {
  expenses: Tables<'despesas'>[];
  categories: AppCategory[];
}

interface CategoryUsage {
  id: string;
  nome: string;
  totalAmount: number;
  transactionCount: number;
}

export const CategoryDistributionSummary = ({ expenses, categories }: CategoryDistributionSummaryProps) => {
  const allSubcategories: AppCategory[] = categories;

  const categoryUsage: Record<string, CategoryUsage> = {};
  let totalExpenses = 0;

  expenses
    .forEach(expense => {
      const category = allSubcategories.find(c => c.id === expense.categoria_id);
      const categoryId = expense.categoria_id || "outros_diversos";
      const categoryNome = category?.nome || "Outros";

      if (!categoryUsage[categoryId]) {
        categoryUsage[categoryId] = {
          id: categoryId,
          nome: categoryNome,
          totalAmount: 0,
          transactionCount: 0,
        };
      }

      categoryUsage[categoryId].totalAmount += expense.valor_total;
      categoryUsage[categoryId].transactionCount += 1;
      totalExpenses += expense.valor_total;
    });

  const topCategories = Object.values(categoryUsage)
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 1);

  return (
    <Card className="p-6 animate-fade-in rounded-xl shadow-sm">
      <h2 className="text-xl font-semibold mb-4">Resumo da Distribuição</h2>
      {Object.keys(categoryUsage).length === 0 ? (
        <div className="h-32 flex items-center justify-center text-muted-foreground">
          Nenhuma despesa registrada
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 border border-border rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Total de Subcategorias</p>
            <p className="text-2xl font-bold">{Object.keys(categoryUsage).length}</p>
          </div>
          <div className="p-4 border border-border rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Total de Transações</p>
            <p className="text-2xl font-bold">{expenses.length}</p>
          </div>
          <div className="p-4 border border-border rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Média por Subcategoria</p>
            <p className="text-2xl font-bold">
              R$ {Object.keys(categoryUsage).length > 0 
                ? (totalExpenses / Object.keys(categoryUsage).length).toFixed(2)
                : '0.00'}
            </p>
          </div>
          <div className="p-4 border border-border rounded-lg">
            <p className="text-sm text-muted-foreground mb-1">Subcategoria Líder</p>
            <div className="flex items-center gap-2">
              {topCategories[0] && (
                <>
                  <p className="text-sm font-semibold truncate">{topCategories[0].nome}</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};
