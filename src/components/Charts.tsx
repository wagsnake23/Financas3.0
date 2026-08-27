import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const Charts = () => {
  return (
    <Card className="p-6 animate-slide-up rounded-xl shadow-sm">
      <h2 className="text-2xl font-bold mb-6">Gráficos e Relatórios</h2>
      <div className={cn("flex items-center justify-center text-muted-foreground", "h-auto min-h-[260px]")}>
        Conteúdo dos gráficos virá aqui.
      </div>
    </Card>
  );
};

export default Charts;
