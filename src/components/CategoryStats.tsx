import React, { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import DynamicIcon from "./DynamicIcon";
import { AppCategory, Transaction } from "@/types/finance";
import { cn } from "@/lib/utils";

interface CategoryStatsProps {
  transactions: Transaction[];
  allCategories: AppCategory[];
  isMobile?: boolean;
}

interface CategorySummary {
  id: string;
  nome: string;
  icone: string;
  cor: string;
  totalAmount: number;
  percentage: number;
}

export const CategoryStats: React.FC<CategoryStatsProps> = ({
  transactions,
  allCategories,
  isMobile,
}) => {
  const categorySummaries = useMemo(() => {
    const expenseTransactions = transactions.filter(t => t.type === "expense" && (!t.is_fixed || t.isRecurring));
    const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);

    const categoryAmounts: Record<string, number> = {};

    expenseTransactions.forEach(transaction => {
      const categoryId = transaction.category || "outros_diversos";
      categoryAmounts[categoryId] = (categoryAmounts[categoryId] || 0) + transaction.amount;
    });

    const summaries: CategorySummary[] = Object.entries(categoryAmounts).map(([categoryId, amount]) => {
      const category = allCategories.find(cat => cat.id === categoryId);
      return {
        id: categoryId,
        nome: category?.nome || "Outros",
        icone: category?.icone || "MoreHorizontal",
        cor: category?.cor || "hsl(215, 15%, 50%)", // Default gray
        totalAmount: amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0,
      };
    });

    return summaries.sort((a, b) => b.totalAmount - a.totalAmount).slice(0, 5); // Top 5 categories
  }, [transactions, allCategories]);

  if (categorySummaries.length === 0) {
    return (
      <Card className={cn("p-6 animate-fade-in rounded-xl shadow-sm", isMobile && "p-4")}>
        <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Top Subcategorias de Despesas</h2>
        <div className={cn("h-40 flex items-center justify-center text-muted-foreground", isMobile && "h-32 text-sm")}>
          Nenhuma despesa registrada para este período.
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-6 animate-fade-in rounded-xl shadow-sm", isMobile && "p-4")}>
      <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Top Subcategorias de Despesas</h2>
      <div className="space-y-4">
        {categorySummaries.map((category) => (
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
                  <p className={cn("font-medium text-sm", isMobile && "text-xs")}>{category.nome}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={cn("font-semibold", isMobile && "text-sm")}>R$ {category.totalAmount.toFixed(2)}</p>
                <p className={cn("text-xs text-muted-foreground", isMobile && "text-[0.6rem]")}>{category.percentage.toFixed(1)}%</p>
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
    </Card>
  );
};