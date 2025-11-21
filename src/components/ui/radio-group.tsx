"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
// REMOVIDO: import { Circle } from "lucide-react";

import { cn } from "@/lib/utils";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-input text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        // ADICIONADO: Estilos para o pseudo-elemento ::after criar a bolinha sólida
        "relative after:content-[''] after:absolute after:inset-[4px] after:rounded-full after:scale-0 after:opacity-0 after:transition-all after:duration-100 after:ease-in-out",
        "data-[state=checked]:after:scale-100 data-[state=checked]:after:opacity-100", // Escala e opacidade base para o ::after
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator
        className="flex items-center justify-center"
      >
        {/* REMOVIDO: <Circle className="h-2.5 w-2.5 fill-current text-current" /> */}
        {children}
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem };