import { Card } from "@/components/ui/card";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { Transaction } from "@/types/finance";
import { AppCategory } from "@/types/finance";
import { cn, formatCurrency } from "@/lib/utils";

interface ExpensesPieChartProps {
  transactions: Transaction[];
  allCategories: AppCategory[];
  isMobile?: boolean;
}

export const ExpensesPieChart = ({
  transactions,
  allCategories,
  isMobile,
}: ExpensesPieChartProps) => {
  // --- DEBUG: info básica
  console.log("🔥 ExpensesPieChart mounted");
  console.log("🔥 transactions.length:", transactions?.length);
  console.log("🔥 allCategories.length:", allCategories?.length);

  // --- Mapa por id para lookup rápido (evita buscas O(n) dentro do loop)
  const categoriesById: Record<string, AppCategory> = {};
  for (const c of allCategories || []) {
    if (c && (c as any).id) categoriesById[(c as any).id] = c;
  }

  // Função auxiliar: resolve parent id suportando parent_id (snake) e parentId (camel)
  const getParentId = (cat: any): string | null | undefined => {
    if (!cat) return undefined;
    if (cat.parent_id !== undefined) return cat.parent_id;
    if (cat.parentId !== undefined) return cat.parentId;
    return undefined;
  };

  // Função auxiliar robusta para encontrar a categoria principal
  const getMainCategory = (
    subcategoryId?: string | null
  ): AppCategory | null => {
    if (!subcategoryId) return null;

    let current = categoriesById[subcategoryId];
    if (!current) return null;

    // subir até o topo usando parent_id ou parentId
    while (current) {
      const parentId = getParentId(current as any);
      if (parentId == null) break; // chegou no topo
      const parent = categoriesById[parentId];
      if (!parent) {
        // pai declarado, mas não existe no mapa — interrompe aqui (retorna última identificada)
        break;
      }
      current = parent;
    }
    return current || null;
  };

  // --- Diagnostics: coletar ids das transações e checar resoluções
  const allCategoryIdsFromTx = new Set<string>();
  const unresolvedIds = new Set<string>();
  const resolvedSamples: Array<{
    txId?: string;
    originalId?: string;
    resolvedId?: string;
    resolvedNome?: string;
  }> = [];

  // Construir agrupamento
  const expensesByCategory = transactions
    .filter((t) => t.type === "expense")
    .reduce((acc, transaction) => {
      // CORREÇÃO: pegar a categoria correta do objeto Transaction
      const categoryId =
        transaction.category ||
        (transaction as any).categoria_id ||
        (transaction as any).category_id ||
        (transaction as any).categoryId ||
        "outros";

      const mainCategory = getMainCategory(categoryId);

      const name = mainCategory?.nome ?? "Outros";
      const color = mainCategory?.cor ?? "hsl(215, 15%, 50%)";

      if (!acc[name]) {
        acc[name] = { value: 0, color };
      }

      acc[name].value += Math.abs(transaction.amount || 0);
      return acc;
    }, {} as Record<string, { value: number; color: string }>);

  // --- Prints de diagnóstico (resumo curto)
  console.log(
    "🔥 unique categoryIds from transactions (sample up to 20):",
    Array.from(allCategoryIdsFromTx).slice(0, 20)
  );
  console.log(
    "🔥 unresolved categoryIds (sample up to 20):",
    Array.from(unresolvedIds).slice(0, 20)
  );
  console.log("🔥 resolvedSamples (up to 10):", resolvedSamples);

  const chartData = Object.entries(expensesByCategory).map(([name, data]) => ({
    name,
    value: data.value,
    color: data.color,
  }));

  if (chartData.length === 0) {
    return (
      <Card
        className={cn(
          "p-6 animate-slide-up rounded-xl shadow-sm",
          isMobile && "p-4"
        )}
      >
        <h2
          className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}
        >
          Despesas por Categoria
        </h2>
        <div
          className={cn(
            "h-80 flex items-center justify-center text-muted-foreground",
            isMobile && "h-48"
          )}
        >
          Nenhuma despesa registrada
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "p-6 animate-slide-up rounded-xl shadow-sm",
        isMobile && "p-4"
      )}
    >
      <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>
        Despesas por Categoria
      </h2>
      <ResponsiveContainer width="100%" height={isMobile ? 200 : 320}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) =>
              `${name}: ${(percent * 100).toFixed(0)}%`
            }
            outerRadius={isMobile ? 60 : 100}
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatCurrency(value)}
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
};
