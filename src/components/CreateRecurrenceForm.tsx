import React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { RecurringEntryFormContent } from "./RecurringEntryFormContent"; // Importar o novo componente
import { AppCategory } from "@/types/finance";
import { Enums } from "@/integrations/supabase/types";

interface CreateRecurrenceFormProps {
  isMobile: boolean;
  onSuccess?: () => void;
  fetchedCategories: AppCategory[];
  isLoadingCategories: boolean;
  initialType?: Enums<'recurring_type'>; // Adicionado para predefinir o tipo
}

export const CreateRecurrenceForm: React.FC<CreateRecurrenceFormProps> = ({ 
  isMobile, 
  onSuccess, 
  fetchedCategories, 
  isLoadingCategories,
  initialType
}) => {
  return (
    <Card className={cn("p-6 animate-fade-in rounded-xl shadow-sm", isMobile && "p-4")}>
      <h2 className={cn("text-2xl font-bold mb-6", isMobile && "text-xl mb-4")}>Novo Lançamento Recorrente</h2>
      <RecurringEntryFormContent
        isMobile={isMobile}
        onSuccess={onSuccess}
        fetchedCategories={fetchedCategories}
        isLoadingCategories={isLoadingCategories}
        initialType={initialType}
      />
    </Card>
  );
};