import React from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyBRProps {
  value: number | undefined;
  onChange: (val: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean; // Adicionado disabled para compatibilidade
}

export default function CurrencyBR({
  value,
  onChange,
  className,
  placeholder = "R$ 0,00",
  disabled // Adicionado disabled para compatibilidade
}: CurrencyBRProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, ""); // mantém só números

    if (raw === "") {
      onChange(0);
      return;
    }

    const num = Number(raw) / 100;
    onChange(num);
  };

  // Formata em BRL
  const formatted = (value ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  return (
    <Input
      value={formatted}
      onChange={handleChange}
      className={cn("rounded-xl", className)}
      inputMode="numeric"
      placeholder={placeholder}
      disabled={disabled} // Passando disabled para o Input
    />
  );
}