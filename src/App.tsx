import { lazy } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/contexts/ToastContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute"; // Importar ProtectedRoute
import { AuthProvider } from "./hooks/useAuth";
import { AppLayout } from "./components/AppLayout";

// Importações Dinâmicas (Lazy Loading) apenas para as páginas internas
import Auth from "./pages/Auth";
import Categories from "./pages/Categories";
import Investments from "./pages/Investments";
import Receitas from "./pages/Receitas";
import Despesas from "./pages/Despesas";
import Lancamentos from "./pages/Lancamentos";
import Charts from "./components/Charts";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import ShoppingList from "./pages/ShoppingList";
import Metas from "./pages/Metas";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <ToastProvider>
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              
              {/* Rotas protegidas sob o AppLayout global para evitar re-render e desmontagem da navegação */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/" element={<Home />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/categorias" element={<Categories />} />
                <Route path="/investimentos" element={<Investments />} />
                <Route path="/metas" element={<Metas />} />
                <Route path="/receitas" element={<Receitas />} />
                <Route path="/despesas" element={<Despesas />} />
                <Route path="/lancamentos" element={<Lancamentos />} />
                <Route path="/charts" element={<Charts />} />
                <Route path="/lista-de-compras" element={<ShoppingList />} />
                <Route path="/perfil" element={<Profile />} />
              </Route>

              {/* Catch-all route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ToastProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
