import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/contexts/ToastContext";
import { z } from "zod";
import { useIsMobile } from "@/hooks/use-mobile";
import DynamicIcon from "@/components/DynamicIcon";
import { UserCheck } from "lucide-react";
import { cn, getBorderClass } from "@/lib/utils";
import { Footer } from "@/components/Footer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Validation schemas
const emailSchema = z.string().trim().email("Email inválido").max(255, "Email muito longo");
const passwordSchema = z.string().min(8, "Senha deve ter no mínimo 8 caracteres").max(128, "Senha muito longa");
const nameSchema = z.string().trim().min(1, "Nome é obrigatório").max(100, "Nome muito longo");

type ViewMode = "login" | "signup" | "forgot-password" | "reset-password";

export default function Auth() {
  const { showSuccessToast, showErrorToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("login");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isMobile = useIsMobile();

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [nome, setNome] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, boolean>>({});
  const [showDuplicateEmailModal, setShowDuplicateEmailModal] = useState(false);

  // Effect to handle URL parameters (e.g., ?mode=reset-password)
  useEffect(() => {
    const mode = searchParams.get("mode") as ViewMode;
    if (mode && ["login", "signup", "forgot-password", "reset-password"].includes(mode)) {
      setViewMode(mode);
    }
  }, [searchParams]);

  // Remover splash screen quando Auth monta (acesso direto a /auth)
  useEffect(() => {
    const splash = document.getElementById("splash-screen");
    if (splash) {
      splash.style.opacity = "0";
      splash.style.pointerEvents = "none";
      setTimeout(() => splash.remove(), 400);
    }
  }, []);

  // Effect to re-validate confirm password when password changes
  useEffect(() => {
    if (confirmPassword !== "") {
      setValidationErrors(prev => ({ ...prev, confirmPassword: confirmPassword !== password }));
    }
  }, [password, confirmPassword]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, boolean> = {};
    let hasError = false;

    // Validate input
    const emailValidation = emailSchema.safeParse(email);
    if (!emailValidation.success) {
      newErrors.email = true;
      hasError = true;
      showErrorToast("Erro de Validação", emailValidation.error.errors[0].message);
    } else {
      newErrors.email = false;
    }

    if (!password) {
      newErrors.password = true;
      hasError = true;
      showErrorToast("Campo Obrigatório", "Senha é obrigatória");
    } else {
      newErrors.password = false;
    }

    setValidationErrors(newErrors);
    if (hasError) {
      showErrorToast("Campos Obrigatórios", "Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailValidation.data,
      password,
    });

    if (error) {
      showErrorToast("Erro ao fazer login", error.message === "Invalid login credentials"
        ? "Email ou senha inválidos"
        : error.message);
    } else if (data.user) {
      showSuccessToast("Sucesso", "Login realizado com sucesso!");
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
      showErrorToast("Erro de Validação", emailValidation.error.errors[0].message);
    } else {
      newErrors.email = false;
    }

    const nameValidation = nameSchema.safeParse(nome);
    if (!nameValidation.success) {
      newErrors.nome = true;
      hasError = true;
      showErrorToast("Erro de Validação", nameValidation.error.errors[0].message);
    } else {
      newErrors.nome = false;
    }

    const passwordValidation = passwordSchema.safeParse(password);
    if (!passwordValidation.success) {
      newErrors.password = true;
      hasError = true;
      showErrorToast("Erro de Validação", passwordValidation.error.errors[0].message);
    } else {
      newErrors.password = false;
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = true;
      hasError = true;
      showErrorToast("Erro de Validação", "As senhas não coincidem");
    } else {
      newErrors.confirmPassword = false;
    }

    setValidationErrors(newErrors);
    if (hasError) {
      showErrorToast("Campos Obrigatórios", "Preencha todos os campos obrigatórios.");
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

    // 1. Detecção híbrida e segura de e-mail já cadastrado
    const errorCode = (error as any)?.code || (error as any)?.error_code;
    const errorMessage = error?.message?.toLowerCase() || "";

    const isExplicitDuplicateError =
      Boolean(error) && (
        errorCode === "user_already_exists" ||
        errorCode === "email_exists" ||
        errorMessage.includes("user already registered") ||
        errorMessage.includes("email already in use") ||
        errorMessage.includes("already registered")
      );

    const isObfuscatedDuplicateUser =
      !error &&
      Boolean(data?.user) &&
      Array.isArray(data.user.identities) &&
      data.user.identities.length === 0;

    if (isExplicitDuplicateError || isObfuscatedDuplicateUser) {
      setLoading(false);
      setShowDuplicateEmailModal(true);
      return;
    }

    if (error) {
      // Tratar rate limit e erros de rede sem confundi-los com duplicidade
      if (error.status === 429 || errorCode === "over_email_send_rate_limit") {
        showErrorToast(
          "Muitas tentativas",
          "Aguarde alguns minutos antes de tentar se cadastrar novamente."
        );
      } else if (errorMessage.includes("failed to fetch") || !navigator.onLine) {
        showErrorToast(
          "Erro de Conexão",
          "Não foi possível conectar ao servidor. Verifique sua conexão com a internet."
        );
      } else {
        showErrorToast("Erro ao criar conta", error.message);
      }
    } else if (data?.user) {
      // Avaliação detalhada de sucesso real:
      // Se possui sessão ativa (autoconfirm ativado), usuário já entra autenticado
      // Se não possui sessão, mas possui identidades criadas, depende de confirmação por email
      const hasActiveSession = Boolean(data.session);

      if (hasActiveSession) {
        showSuccessToast(
          "Conta criada com sucesso!",
          "Você já está conectado."
        );
        navigate("/");
      } else {
        showSuccessToast(
          "Cadastro realizado!",
          "Verifique seu e-mail para confirmar a conta antes de entrar."
        );
        // Limpar o formulário e alternar para a tela de login
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setNome("");
        setValidationErrors({});
        setViewMode("login");
      }
    }

    setLoading(false);
  };

  const handleGoToLoginFromDuplicate = () => {
    setShowDuplicateEmailModal(false);
    // Preserva o e-mail informado e limpa apenas os campos de cadastro
    setPassword("");
    setConfirmPassword("");
    setNome("");
    setValidationErrors({});
    setViewMode("login");
  };

  const handleCancelDuplicate = () => {
    setShowDuplicateEmailModal(false);
    // Mantém o usuário na tela de cadastro com todos os campos preservados
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
      showErrorToast("Erro de Validação", emailValidation.error.errors[0].message);
    } else {
      newErrors.email = false;
    }

    setValidationErrors(newErrors);
    if (hasError) {
      showErrorToast("Campos Obrigatórios", "Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(emailValidation.data, {
      redirectTo: `${window.location.origin}/auth?mode=reset-password`,
    });

    if (error) {
      showErrorToast("Erro ao enviar email", error.message);
    } else {
      showSuccessToast("Sucesso", "Se o email existir, o link foi enviado.");
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
      showErrorToast("Erro de Validação", passwordValidation.error.errors[0].message);
    } else {
      newErrors.password = false;
    }

    if (password !== confirmPassword) {
      newErrors.confirmPassword = true;
      hasError = true;
      showErrorToast("Erro de Validação", "As senhas não coincidem");
    } else {
      newErrors.confirmPassword = false;
    }

    setValidationErrors(newErrors);
    if (hasError) {
      showErrorToast("Campos Obrigatórios", "Preencha todos os campos obrigatórios.");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: passwordValidation.data,
    });

    if (error) {
      showErrorToast("Erro ao redefinir senha", error.message);
    } else {
      showSuccessToast("Sucesso", "Senha redefinida com sucesso!");
      navigate("/");
    }

    setLoading(false);
  };

  const formContent = (
    <>
      <div className={cn("mb-4 text-center", isMobile && "-mt-[37px]")}>
        <img src="/favicon.ico" alt="Controle Financeiro Logo" className={cn("mx-auto", isMobile ? "h-16 w-16" : "h-[56px] w-[56px] mb-1")} />
        <h1 className="text-[26px] font-[900] tracking-[0.5px] mt-1 mb-0 text-primary" style={{ fontFamily: "'Inter', sans-serif" }}>
          Minhas Finança<span style={{ color: "#22c55e", fontWeight: "600", textShadow: "0 0 10px rgba(34, 197, 94, 0.3)" }}>$</span>
        </h1>
        <p className="text-sm text-muted-foreground -mt-1">
          {viewMode === "login" && "Acesse sua conta para continuar"}
          {viewMode === "signup" && "Preencha os dados para criar sua conta"}
          {viewMode === "forgot-password" && "Digite seu email para recuperar o acesso"}
          {viewMode === "reset-password" && "Digite sua nova senha"}
        </p>
      </div>

      {viewMode === "login" && (
        <form onSubmit={handleLogin} className="space-y-3">
          <div>
            <Label htmlFor="email" className="text-[#374151] font-medium mb-1.5 opacity-90">Email</Label>
            <div className="relative">
              <DynamicIcon name="📧" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmail(value);
                  const validation = emailSchema.safeParse(value);
                  setValidationErrors(prev => ({ ...prev, email: !validation.success }));
                }}
                required
                disabled={loading}
                placeholder="seu@email.com"
                className={cn(isMobile ? "!h-[48px] !min-h-[48px] !max-h-[48px]" : "!h-[46px] !min-h-[46px] !max-h-[46px]", "rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.email, isValid: validationErrors.email === false }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="password" className="text-[#374151] font-medium mb-1.5 opacity-90">Senha</Label>
            <div className="relative">
              <DynamicIcon name="🔒" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  const value = e.target.value;
                  setPassword(value);
                  const validation = passwordSchema.safeParse(value);
                  setValidationErrors(prev => ({ ...prev, password: !validation.success }));
                }}
                required
                disabled={loading}
                placeholder="Digite a senha..."
                className={cn(isMobile ? "!h-[48px] !min-h-[48px] !max-h-[48px]" : "!h-[46px] !min-h-[46px] !max-h-[46px]", "rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.password, isValid: validationErrors.password === false }))}
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
          <Button
            type="submit"
            className="w-full rounded-xl text-xl font-bold transition-all duration-100 bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(30,64,175,0.1),inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_0px_rgba(0,0,0,0.3)] hover:opacity-90 active:translate-y-[1px]"
            size="lg"
            disabled={loading}
            style={{ marginTop: "15px" }}
          >
            {loading ? "Entrando..." : "Entrar"}
          </Button>
          <div className="text-right text-sm md:text-[15px] mb-8 sm:mb-1">
            <button
              type="button"
              onClick={() => {
                setViewMode("forgot-password");
                setValidationErrors({});
              }}
              className="text-destructive hover:text-destructive font-semibold"
            >
              Esqueci minha senha
            </button>
          </div>
          <div className="text-center text-sm md:text-[15px] mt-8 sm:mt-0 flex justify-center items-center gap-1" style={{ marginTop: isMobile ? "20px" : "11px" }}>
            <span className="text-muted-foreground font-medium">Não possui uma conta?</span>
            <button
              type="button"
              onClick={() => {
                setViewMode("signup");
                setValidationErrors({});
              }}
              className="text-primary hover:underline font-bold"
            >
              Cadastre-se
            </button>
          </div>
        </form>
      )}

      {viewMode === "signup" && (
        <form onSubmit={handleSignup} className="space-y-3">
          <div>
            <Label htmlFor="nome" className="text-[#374151] font-medium mb-1.5 opacity-90">Nome</Label>
            <Input
              id="nome"
              type="text"
              value={nome}
              onChange={(e) => {
                const value = e.target.value;
                setNome(value);
                const validation = nameSchema.safeParse(value);
                setValidationErrors(prev => ({ ...prev, nome: !validation.success }));
              }}
              required
              disabled={loading}
              placeholder="Seu nome completo"
              maxLength={100}
              className={cn(isMobile ? "!h-[48px] !min-h-[48px] !max-h-[48px]" : "!h-[46px] !min-h-[46px] !max-h-[46px]", "rounded-[11px] font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.nome, isValid: validationErrors.nome === false }))}
            />
          </div>
          <div>
            <Label htmlFor="signup-email" className="text-[#374151] font-medium mb-1.5 opacity-90">Email</Label>
            <div className="relative">
              <DynamicIcon name="📧" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
              <Input
                id="signup-email"
                type="email"
                value={email}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmail(value);
                  const validation = emailSchema.safeParse(value);
                  setValidationErrors(prev => ({ ...prev, email: !validation.success }));
                }}
                required
                disabled={loading}
                placeholder="seu@email.com"
                className={cn(isMobile ? "!h-[48px] !min-h-[48px] !max-h-[48px]" : "!h-[46px] !min-h-[46px] !max-h-[46px]", "rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.email, isValid: validationErrors.email === false }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="signup-password" className="text-[#374151] font-medium mb-1.5 opacity-90">Senha</Label>
            <div className="relative">
              <DynamicIcon name="🔒" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
              <Input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  const value = e.target.value;
                  setPassword(value);
                  const validation = passwordSchema.safeParse(value);
                  setValidationErrors(prev => ({ ...prev, password: !validation.success }));
                }}
                required
                disabled={loading}
                placeholder="Digite a senha..."
                className={cn(isMobile ? "!h-[48px] !min-h-[48px] !max-h-[48px]" : "!h-[46px] !min-h-[46px] !max-h-[46px]", "rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.password, isValid: validationErrors.password === false }))}
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
            <Label htmlFor="confirm-password" className="text-[#374151] font-medium mb-1.5 opacity-90">Confirmar Senha</Label>
            <div className="relative">
              <DynamicIcon name="🔒" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
              <Input
                id="confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  const value = e.target.value;
                  setConfirmPassword(value);
                  setValidationErrors(prev => ({ ...prev, confirmPassword: value !== password }));
                }}
                required
                disabled={loading}
                placeholder="Digite a senha novamente..."
                className={cn(isMobile ? "!h-[48px] !min-h-[48px] !max-h-[48px]" : "!h-[46px] !min-h-[46px] !max-h-[46px]", "rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.confirmPassword, isValid: validationErrors.confirmPassword === false }))}
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
          <Button
            type="submit"
            className="w-full rounded-xl text-xl font-bold transition-all duration-100 bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(30,64,175,0.1),inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_0px_rgba(0,0,0,0.3)] hover:opacity-90 active:translate-y-[1px]"
            size="lg"
            disabled={loading}
            style={{ marginTop: "15px" }}
          >
            {loading ? "Criando conta..." : "Cadastrar"}
          </Button>
          <div className="text-center text-sm md:text-[15px]">
            <button
              type="button"
              onClick={() => {
                setViewMode("login");
                setValidationErrors({});
              }}
              className="text-primary hover:underline block w-full font-bold"
            >
              Já tenho conta
            </button>
          </div>
        </form>
      )}

      {viewMode === "forgot-password" && (
        <form onSubmit={handleForgotPassword} className="space-y-3">
          <div>
            <Label htmlFor="forgot-email" className="text-[#374151] font-medium mb-1.5 opacity-90">Email</Label>
            <div className="relative">
              <DynamicIcon name="📧" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
              <Input
                id="forgot-email"
                type="email"
                value={email}
                onChange={(e) => {
                  const value = e.target.value;
                  setEmail(value);
                  const validation = emailSchema.safeParse(value);
                  setValidationErrors(prev => ({ ...prev, email: !validation.success }));
                }}
                required
                disabled={loading}
                placeholder="seu@email.com"
                className={cn(isMobile ? "!h-[48px] !min-h-[48px] !max-h-[48px]" : "!h-[46px] !min-h-[46px] !max-h-[46px]", "rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.email, isValid: validationErrors.email === false }))}
              />
            </div>
          </div>
          <Button
            type="submit"
            className="w-full rounded-xl text-xl font-bold transition-all duration-100 bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(30,64,175,0.1),inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_0px_rgba(0,0,0,0.3)] hover:opacity-90 active:translate-y-[1px]"
            size="lg"
            disabled={loading}
          >
            {loading ? "Enviando..." : "Enviar link de recuperação"}
          </Button>
          <div className="text-center text-sm md:text-[15px]">
            <button
              type="button"
              onClick={() => {
                setViewMode("login");
                setValidationErrors({});
              }}
              className="text-primary hover:underline block w-full font-bold"
            >
              Voltar para login

            </button>
          </div>
        </form>
      )}

      {viewMode === "reset-password" && (
        <form onSubmit={handleResetPassword} className="space-y-3">
          <div>
            <Label htmlFor="new-password" className="text-[#374151] font-medium mb-1.5 opacity-90">Nova Senha</Label>
            <div className="relative">
              <DynamicIcon name="🔒" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
              <Input
                id="new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => {
                  const value = e.target.value;
                  setPassword(value);
                  const validation = passwordSchema.safeParse(value);
                  setValidationErrors(prev => ({ ...prev, password: !validation.success }));
                }}
                required
                disabled={loading}
                placeholder="Digite a senha..."
                className={cn(isMobile ? "!h-[48px] !min-h-[48px] !max-h-[48px]" : "!h-[46px] !min-h-[46px] !max-h-[46px]", "rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.password, isValid: validationErrors.password === false }))}
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
            <Label htmlFor="new-confirm-password" className="text-[#374151] font-medium mb-1.5 opacity-90">Confirmar Nova Senha</Label>
            <div className="relative">
              <DynamicIcon name="🔒" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-60" />
              <Input
                id="new-confirm-password"
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  const value = e.target.value;
                  setConfirmPassword(value);
                  setValidationErrors(prev => ({ ...prev, confirmPassword: value !== password }));
                }}
                required
                disabled={loading}
                placeholder="Digite a senha novamente..."
                className={cn(isMobile ? "!h-[48px] !min-h-[48px] !max-h-[48px]" : "!h-[46px] !min-h-[46px] !max-h-[46px]", "rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.confirmPassword, isValid: validationErrors.confirmPassword === false }))}
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
          <Button
            type="submit"
            className="w-full rounded-xl text-xl font-bold transition-all duration-100 bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(30,64,175,0.1),inset_0_1px_1px_rgba(255,255,255,0.4),inset_0_-1px_0px_rgba(0,0,0,0.3)] hover:opacity-90 active:translate-y-[1px]"
            size="lg"
            disabled={loading}
          >
            {loading ? "Redefinindo..." : "Redefinir senha"}
          </Button>
          <div className="text-center text-sm md:text-[15px]">
            <button
              type="button"
              onClick={() => {
                setViewMode("login");
                setValidationErrors({});
              }}
              className="text-primary hover:underline block w-full font-bold"
            >
              Voltar para login
            </button>
          </div>
        </form>
      )}
    </>
  );

  return (
    <div 
      className={cn(
        "auth-page-container flex flex-col min-h-[100dvh] relative overflow-hidden",
        isMobile ? "global-bg justify-center items-center p-4" : "min-h-screen bg-cover bg-center bg-no-repeat items-center justify-center p-4"
      )}
      style={!isMobile ? { backgroundImage: "url('/backgrounds/login_desktop.webp')" } : undefined}
    >
      {!isMobile && (<div className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(rgba(18,40,90,0.35), rgba(18,40,90,0.35))" }}></div>)}
{isMobile && (
          <div
              className="absolute inset-0 z-10 pointer-events-none"
              style={{
                  background: "linear-gradient(180deg, #FAFAFA 0%, #FAFAFA 75%, #F8F9FB 88%, #FCFCFE 100%)"
              }}
          />
      )}
      {isMobile ? (
        <div className="w-full max-w-md p-4 flex flex-col pb-16 relative z-10">
          {formContent}
          <Footer
            isMobile={isMobile}
            className="fixed bottom-0 left-0 right-0 py-2 bg-transparent z-50 m-0 text-xs"
            user={null}
          />
        </div>
      ) : (
        <Card className="w-full max-w-[400px] px-8 pt-6 pb-2 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] border-t border-l border-white/20 bg-white/95 backdrop-blur-sm rounded-3xl flex flex-col relative z-10 transition-all duration-300">
          <div className="flex-grow">
            {formContent}
          </div>
          <Footer
            isMobile={isMobile}
            forceMobileStyle={true}
            className="mt-1 py-1"
            user={null}
          />
        </Card>
      )}

      {/* Modal de E-mail Já Cadastrado */}
      <AlertDialog open={showDuplicateEmailModal} onOpenChange={setShowDuplicateEmailModal}>
        <AlertDialogContent
          className={cn(
            isMobile
              ? "dialog-mobile w-[99%] max-w-[99%] !px-4 p-4 !pb-4 min-h-[180px] !rounded-[22px] shadow-none border-none"
              : "sm:max-w-[400px] !pb-4 !rounded-[22px] shadow-none border-none"
          )}
          style={{
            background: "linear-gradient(135deg, #ffffff 0%, #f9fafb 100%)",
            backgroundBlendMode: "soft-light",
            backdropFilter: "blur(6px)",
            border: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), inset 0 -8px 20px rgba(0,0,0,0.02), 0 20px 25px -5px rgba(0, 0, 0, 0.1)"
          }}
        >
          <AlertDialogHeader className="text-center space-y-3">
            <div className="flex justify-center items-center w-full pt-1">
              <div
                className="btn-3d btn-3d-icon p-3 rounded-2xl flex items-center justify-center border-none cursor-default h-12 w-12"
                style={{ "--cor-topo": "#FFFFFF", "--cor-base": "#F1F5F9" } as any}
              >
                <UserCheck className="h-6 w-6 text-[#1E40AF] shrink-0" strokeWidth={2.2} />
              </div>
            </div>
            <AlertDialogTitle className="text-center text-xl font-black text-slate-800 m-0 leading-tight">
              Este e-mail já está cadastrado!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center flex flex-col gap-2.5 text-slate-700 m-0 text-sm leading-relaxed">
              <span>
                Parece que você já possui uma conta no <strong>Minhas Finanças</strong> utilizando este endereço:
              </span>
              <span
                className="w-full text-center font-semibold text-slate-900 bg-slate-100/80 px-2 py-1 rounded-md text-[12px] sm:text-[13px] tracking-tight whitespace-nowrap overflow-hidden text-ellipsis border border-slate-200/60 shadow-[inset_0_1px_2px_rgba(0,0,0,0.03)]"
                title={email}
              >
                {email}
              </span>
              <span>Deseja acessar sua conta agora?</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter
            className={cn(
              "flex flex-col sm:flex-row justify-center gap-2 mt-4",
              isMobile && "flex-row items-center justify-between"
            )}
          >
            <AlertDialogCancel
              onClick={handleCancelDuplicate}
              className={cn(
                "flex-1 rounded-xl btn-3d font-black !text-[#1E40AF] border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg mt-0 h-11",
                isMobile && "h-11 text-lg"
              )}
              style={{ "--cor-topo": "#E0E7FF", "--cor-base": "#C7D2FE" } as any}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleGoToLoginFromDuplicate}
              className={cn(
                "flex-1 rounded-2xl btn-3d font-black text-white border-none transition-all active:scale-95 shadow-[0_2px_4px_rgba(0,0,0,0.05)] text-lg h-11",
                isMobile && "h-12 text-lg"
              )}
              style={{ "--cor-topo": "#0556C3", "--cor-base": "#04469E" } as any}
            >
              Fazer login
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
