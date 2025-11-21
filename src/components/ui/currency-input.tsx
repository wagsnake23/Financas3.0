import * as React from "react";
import { NumericFormat, NumericFormatProps } from "react-number-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<NumericFormatProps, 'customInput'> {
  className?: string;
  onValueChange?: (values: {
    floatValue: number | undefined;
    formattedValue: string;
    value: string;
  }) => void;
}

const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ className, onValueChange, ...props }, ref) => {
    return (
      <NumericFormat
        {...props}
        getInputRef={ref}
        thousandSeparator="."
        decimalSeparator=","
        prefix="R$ "
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false}
        customInput={Input}
        className={cn(className)}
        valueIsNumericString
        onValueChange={(values) => {
          const raw = values.value; // string sem formatação
          const float = raw ? Number(raw) / 100 : 0; // converte centavos em reais

          onValueChange?.({
            floatValue: float,
            formattedValue: values.formattedValue,
            value: values.value
          });
        }}
        isAllowed={(values) => {
          // evita "0000000000000000..."
          if (values.value.length > 12) return false;
          return true;
        }}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";

export { CurrencyInput };