import React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyBRProps {
  value: number | undefined | null;
  onChange: (val: number | undefined) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean; // Adicionado disabled para compatibilidade
  id?: string;
}

export default function CurrencyBR({
  value,
  onChange,
  className,
  placeholder = "R$ 0,00",
  disabled, // Adicionado disabled para compatibilidade
  id
}: CurrencyBRProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, ""); // mantém só números

    if (raw === "") {
      // Campo vazio → valor interno volta a undefined (sem valor informado)
      onChange(undefined);
      return;
    }

    const num = Number(raw) / 100;
    onChange(num);
  };

  // Quando value é undefined ou null → campo visualmente vazio (placeholder aparece)
  // Quando value é 0 (zero real) ou qualquer número → formata normalmente
  const formatted =
    value === undefined || value === null
      ? ""
      : value.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        });

  return (
    <Input
      id={id}
      value={formatted}
      onChange={handleChange}
      className={cn("rounded-xl", className)}
      inputMode="numeric"
      placeholder={placeholder}
      disabled={disabled} // Passando disabled para o Input
    />
  );
}
