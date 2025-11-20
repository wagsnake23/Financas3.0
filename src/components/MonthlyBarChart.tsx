import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Transaction } from "@/types/finance";
import { cn, createSafeDate } from "@/lib/utils"; // Importar cn e createSafeDate

interface MonthlyBarChartProps {
  transactions: Transaction[];
  isMobile?: boolean; // Adicionar prop isMobile
}

export const MonthlyBarChart = ({ transactions, isMobile }: MonthlyBarChartProps) => {
  const monthlyData = transactions.reduce((acc, transaction) => {
    // Filter out legacy fixed transactions, as they are now handled by recurring_entries
    if (transaction.is_fixed && !transaction.isRecurring) return acc;

    const safeDate = createSafeDate(transaction.date); // Usar createSafeDate
    if (!safeDate) return acc; // Pular transações com datas inválidas
    
    const monthYear = safeDate.toLocaleDateString("pt-BR", { month: "short", year: "numeric" });
    
    if (!acc[monthYear]) {
      acc[monthYear] = { month: monthYear, income: 0, expenses: 0 };
    }
    
    if (transaction.type === "income") {
      acc[monthYear].income += transaction.amount;
    } else {
      acc[monthYear].expenses += transaction.amount;
    }
    
    return acc;
  }, {} as Record<string, { month: string; income: number; expenses: number }>);

  const chartData = Object.values(monthlyData).sort((a, b) => {
    // Para ordenar, precisamos de objetos Date válidos.
    // createSafeDate retorna undefined para datas inválidas, então precisamos lidar com isso.
    const [monthA, yearA] = a.month.split(" ");
    const [monthB, yearB] = b.month.split(" ");
    const dateA = createSafeDate(`1 ${monthA} ${yearA}`); // Criar data segura para comparação
    const dateB = createSafeDate(`1 ${monthB} ${yearB}`); // Criar data segura para comparação

    if (!dateA || !dateB) return 0; // Se alguma data for inválida, não altera a ordem

    return dateA.getTime() - dateB.getTime();
  });

  if (chartData.length === 0) {
    return (
      <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm", isMobile && "p-4")}> {/* Ajustar padding */}
        <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Receitas vs Despesas Mensais</h2>
        <div className={cn("h-80 flex items-center justify-center text-muted-foreground", isMobile && "h-48")}> {/* Ajustar altura */}
          Nenhum dado disponível
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-6 animate-slide-up rounded-xl shadow-sm", isMobile && "p-4")}> {/* Ajustar padding */}
      <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Receitas vs Despesas Mensais</h2>
      <ResponsiveContainer width="100%" height={isMobile ? 200 : 320}> {/* Altura condicional */}
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="month" 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: isMobile ? "10px" : "12px" }} // Tamanho da fonte condicional
          />
          <YAxis 
            stroke="hsl(var(--muted-foreground))"
            style={{ fontSize: isMobile ? "10px" : "12px" }} // Tamanho da fonte condicional
          />
          <Tooltip 
            formatter={(value: number) => `R$ ${value.toFixed(2)}`}
            contentStyle={{ 
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
            }}
          />
          <Legend wrapperStyle={{ fontSize: isMobile ? "10px" : "12px" }} /> {/* Tamanho da fonte da legenda condicional */}
          <Bar dataKey="income" fill="hsl(var(--success))" name="Receitas" radius={[8, 8, 0, 0]} />
          <Bar dataKey="expenses" fill="hsl(var(--destructive))" name="Despesas" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
};