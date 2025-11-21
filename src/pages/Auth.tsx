import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { z } from "zod";
import { useIsMobile } from "@/hooks/use-mobile"; // Importar o hook useIsMobile
import DynamicIcon from "@/components/DynamicIcon"; // Importar DynamicIcon
import { cn, getBorderClass } from "@/lib/utils"; // Importar getBorderClass

// Validation schemas
const emailSchema = z.string().trim().email("Email inválido").max(255, "Email muito longo");
const passwordSchema = z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(128, "Senha muito longa");
const nameSchema = z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo");

type ViewMode = "login" | "signup" | "forgot-password" | "reset-password";

export default function Auth() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isMobile = useIsMobile(); // Usar o hook para detectar se é mobile

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nome, setNome] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({}); // NOVO ESTADO

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    // Validate input
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      newErrors.email = true;
      hasError = true;
      toast.error(emailValidation.error.errors[0].message);
    } else {
      newErrors.email = false;
    }

    if (!password) { // Simple check for password presence
      newErrors.password = true;
      hasError = true;
      toast.error("Senha é obrigatória");
    } else {
      newErrors.password = false;
    }

    setValidationErrors(newErrors);
    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailValidation.data,
      password,
    });

    if (error) {
      toast.error("Erro ao fazer login", {
        description: error.message === "Invalid login credentials" 
          ? "Email ou senha inválidos" 
          : error.message,
      });
    } else if (data.user) {
      toast.success("Login realizado com sucesso!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
      navigate("/");
    }

    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    // Validate inputs
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      newErrors.email = true;
      hasError = true;
      toast.error(emailValidation.error.errors[0].message);
    } else {
      newErrors.email = false;
    }

    const nameValidation = nameSchema.safeParse(nome);
    if (!nameValidation.success) {
      newErrors.nome = true;
      hasError = true;
      toast.error(nameValidation.error.errors[0].message);
    } else {
      newErrors.nome = false;
    }

    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      newErrors.password = true;
      hasError = true;
      toast.error(passwordValidation.error.errors[0].message);
    } else {
      newErrors.password = false;
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = true;
      hasError = true;
      toast.error("As senhas não coincidem");
    } else {
      newErrors.confirmPassword = false;
    }

    setValidationErrors(newErrors);
    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: emailValidation.data,
      password: passwordValidation.data,
      options: {
        data: {
          nome: nameValidation.data,
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });

    if (error) {
      toast.error("Erro ao criar conta", {
        description: error.message,
      });
    } else if (data.user) {
      // All new users default to 'conferente' role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: data.user.id, role: "conferente" });

      if (roleError) {
        toast.error("Conta criada, mas houve erro ao definir permissões");
      } else {
        toast.success("Conta criada com sucesso!", {
          style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
        });
        navigate("/");
      }
    }

    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    // Validate email
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      newErrors.email = true;
      hasError = true;
      toast.error(emailValidation.error.errors[0].message);
    } else {
      newErrors.email = false;
    }

    setValidationErrors(newErrors);
    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(emailValidation.data, {
      redirectTo: `${window.location.origin}/auth?mode=reset-password`,
    });

    if (error) {
      toast.error("Erro ao enviar email", {
        description: error.message,
      });
    } else {
      toast.success("Se o email existir, o link foi enviado.", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
      setViewMode("login");
    }

    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    // Validate password
    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      newErrors.password = true;
      hasError = true;
      toast.error(passwordValidation.error.errors[0].message);
    } else {
      newErrors.password = false;
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = true;
      hasError = true;
      toast.error("As senhas não coincidem");
    } else {
      newErrors.confirmPassword = false;
    }

    setValidationErrors(newErrors);
    if (hasError) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: passwordValidation.data,
    });

    if (error) {
      toast.error("Erro ao redefinir senha", {
        description: error.message,
      });
    } else {
      toast.success("Senha redefinida com sucesso!", {
        style: { backgroundColor: 'hsl(var(--soft-green))', color: 'hsl(var(--success-darker))' }
      });
      navigate("/");
    }

    setLoading(false);
  };

  const formContent = (
    <>
      <div className="mb-6 text-center">
        <img src="/favicon.ico" alt="Controle Financeiro Logo" className="mx-auto h-20 w-20" />
        <h1 className="text-3xl font-bold text-app-title">
          Minhas Finanças
        </h1>
        <p className="text-sm text-muted-foreground">
          {viewMode === "login" && "Acesse sua conta para continuar"}
          {viewMode === "signup" && "Preencha os dados para criar sua conta"}
          {viewMode === "forgot-password" && "Digite seu email para recuperar o acesso"}
          {viewMode === "reset-password" && "Digite sua nova senha"}
        </p>
      </div>

      {viewMode === "login" && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <Label htmlFor="email">Email ou Usuário</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setValidationErrors(prev => ({ ...prev, email: false }));
              }}
              required
              disabled={loading}
              placeholder="seu@email.com"
              className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.email, isValid: validationErrors.email === false }))}
            />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setValidationErrors(prev => ({ ...prev, password: false }));
                }}
                required
                disabled={loading}
                placeholder="Digite a senha..."
                className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.password, isValid: validationErrors.password === false }))}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <DynamicIcon name="EyeOff" className="h-[18px] w-[18px]" /> : <DynamicIcon name="Eye" className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full rounded-xl" size="lg" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <div className="text-right text-sm mt-1">
            <button
              type="button"
              onClick={() => {
                setViewMode("forgot-password");
                setValidationErrors({}); // Clear errors on view change
              }}
              className="text-destructive underline hover:text-destructive"
            >
              Esqueci minha senha
            </button>
          </div>
          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setViewMode("signup");
                setValidationErrors({}); // Clear errors on view change
              }}
              className="text-primary hover:underline block w-full"
            >
              Criar conta
            </button>
          </div>
        </form>
      )}

      {viewMode === "signup" && (
        <form onSubmit={handleSignup} className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              type="text"
              value={nome}
              onChange={(e) => {
                setNome(e.target.value);
                setValidationErrors(prev => ({ ...prev, nome: false }));
              }}
              required
              disabled={loading}
              placeholder="Seu nome completo"
              maxLength={100}
              className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.nome, isValid: validationErrors.nome === false }))}
            />
          </div>
          <div>
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setValidationErrors(prev => ({ ...prev, email: false }));
              }}
              required
              disabled={loading}
              placeholder="seu@email.com"
              className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.email, isValid: validationErrors.email === false }))}
            />
          </div>
          <div>
            <Label htmlFor="signup-password">Senha</Label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setValidationErrors(prev => ({ ...prev, password: false }));
                }}
                required
                disabled={loading}
                placeholder="Digite a senha..."
                className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.password, isValid: validationErrors.password === false }))}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <DynamicIcon name="EyeOff" className="h-[18px] w-[18px]" /> : <DynamicIcon name="Eye" className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirm-password">Confirmar Senha</Label>
            <div className="relative">
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setValidationErrors(prev => ({ ...prev, confirmPassword: false }));
                }}
                required
                disabled={loading}
                placeholder="Digite a senha novamente..."
                className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.confirmPassword, isValid: validationErrors.confirmPassword === false }))}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <DynamicIcon name="EyeOff" className="h-[18px] w-[18px]" /> : <DynamicIcon name="Eye" className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full rounded-xl" size="lg" disabled={loading}>
            {loading ? "Criando conta..." : "Cadastrar"}
          </Button>
          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setViewMode("login");
                setValidationErrors({}); // Clear errors on view change
              }}
              className="text-primary hover:underline"
            >
              Já tenho conta
            </button>
          </div>
        </form>
      )}

      {viewMode === "forgot-password" && (
        <form onSubmit={handleForgotPassword} className="space-y-4">
          <div>
            <Label htmlFor="forgot-email">Email</Label>
            <Input
              id="forgot-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setValidationErrors(prev => ({ ...prev, email: false }));
              }}
              required
              disabled={loading}
              placeholder="seu@email.com"
              className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.email, isValid: validationErrors.email === false }))}
            />
          </div>
          <Button type="submit" className="w-full rounded-xl" size="lg" disabled={loading}>
            {loading ? "Enviando..." : "Enviar link de recuperação"}
          </Button>
          <div className="text-center text-sm">
            <button
              type="button"
              onClick={() => {
                setViewMode("login");
                setValidationErrors({}); // Clear errors on view change
              }}
              className="text-primary hover:underline"
            >
              Voltar para login
            </button>
          </div>
        </form>
      )}

      {viewMode === "reset-password" && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <Label htmlFor="new-password">Nova Senha</Label>
            <div className="relative">
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setValidationErrors(prev => ({ ...prev, password: false }));
                }}
                required
                disabled={loading}
                placeholder="Digite a senha..."
                className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.password, isValid: validationErrors.password === false }))}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <DynamicIcon name="EyeOff" className="h-[18px] w-[18px]" /> : <DynamicIcon name="Eye" className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="new-confirm-password">Confirmar Nova Senha</Label>
            <div className="relative">
              <Input
                id="new-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setValidationErrors(prev => ({ ...prev, confirmPassword: false }));
                }}
                required
                disabled={loading}
                placeholder="Digite a senha novamente..."
                className={cn("rounded-xl", getBorderClass({ isInvalid: validationErrors.confirmPassword, isValid: validationErrors.confirmPassword === false }))}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <DynamicIcon name="EyeOff" className="h-[18px] w-[18px]" /> : <DynamicIcon name="Eye" className="h-[18px] w-[18px]" />}
              </button>
            </div>
          </div>
          <Button type="submit" className="w-full rounded-xl" size="lg" disabled={loading}>
            {loading ? "Redefinindo..." : "Redefinir senha"}
          </Button>
        </form>
      )}
    </>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-secondary/20 p-4">
      {isMobile ? (
        <div className="w-full max-w-md p-6">
          {formContent}
        </div>
      ) : (
        <Card className="w-full max-w-md p-8 shadow-xl rounded-xl">
          {formContent}
        </Card>
      )}
    </div>
  );
}