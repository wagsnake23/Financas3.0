-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'conferente');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create tipos_receita table
CREATE TABLE public.tipos_receita (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create receitas table
CREATE TABLE public.receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tipo_receita_id UUID REFERENCES public.tipos_receita(id),
  valor DECIMAL(10,2) NOT NULL,
  data DATE NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create categorias table
CREATE TABLE public.categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  icone TEXT,
  cor TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create cartoes table
CREATE TABLE public.cartoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  banco TEXT NOT NULL,
  ultimos_digitos TEXT NOT NULL,
  dia_fechamento INTEGER NOT NULL CHECK (dia_fechamento >= 1 AND dia_fechamento <= 31),
  dia_vencimento INTEGER NOT NULL CHECK (dia_vencimento >= 1 AND dia_vencimento <= 31),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create contas_bancarias table
CREATE TABLE public.contas_bancarias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  banco TEXT NOT NULL,
  agencia TEXT,
  numero TEXT,
  tipo TEXT NOT NULL CHECK (tipo IN ('corrente', 'poupanca')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create pix_chaves table
CREATE TABLE public.pix_chaves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('cpf', 'email', 'telefone', 'aleatoria')),
  chave TEXT NOT NULL,
  padrao BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create despesas table
CREATE TABLE public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  categoria_id UUID REFERENCES public.categorias(id),
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro', 'pix', 'cartao')),
  tipo_pagamento TEXT NOT NULL CHECK (tipo_pagamento IN ('avista', 'parcelado')),
  cartao_id UUID REFERENCES public.cartoes(id),
  valor_total DECIMAL(10,2) NOT NULL,
  descricao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create despesas_parcelas table
CREATE TABLE public.despesas_parcelas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  despesa_id UUID REFERENCES public.despesas(id) ON DELETE CASCADE NOT NULL,
  numero_parcela INTEGER NOT NULL,
  valor_parcela DECIMAL(10,2) NOT NULL,
  vencimento DATE NOT NULL,
  pago BOOLEAN DEFAULT FALSE,
  data_pagamento DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipos_receita ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cartoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pix_chaves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.despesas_parcelas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for tipos_receita
CREATE POLICY "Users can view their own tipos_receita"
  ON public.tipos_receita FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tipos_receita"
  ON public.tipos_receita FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tipos_receita"
  ON public.tipos_receita FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tipos_receita"
  ON public.tipos_receita FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for receitas
CREATE POLICY "Users can view their own receitas"
  ON public.receitas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own receitas"
  ON public.receitas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own receitas"
  ON public.receitas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own receitas"
  ON public.receitas FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for categorias
CREATE POLICY "Users can view their own categorias"
  ON public.categorias FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own categorias"
  ON public.categorias FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own categorias"
  ON public.categorias FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own categorias"
  ON public.categorias FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for cartoes
CREATE POLICY "Users can view their own cartoes"
  ON public.cartoes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cartoes"
  ON public.cartoes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cartoes"
  ON public.cartoes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cartoes"
  ON public.cartoes FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for contas_bancarias
CREATE POLICY "Users can view their own contas_bancarias"
  ON public.contas_bancarias FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own contas_bancarias"
  ON public.contas_bancarias FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contas_bancarias"
  ON public.contas_bancarias FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contas_bancarias"
  ON public.contas_bancarias FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for pix_chaves
CREATE POLICY "Users can view their own pix_chaves"
  ON public.pix_chaves FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pix_chaves"
  ON public.pix_chaves FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pix_chaves"
  ON public.pix_chaves FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pix_chaves"
  ON public.pix_chaves FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for despesas
CREATE POLICY "Users can view their own despesas"
  ON public.despesas FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own despesas"
  ON public.despesas FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own despesas"
  ON public.despesas FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own despesas"
  ON public.despesas FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for despesas_parcelas
CREATE POLICY "Users can view their own despesas_parcelas"
  ON public.despesas_parcelas FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.despesas
    WHERE despesas.id = despesas_parcelas.despesa_id
    AND despesas.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own despesas_parcelas"
  ON public.despesas_parcelas FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.despesas
    WHERE despesas.id = despesas_parcelas.despesa_id
    AND despesas.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own despesas_parcelas"
  ON public.despesas_parcelas FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.despesas
    WHERE despesas.id = despesas_parcelas.despesa_id
    AND despesas.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete their own despesas_parcelas"
  ON public.despesas_parcelas FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.despesas
    WHERE despesas.id = despesas_parcelas.despesa_id
    AND despesas.user_id = auth.uid()
  ));

-- Create function to handle new user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nome)
  VALUES (new.id, COALESCE(new.raw_user_meta_data->>'nome', 'Usuário'));
  RETURN new;
END;
$$;

-- Create trigger for new user
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create trigger for profiles updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();