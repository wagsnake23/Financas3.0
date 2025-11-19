import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* Removido o Toaster do shadcn/ui para evitar conflitos */}
      <Sonner /> {/* Mantido o Sonner para notificações */}
      <BrowserRouter>
        {/* Removido React.Suspense para as rotas principais para diagnóstico */}
        <Routes>
          <Route path="/" element={<Dashboard />} /> {/* Set Dashboard as the root page */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/categorias" element={<Categories />} />
          <Route path="/investimentos" element={<Investments />} />
          <Route path="/receitas" element={<Receitas />} />
          <Route path="/despesas" element={<Despesas />} />
          <Route path="/lancamentos" element={<Lancamentos />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/dashboard" element={<Dashboard />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;