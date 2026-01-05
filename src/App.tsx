import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute"; // Importar ProtectedRoute

// Importações diretas para diagnóstico
// import Index from "./pages/Index"; // Removed as Dashboard will be the root
import Auth from "./pages/Auth";
import Categories from "./pages/Categories";
import Investments from "./pages/Investments";
import Receitas from "./pages/Receitas";
import Despesas from "./pages/Despesas";
import Lancamentos from "./pages/Lancamentos";
import Charts from "./components/Charts";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home"; // NOVO: Importar Home
import NotFound from "./pages/NotFound";
import ShoppingList from "./pages/ShoppingList"; // NOVO: Importar ShoppingList

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* Removido o Toaster do shadcn/ui para evitar conflitos */}
      <Sonner /> {/* Mantido o Sonner para notificações */}
      <BrowserRouter>
        {/* Removido React.Suspense para as rotas principais para diagnóstico */}
        <Routes>
          <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} /> {/* Set Home as the root page */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} /> {/* Move Dashboard to /dashboard */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/categorias" element={<ProtectedRoute><Categories /></ProtectedRoute>} />
          <Route path="/investimentos" element={<ProtectedRoute><Investments /></ProtectedRoute>} />
          <Route path="/receitas" element={<ProtectedRoute><Receitas /></ProtectedRoute>} />
          <Route path="/despesas" element={<ProtectedRoute><Despesas /></ProtectedRoute>} />
          <Route path="/lancamentos" element={<ProtectedRoute><Lancamentos /></ProtectedRoute>} />
          <Route path="/charts" element={<ProtectedRoute><Charts /></ProtectedRoute>} />
          <Route path="/lista-de-compras" element={<ProtectedRoute><ShoppingList /></ProtectedRoute>} /> {/* NOVO: Rota para Lista de Compras */}
          {/* Removed duplicate Dashboard route */}
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;