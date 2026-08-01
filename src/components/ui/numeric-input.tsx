"use client";

import * as React from "react";
import { NumericFormat, NumericFormatProps } from "react-number-format";

import { cn } from "@/lib/utils";

export interface NumericInputProps
  extends Omit<NumericFormatProps, "onValueChange"> {
  onValueChange?: (values: {
    floatValue?: number;
    formattedValue: string;
    value: string;
  }) => void;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ className, onValueChange, ...props }, ref) => {
    return (
      <NumericFormat
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:outline-none focus-visible:border-success disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        getInputRef={ref}
        thousandSeparator="."
        decimalSeparator=","
        decimalScale={2}
        fixedDecimalScale
        allowNegative={false}
        onValueChange={onValueChange}
        {...props}
      />
    );
  }
);

NumericInput.displayName = "NumericInput";

export { NumericInput };