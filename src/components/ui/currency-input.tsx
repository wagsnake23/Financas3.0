"use client";

import * as React from "react";
import CurrencyInput from "react-currency-input-field";

import { cn } from "@/lib/utils";

export interface CurrencyInputFieldProps
  extends React.ComponentPropsWithoutRef<typeof CurrencyInput> {}

const CurrencyInputField = React.forwardRef<
  HTMLInputElement,
  CurrencyInputFieldProps
>(({ className, ...props }, ref) => {
  return (
    <CurrencyInput
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:ring-0 focus-visible:outline-none focus-visible:border-success disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      groupSeparator="."
      decimalSeparator=","
      decimalsLimit={2}
      allowNegativeValue={false}
      {...props}
    />
  );
});

CurrencyInputField.displayName = "CurrencyInputField";

export { CurrencyInputField };