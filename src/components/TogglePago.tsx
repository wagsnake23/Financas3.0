import { useState } from "react";
import { supabase } from "@/integrations/supabase/client"; // Ajustado o caminho do import
import { Loader2 } from "lucide-react";
import { toast } from "sonner"; // Importar toast

interface TogglePagoProps {
  recurringId: string;         // ID da recorrência
  year: number;                // ano atual sendo exibido
  month: number;               // mês atual sendo exibido
  initialPaid: boolean;        // estado pago ou não
  onUpdated?: () => void;      // callback pra recarregar listagem
}

export function TogglePago({
  recurringId,
  year,
  month,
  initialPaid,
  onUpdated
}: TogglePagoProps) {
  const [loading, setLoading] = useState(false);
  const [paid, setPaid] = useState(initialPaid);

  const togglePaid = async () => {
    try {
      setLoading(true);

      const newStatus = !paid;

      const { error } = await supabase.rpc("rpc_edit_recurring_entry", {
        p_recurring_id: recurringId,
        p_year: year,
        p_month: month,
        p_modo: "este_mes",
        p_payload: {
          paid: newStatus,
          canceled: false
        }
      });

      if (error) {
        console.error("Erro no toggle:", error);
        toast.error("Erro ao atualizar status de pagamento", { description: error.message });
        return;
      }

      setPaid(newStatus);
      toast.success("Status de pagamento atualizado!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });

      // notificar tabela para recarregar
      if (onUpdated) onUpdated();

    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={togglePaid}
      disabled={loading}
      className={`px-3 py-1 rounded-lg text-white font-medium transition-all
        ${paid ? "bg-green-600" : "bg-red-500"} 
        ${loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
      `}
    >
      {loading ? (
        <Loader2 className="animate-spin" size={16}/>
      ) : paid ? "Pago" : "Pendente"}
    </button>
  );
}