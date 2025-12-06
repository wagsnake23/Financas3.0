'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Check, ChevronsUpDown } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from './ui/command';
import { useState } from 'react';

const FormSchema = z.object({
  type: z.enum(['receita', 'despesa'], {
    required_error: 'Você precisa selecionar um tipo de transação.',
  }),
  category: z.string({
    required_error: 'Por favor, selecione uma categoria.',
  }),
  subcategory: z.string({
    required_error: 'Por favor, selecione uma subcategoria.',
  }),
  description: z
    .string()
    .min(2, {
      message: 'A descrição deve ter pelo menos 2 caracteres.',
    })
    .max(160, {
      message: 'A descrição não pode ter mais de 160 caracteres.',
    }),
  amount: z.string({
    required_error: 'Por favor, insira um valor.',
  }),
  date: z.date({
    required_error: 'Uma data de transação é necessária.',
  }),
  status: z.enum(['pendente', 'pago'], {
    required_error: 'Você precisa selecionar um status.',
  }),
});

interface TransactionEditFormProps {
  initialData: z.infer<typeof FormSchema>;
  categories: {
    name: string;
    subcategories: { name: string; value: string }[];
  }[];
  onSave: (data: z.infer<typeof FormSchema>) => void;
  onCancel: () => void;
}

export function TransactionEditForm({
  initialData,
  categories,
  onSave,
  onCancel,
}: TransactionEditFormProps) {
  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      ...initialData,
      amount: initialData.amount.toString(), // Ensure amount is string for input
    },
  });

  const selectedCategory = form.watch('category');
  const availableSubcategories =
    categories.find((cat) => cat.name === selectedCategory)?.subcategories ||
    [];

  function onSubmit(data: z.infer<typeof FormSchema>) {
    onSave(data);
    toast({
      title: 'Você enviou os seguintes valores:',
      description: (
        <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4">
          <code className="text-white">{JSON.stringify(data, null, 2)}</code>
        </pre>
      ),
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Tipo de Transação</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1 radio-fix-click"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="receita" />
                    </FormControl>
                    <FormLabel className="font-normal">Receita</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="despesa" />
                    </FormControl>
                    <FormLabel className="font-normal">Despesa</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Categoria</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.name} value={category.name}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="subcategory"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Subcategoria</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant="outline"
                      role="combobox"
                      className={cn(
                        'w-full justify-between',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value
                        ? availableSubcategories.find(
                            (subcategory) => subcategory.value === field.value
                          )?.name
                        : 'Selecione a subcategoria'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </FormControl>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                  <Command>
                    <CommandInput placeholder="Pesquisar subcategoria..." />
                    <CommandEmpty>Nenhuma subcategoria encontrada.</CommandEmpty>
                    <CommandGroup>
                      {availableSubcategories.map((subcategory) => (
                        <CommandItem
                          value={subcategory.name}
                          key={subcategory.value}
                          onSelect={() => {
                            form.setValue('subcategory', subcategory.value);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              subcategory.value === field.value
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          {subcategory.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descrição</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Adicione uma descrição para a transação"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Valor</FormLabel>
              <FormControl>
                <Input type="number" step="0.01" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Data da Transação</FormLabel>
              <Popover>
                <PopoverTrigger asChild>
                  <FormControl>
                    <Button
                      variant={'outline'}
                      className={cn(
                        'w-full pl-3 text-left font-normal',
                        !field.value && 'text-muted-foreground'
                      )}
                    >
                      {field.value ? (
                        format(field.value, 'PPP', { locale: ptBR })
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
                    disabled={(date) =>
                      date > new Date() || date < new Date('1900-01-01')
                    }
                    initialFocus
                    locale={ptBR}
                  />
                </PopoverContent>
              </Popover>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem className="space-y-3">
              <FormLabel>Status</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1 radio-fix-click"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="pendente" />
                    </FormControl>
                    <FormLabel className="font-normal">Pendente</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="pago" />
                    </FormControl>
                    <FormLabel className="font-normal">Pago</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit">Salvar Alterações</Button>
        </div>
      </form>
    </Form>
  );
}