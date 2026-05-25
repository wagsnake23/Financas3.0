import { lazy } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ToastProvider } from "@/contexts/ToastContext";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./components/ProtectedRoute"; // Importar ProtectedRoute
import { AuthProvider } from "./hooks/useAuth";
import { AppLayout } from "./components/AppLayout";

// Importações Dinâmicas (Lazy Loading) apenas para as páginas internas
const Auth = lazy(() => import("./pages/Auth"));
const Categories = lazy(() => import("./pages/Categories"));
const Investments = lazy(() => import("./pages/Investments"));
const Receitas = lazy(() => import("./pages/Receitas"));
const Despesas = lazy(() => import("./pages/Despesas"));
const Lancamentos = lazy(() => import("./pages/Lancamentos"));
const Charts = lazy(() => import("./components/Charts"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Home = lazy(() => import("./pages/Home"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ShoppingList = lazy(() => import("./pages/ShoppingList"));

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
                <Route path="/receitas" element={<Receitas />} />
                <Route path="/despesas" element={<Despesas />} />
                <Route path="/lancamentos" element={<Lancamentos />} />
                <Route path="/charts" element={<Charts />} />
                <Route path="/lista-de-compras" element={<ShoppingList />} />
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