import React from "react";
import CurrencyInputField from "react-currency-input-field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value: number | undefined;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
}

export const CurrencyInput = ({
  value,
  onChange,
  className,
  placeholder = "R$ 0,00",
  disabled
}: Props) => {
  return (
    <CurrencyInputField
      customInput={Input}
      intlConfig={{ locale: "pt-BR", currency: "BRL" }}
      decimalsLimit={2}
      decimalScale={2}
      disableGroupSeparators={false}
      allowNegativeValue={false}
      value={value !== undefined ? value.toFixed(2) : ""}
      onValueChange={(val) => onChange(Number(val) || 0)}
      inputMode="numeric"
      placeholder={placeholder}
      disabled={disabled}
      className={cn("rounded-xl", className)}
    />
  );
};