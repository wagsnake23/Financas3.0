import { useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/contexts/ToastContext";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { User as SupabaseUser } from "@supabase/supabase-js";
import { User as UserIcon } from "lucide-react";

const profileSchema = z.object({
  nome: z.string().min(2, "O nome deve ter no mínimo 2 caracteres"),
  apelido: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

interface ProfileFormProps {
  profile: any;
  user: SupabaseUser;
}

export function ProfileAccountForm({ profile, user }: ProfileFormProps) {
  const queryClient = useQueryClient();
  const { showSuccessToast, showErrorToast } = useToast();
  const [isUpdating, setIsUpdating] = useState(false);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      nome: profile?.nome || "",
      apelido: profile?.apelido || "",
    },
  });

  const onSubmit = async (values: ProfileFormValues) => {
    try {
      setIsUpdating(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          nome: values.nome,
          apelido: values.apelido || null,
        })
        .eq("id", user.id);

      if (error) throw error;

      // Update auth user metadata so the layout uses the updated name if needed
      await supabase.auth.updateUser({
        data: { nome: values.nome }
      });

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      showSuccessToast("Perfil atualizado com sucesso!");
    } catch (error: any) {
      console.error(error);
      showErrorToast("Erro ao atualizar o perfil.");
    } finally {
      setIsUpdating(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Indisponível";
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(dateString));
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-2xl bg-[#EEF5FF] flex items-center justify-center shadow-sm border border-blue-100/50">
          <UserIcon className="w-5 h-5 text-[#3B5B96]" />
        </div>
        <h2 className="text-xl font-extrabold text-[#1E3A8B] tracking-tight">
          Informações Pessoais
        </h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-slate-700">Nome Completo</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Seu nome completo" 
                      className="h-12 rounded-[16px] bg-[#F8FAFC] border-slate-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus-visible:ring-[#3B5B96]" 
                      {...field} 
                    />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="apelido"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="font-semibold text-slate-700">Apelido <span className="text-slate-400 font-normal">(Opcional)</span></FormLabel>
                <FormControl>
                  <Input 
                    placeholder="Como prefere ser chamado" 
                    className="h-12 rounded-[16px] bg-[#F8FAFC] border-slate-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] focus-visible:ring-[#3B5B96]" 
                    {...field} 
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormItem>
            <FormLabel className="font-semibold text-slate-700">Email Principal</FormLabel>
            <FormControl>
              <Input 
                value={user.email} 
                readOnly 
                className="h-12 rounded-[16px] bg-slate-100/50 border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] text-slate-500 cursor-not-allowed font-medium" 
              />
            </FormControl>
          </FormItem>

          <FormItem>
            <FormLabel className="font-semibold text-slate-700">Membro desde</FormLabel>
            <FormControl>
              <Input 
                value={formatDate(user.created_at)} 
                readOnly 
                className="h-12 rounded-[16px] bg-slate-100/50 border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] text-slate-500 cursor-not-allowed font-medium" 
              />
            </FormControl>
          </FormItem>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormItem>
            <FormLabel className="font-semibold text-slate-700">Último Acesso</FormLabel>
            <FormControl>
              <Input 
                value={formatDate(user.last_sign_in_at)} 
                readOnly 
                className="h-12 rounded-[16px] bg-slate-100/50 border-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.02)] text-slate-500 cursor-not-allowed font-medium" 
              />
            </FormControl>
          </FormItem>
        </div>

        <div className="pt-8 border-t border-slate-100 mt-10">
          <Button 
            type="submit" 
            disabled={isUpdating}
            className="w-full md:w-auto h-12 px-8 rounded-[16px] font-bold bg-gradient-to-b from-[#4A72BA] to-[#3B5B96] hover:opacity-90 text-white shadow-[0_4px_14px_rgba(59,91,150,0.3)] hover:-translate-y-[1px] transition-all"
          >
            {isUpdating ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </form>
    </Form>
    </div>
  );
}
