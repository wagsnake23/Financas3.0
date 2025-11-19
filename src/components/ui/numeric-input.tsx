import * as React from "react";
import { NumericFormat, NumericFormatProps } from "react-number-format";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface NumericInputProps extends Omit<NumericFormatProps, 'customInput'> {
  className?: string;
  onValueChange?: (values: {
    floatValue: number | undefined;
    formattedValue: string;
    value: string;
  }) => void;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, onValueChange, ...props }, ref) => {
    return (
      <NumericFormat
        {...props}
        getInputRef={ref}
        onValueChange={onValueChange}
        thousandSeparator="."
        decimalSeparator=","
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false}
        customInput={Input}
        className={cn(className)}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";

export { NumericInput };