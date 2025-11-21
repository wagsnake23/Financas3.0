import * as React from "react";
import { NumericFormat, NumericFormatProps } from "react-number-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps
  extends Omit<NumericFormatProps, "customInput" | "onValueChange"> {
  className?: string;
  onValueChange?: (values: {
    floatValue: number;
    formattedValue: string;
    rawValue: string;
  }) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, onValueChange, value, ...props }, ref) => {
    return (
      <NumericFormat
        {...props}
        getInputRef={ref}
        value={value ?? ""}          // evita travar quando valor é undefined
        thousandSeparator="."
        decimalSeparator=","
        prefix="R$ "
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false}
        inputMode="numeric"          // <-- ADICIONADO
        valueIsNumericString         // <-- ADICIONADO
        customInput={Input}
        className={cn(className)}
        onValueChange={(values) => {
          const raw = values.value;          // "1234"
          const floatValue = Number(raw) / 100; // 12.34

          onValueChange?.({
            floatValue,
            formattedValue: values.formattedValue,
            rawValue: raw,
          });
        }}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };