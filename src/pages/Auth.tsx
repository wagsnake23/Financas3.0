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
import { cn, getBorderClass } from "@/lib/utils";
import { Footer } from "@/components/Footer";

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

    if (error) {
      showErrorToast("Erro ao criar conta", error.message);
    } else if (data.user) {

      showSuccessToast(
        "Cadastro concluído",
        "Você já pode entrar com seu e-mail e senha."
      );

      // After successful signup, clear the form and switch to login view.
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setNome("");
      setValidationErrors({});
      setViewMode("login"); // Switch back to login view
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
                className={cn("!h-[46px] !min-h-[46px] !max-h-[46px] rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.email, isValid: validationErrors.email === false }))}
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
                className={cn("!h-[46px] !min-h-[46px] !max-h-[46px] rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.password, isValid: validationErrors.password === false }))}
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
              className={cn("!h-[46px] !min-h-[46px] !max-h-[46px] rounded-[11px] font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.nome, isValid: validationErrors.nome === false }))}
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
                className={cn("!h-[46px] !min-h-[46px] !max-h-[46px] rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.email, isValid: validationErrors.email === false }))}
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
                className={cn("!h-[46px] !min-h-[46px] !max-h-[46px] rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.password, isValid: validationErrors.password === false }))}
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
                className={cn("!h-[46px] !min-h-[46px] !max-h-[46px] rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.confirmPassword, isValid: validationErrors.confirmPassword === false }))}
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
                className={cn("!h-[46px] !min-h-[46px] !max-h-[46px] rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.email, isValid: validationErrors.email === false }))}
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
                className={cn("!h-[46px] !min-h-[46px] !max-h-[46px] rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.password, isValid: validationErrors.password === false }))}
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
                className={cn("!h-[46px] !min-h-[46px] !max-h-[46px] rounded-[11px] pl-9 font-medium placeholder:text-[#9ca3af] placeholder:font-normal transition-all duration-200 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)] input-3d-premium bg-white text-gray-800", getBorderClass({ isInvalid: validationErrors.confirmPassword, isValid: validationErrors.confirmPassword === false }))}
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
    </div>
  );
}
