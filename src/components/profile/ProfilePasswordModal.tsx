import { useState } from "react";

import { z } from "zod";
import { useForm as useReactHookForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/contexts/ToastContext";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

const passwordSchema = z.object({
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordSchema>;

export function ProfilePasswordModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const isMobile = useIsMobile();
  const { showSuccessToast, showErrorToast } = useToast();

  const form = useReactHookForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (values: PasswordFormValues) => {
    try {
      setIsUpdating(true);
      const { error } = await supabase.auth.updateUser({
        password: values.password
      });

      if (error) throw error;

      showSuccessToast("Senha alterada com sucesso!");
      setIsOpen(false);
      form.reset();
    } catch (error: any) {
      console.error(error);
      showErrorToast("Erro", error.message || "Erro ao alterar a senha");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) form.reset();
    }}>
      <DialogTrigger asChild>
        <Button className="w-full rounded-[16px] bg-gradient-to-b from-[#FB923C] to-[#F97316] hover:opacity-90 text-white font-bold text-[17px] shadow-[0_4px_14px_rgba(249,115,22,0.3)] h-12 transition-all hover:translate-y-[-1px]">
          <Lock className="w-4 h-4 mr-2 text-white/90" />
          Alterar Senha
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[425px] rounded-3xl p-6">
        <DialogHeader className="mb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-[#EEF5FF] rounded-2xl flex items-center justify-center shadow-sm border border-blue-100/50">
              <Lock className="w-5 h-5 text-[#1E3A8A]" />
            </div>
            <DialogTitle className="text-2xl font-extrabold text-[#1E3A8B] tracking-tight">Alterar Senha</DialogTitle>
          </div>
          <DialogDescription className="text-slate-500 font-medium text-left">
            Digite sua nova senha abaixo. Ela deve ter pelo menos 6 caracteres.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-slate-700">Nova Senha</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="" 
                        className="h-12 rounded-[16px] bg-[#F8FAFC] border border-slate-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus-visible:ring-[#3B5B96] pr-10" 
                        {...field} 
                      />
                    </FormControl>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="font-semibold text-slate-700">Confirmar Senha</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input 
                        type={showConfirmPassword ? "text" : "password"} 
                        placeholder="" 
                        className="h-12 rounded-[16px] bg-[#F8FAFC] border border-slate-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.04)] focus-visible:ring-[#3B5B96] pr-10" 
                        {...field} 
                      />
                    </FormControl>
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className={cn("flex flex-row gap-4 w-full", isMobile ? "mt-2" : "mt-8")}>
              <Button 
                type="button" 
                onClick={() => setIsOpen(false)} 
                className={cn(
                  "flex-1 rounded-xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg",
                  isMobile && "h-11 text-lg"
                )}
                style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}
                size="lg"
              >
                Cancelar
              </Button>
              <Button 
                type="submit" 
                disabled={isUpdating} 
                className={cn(
                  "flex-1 rounded-xl btn-3d font-black !text-[#374151] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg",
                  isMobile && "h-11 text-lg"
                )}
                style={{ "--cor-topo": "#FFD54F", "--cor-base": "#FFC107" } as any}
                size="lg"
              >
                {isUpdating ? "Alterando..." : "Alterar"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
