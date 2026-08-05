<p align="center">
  <img src="public/icons/icon-512x512.png" width="140">
</p>

<h1 align="center">💰 Minhas Finanças</h1>

Sistema de gestão financeira pessoal completo e moderno, desenvolvido com React, TypeScript e Supabase. O projeto oferece controle detalhado sobre receitas, despesas, cartões de crédito, parcelamentos, lista de compras e investimentos. Conta com dashboards interativos, relatórios completos e projeção de patrimônio em uma interface responsiva, otimizada para dispositivos móveis e desktop.

---

## ✨ Funcionalidades

- Autenticação de usuários (Login/Registro)
- Controle de receitas e despesas
- Gerenciamento de cartões de crédito e faturas
- Acompanhamento de transações e parcelamentos
- Controle de investimentos e rendimentos
- Projeção de patrimônio
- Dashboards com gráficos interativos e resumos mensais
- Categorização inteligente de gastos
- Lista de compras integrada
- Modo Escuro (Dark Mode)
- Interface Responsiva
- Suporte a Progressive Web App (PWA)
- Sincronização em tempo real (Supabase)

---

## 🛠 Tecnologias

As principais tecnologias e bibliotecas utilizadas na construção deste projeto:

- **React** (v18)
- **TypeScript**
- **Vite**
- **Supabase** (Autenticação, Banco de Dados, RLS)
- **Tailwind CSS**
- **shadcn/ui**
- **TanStack Query** (React Query)
- **React Hook Form**
- **Zod** (Validação)
- **React Router**
- **Lucide React** (Ícones)
- **Recharts** (Gráficos)
- **Sonner / Vaul / Embla Carousel**

---

## 📦 Instalação

Siga os passos abaixo para executar o projeto localmente:

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/easy-finance-suite.git
```

2. Acesse a pasta do projeto:
```bash
cd easy-finance-suite
```

3. Instale as dependências utilizando NPM (ou PNPM/Yarn):
```bash
npm install
```

---

## ⚙️ Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto baseado no `.env.example`.

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

**Nota:** O arquivo `.env` contém credenciais sensíveis e **não deve ser enviado ao GitHub**. Utilize o arquivo `.env.example` para documentar as chaves necessárias sem expor valores reais.

---

## ▶️ Executando o Projeto

Para iniciar o servidor de desenvolvimento:

```bash
npm run dev
```

O projeto estará disponível no endereço fornecido pelo Vite no terminal.

---

## 🏗 Build

Para gerar a versão otimizada para produção:

```bash
npm run build
```

Para visualizar a build localmente antes do deploy:

```bash
npm run preview
```

---

## 📁 Estrutura do Projeto

A organização de diretórios do projeto segue o padrão:

```
├── public/                 # Ícones, manifest e assets estáticos
├── src/
│   ├── assets/             # Recursos de mídia globais
│   ├── components/         # Componentes reutilizáveis da interface
│   ├── hooks/              # Hooks customizados do React
│   ├── integrations/       # Configurações do Supabase e clientes
│   ├── pages/              # Telas principais da aplicação
│   ├── utils/              # Funções auxiliares
│   ├── App.tsx             # Raiz de roteamento da aplicação
│   └── main.tsx            # Ponto de entrada do React
├── supabase/
│   └── migrations/         # Scripts de estruturação do banco de dados
├── .env.example            # Exemplo de variáveis de ambiente
├── package.json            # Dependências e scripts
└── tailwind.config.ts      # Configurações de design e estilos
```

---

## 🔒 Segurança

O projeto foi arquitetado priorizando segurança:

- Utiliza o **Supabase** como backend.
- O controle de acesso aos dados é feito via **Row Level Security (RLS)** direto no banco de dados.
- O frontend utiliza apenas a **Publishable Key** (`VITE_SUPABASE_PUBLISHABLE_KEY`) para comunicação.
- A **Service Role Key** possui privilégios administrativos e **nunca** deve ser exposta no frontend.
- Dados sensíveis são gerenciados através de **variáveis de ambiente**.
- O arquivo `.env` **não é versionado** (ignorado pelo `.gitignore`), sendo apenas o `.env.example` enviado ao repositório.

---

## 📱 Compatibilidade

A aplicação foi desenhada de ponta a ponta para suportar múltiplas resoluções:

- **Desktop:** Layout completo com navegação rica.
- **Mobile:** Interfaces adaptadas com Bottom Navigation, gavetas (Drawers) e responsividade aprimorada.
- **PWA (Progressive Web App):** Permite a instalação do sistema como um aplicativo nativo em dispositivos iOS e Android.

---

## 📄 Licença

Projeto privado.

Todos os direitos reservados.
