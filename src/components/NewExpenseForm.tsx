import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Loader2 } from "lucide-react";
import { AppCategory, TransactionType } from "@/types/finance";
import { Textarea } from "@/components/ui/textarea";
import { Tables } from "@/integrations/supabase/types";
import { Label } from "@/components/ui/label"; // Importar Label

const formSchema = z.object({
  amount: z.string().refine((val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0, {
    message: "O valor deve ser um número positivo.",
  }),
  category: z.string().min(1, { message: "Selecione uma categoria." }),
  paymentType: z.enum(["credit_card", "debit_card", "bank_transfer", "cash", "pix", "boleto"]),
  paymentMethod: z.string().optional(), // ID do cartão ou banco
  date: z.date({
    required_error: "A data de vencimento é obrigatória.",
  }),
  description: z.string().optional(),
  isRecurrent: z.enum(["one_off", "monthly", "installments"]),
  installments: z.string().optional(),
  recurrentId: z.string().optional(),
});

interface NewExpenseFormProps {
  onSubmit: (data: z.infer<typeof formSchema>) => void;
  isLoading: boolean;
  categories: AppCategory[];
  cartoes: Tables<"cartoes">[];
  bancos: Tables<"bancos">[];
  onClose: () => void;
  initialData?: Partial<z.infer<typeof formSchema>>;
  isEdit?: boolean;
}

const NewExpenseForm: React.FC<NewExpenseFormProps> = ({
  onSubmit,
  isLoading,
  categories,
  cartoes,
  bancos,
  onClose,
  initialData,
  isEdit = false,
}) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: initialData?.amount?.toString() || "",
      category: initialData?.category || "",
      paymentType: initialData?.paymentType || "credit_card",
      paymentMethod: initialData?.paymentMethod || "",
      date: initialData?.date || new Date(),
      description: initialData?.description || "",
      isRecurrent: initialData?.isRecurrent || "one_off",
      installments: initialData?.installments || "",
      recurrentId: initialData?.recurrentId || undefined,
    },
  });

  const paymentType = form.watch("paymentType");
  const isRecurrent = form.watch("isRecurrent");

  const filteredCategories = categories.filter(
    (cat) => cat.type === TransactionType.Expense
  );

  const formatAmount = useCallback((value: string) => {
    // Remove tudo que não for número ou vírgula
    let cleanedValue = value.replace(/[^0-9,]/g, "");

    // Substitui vírgula por ponto para operações internas
    cleanedValue = cleanedValue.replace(",", ".");

    // Garante que há apenas um ponto decimal
    const parts = cleanedValue.split(".");
    if (parts.length > 2) {
      cleanedValue = parts[0] + "." + parts.slice(1).join("");
    }

    // Formata para moeda brasileira
    const numberValue = parseFloat(cleanedValue);
    if (isNaN(numberValue)) {
      return "";
    }

    return numberValue.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, []);

  useEffect(() => {
    const subscription = form.watch((value, { name, type }) => {
      if (name === "amount" && value.amount !== undefined) {
        const formatted = formatAmount(value.amount);
        if (value.amount !== formatted) {
          form.setValue("amount", formatted, { shouldValidate: true });
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [form, formatAmount]);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Subcategoria */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <Label className="text-sm font-medium text-gray-800 mb-1">
                Subcategoria
              </Label>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma subcategoria" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {filteredCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Valor */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <Label className="text-sm font-medium text-gray-800 mb-1">
                Valor (R$)
              </Label>
              <FormControl>
                <Input
                  placeholder="0,00"
                  {...field}
                  inputMode="numeric"
                  onChange={(e) => {
                    const rawValue = e.target.value;
                    // Permite apenas números e vírgula
                    const cleaned = rawValue.replace(/[^0-9,]/g, "");
                    field.onChange(cleaned);
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Tipo de Pagamento */}
        <FormField
          control={form.control}
          name="paymentType"
          render={({ field }) => (
            <FormItem className="space-y-2">
              <Label className="text-sm font-medium text-gray-800 mb-1">
                Tipo de Pagamento
              </Label>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-row space-x-4 radio-fix-click"
                >
                  <FormItem className="flex items-center space-x-1 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="credit_card" id="credit_card" />
                    </FormControl>
                    <FormLabel
                      htmlFor="credit_card"
                      className="font-normal text-sm"
                    >
                      Cartão de Crédito
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-1 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="debit_card" id="debit_card" />
                    </FormControl>
                    <FormLabel
                      htmlFor="debit_card"
                      className="font-normal text-sm"
                    >
                      Cartão de Débito
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-1 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                    </FormControl>
                    <FormLabel
                      htmlFor="bank_transfer"
                      className="font-normal text-sm"
                    >
                      Transferência/PIX
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-1 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="cash" id="cash" />
                    </FormControl>
                    <FormLabel htmlFor="cash" className="font-normal text-sm">
                      Dinheiro
                    </FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-1 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="boleto" id="boleto" />
                    </FormControl>
                    <FormLabel htmlFor="boleto" className="font-normal text-sm">
                      Boleto
                    </FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Forma de Pagamento (Cartão/Banco) */}
        {(paymentType === "credit_card" ||
          paymentType === "debit_card" ||
          paymentType === "bank_transfer") && (
          <FormField
            control={form.control}
            name="paymentMethod"
            render={({ field }) => (
              <FormItem>
                <Label className="text-sm font-medium text-gray-800 mb-1">
                  Forma de Pagamento
                </Label>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {paymentType === "credit_card" ||
                    paymentType === "debit_card"
                      ? cartoes.map((cartao) => (
                          <SelectItem key={cartao.id} value={cartao.id}>
                            {cartao.nome} ({cartao.final_cartao})
                          </SelectItem>
                        ))
                      : bancos.map((banco) => (
                          <SelectItem key={banco.id} value={banco.id}>
                            {banco.nome}
                          </SelectItem>
                        ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Data de Vencimento */}
        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <Label className="text-sm font-medium text-gray-800 mb-1">
                Data de Vencimento
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={"outline"}
                      className={cn(
                        "w-[240px] pl-3 text-left font-normal",
                        !field.value && "text-muted-foreground"
                      )}
                    >
                      {field.value ? (
                        format(field.value, "PPP", { locale: ptBR })
                      ) : (
                        <span>Selecione uma data</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={field.value}
                    onSelect={field.onChange}
                    disabled={(date) => date < new Date("1900-01-01")}
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Descrição */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <Label className="text-sm font-medium text-gray-800 mb-1">
                Descrição
              </Label>
              <FormControl>
                <Textarea
                  placeholder="Adicione uma descrição (opcional)"
                  className="resize-y"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Recorrência */}
        {!isEdit && (
          <FormField
            control={form.control}
            name="isRecurrent"
            render={({ field }) => (
              <FormItem className="space-y-2">
                <FormLabel className="text-sm font-medium text-gray-800 mb-1">
                  Recorrência
                </FormLabel>
                <FormControl>
                  <RadioGroup
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    className="flex flex-row space-x-4 radio-fix-click"
                  >
                    <FormItem className="flex items-center space-x-1 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="one_off" id="one_off" />
                      </FormControl>
                      <FormLabel
                        htmlFor="one_off"
                        className="font-normal text-sm"
                      >
                        Única
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-1 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="monthly" id="monthly" />
                      </FormControl>
                      <FormLabel
                        htmlFor="monthly"
                        className="font-normal text-sm"
                      >
                        Mensal
                      </FormLabel>
                    </FormItem>
                    <FormItem className="flex items-center space-x-1 space-y-0">
                      <FormControl>
                        <RadioGroupItem value="installments" id="installments" />
                      </FormControl>
                      <FormLabel
                        htmlFor="installments"
                        className="font-normal text-sm"
                      >
                        Parcelado
                      </FormLabel>
                    </FormItem>
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {isRecurrent === "installments" && !isEdit && (
          <FormField
            control={form.control}
            name="installments"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-medium text-gray-800 mb-1">
                  Número de Parcelas
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="Ex: 3"
                    type="number"
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === "" || /^[1-9]\d*$/.test(value)) {
                        field.onChange(value);
                      }
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end space-x-2 mt-6">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Salvar Despesa"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default NewExpenseForm;