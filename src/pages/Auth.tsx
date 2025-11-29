import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils"; // Importar cn

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let authResponse;
      if (isSignUp) {
        authResponse = await supabase.auth.signUp({ email, password });
      } else {
        authResponse = await supabase.auth.signInWithPassword({ email, password });
      }

      const { error, data } = authResponse;

      if (error) {
        throw error;
      }

      if (data.user) {
        toast({
          title: "Sucesso!",
          description: isSignUp ? "Cadastro realizado com sucesso. Verifique seu e-mail para confirmar." : "Login realizado com sucesso.",
          variant: "default",
        });
        if (!isSignUp) {
          navigate("/dashboard");
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro na autenticação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <Card className="w-full max-w-md rounded-xl shadow-lg">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary">Minhas Finanças</CardTitle>
          <CardDescription className="text-muted-foreground">
            {isSignUp ? "Crie sua conta para começar a organizar suas finanças." : "Entre na sua conta para continuar."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-6">
            <div>
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 rounded-lg"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1 rounded-lg"
              />
            </div>
            <Button type="submit" className={cn("w-full", "btn-entrar")} disabled={loading}>
              {loading ? "Carregando..." : (isSignUp ? "Cadastrar" : "Entrar")}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            {isSignUp ? "Já tem uma conta?" : "Não tem uma conta?"}{" "}
            <Button variant="link" onClick={() => setIsSignUp(!isSignUp)} className="p-0 h-auto text-primary">
              {isSignUp ? "Entrar" : "Cadastre-se"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}