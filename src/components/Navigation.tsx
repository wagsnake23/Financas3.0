import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import DynamicIcon from "./DynamicIcon"; // Importar DynamicIcon

export const Navigation = () => {
  const { signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  const navItems = [
    { to: "/dashboard", label: "Dashboard", icon: "Home", color: "hsl(210, 70%, 50%)" }, // Azul
    { to: "/receitas", label: "Receitas", icon: "DollarSign", color: "hsl(150, 65%, 50%)" }, // Verde (success)
    { to: "/despesas", label: "Despesas", icon: "CreditCard", color: "hsl(0, 70%, 55%)" }, // Vermelho (destructive)
    { to: "/lancamentos", label: "Lançamentos", icon: "ScrollText", color: "hsl(45, 90%, 55%)" }, // Amarelo Ouro
    { to: "/categorias", label: "Categorias", icon: "FolderKanban", color: "hsl(285, 70%, 55%)" }, // Púrpura
    { to: "/investimentos", label: "Investimentos", icon: "TrendingUp", color: "hsl(180, 70%, 50%)" }, // Ciano
  ];

  const handleNavClick = () => {
    setIsOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[60] bg-gradient-primary text-primary-foreground shadow-lg"> {/* z-[60] para garantir que fique acima */}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Title and Dashboard link for mobile */}
          <div className="flex items-center gap-4">
            <NavLink to="/" className="flex items-center gap-2 font-bold text-xl">
              <img src="/favicon.ico" alt="Controle Financeiro Logo" className="h-8 w-8" />
              Minhas Finanças
            </NavLink>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className="px-3 py-2 rounded-md text-primary-foreground hover:bg-primary-foreground/10 transition-all"
                activeClassName="bg-primary-foreground/20 text-primary-foreground font-medium"
              >
                <div className="flex items-center gap-2">
                  <DynamicIcon name={item.icon} className="h-4 w-4" />
                  <span>{item.label}</span>
                </div>
              </NavLink>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="ml-2 text-primary-foreground hover:bg-primary-foreground/10"
            >
              <DynamicIcon name="LogOut" className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>

          {/* Mobile Navigation (Hamburger menu trigger) */}
          <Sheet open={isOpen} onOpenChange={setIsOpen}>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" className="text-primary-foreground">
                <DynamicIcon name="Menu" className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] sm:w-[350px] bg-card"> {/* Alterado para bg-card */}
              <SheetHeader>
                <SheetTitle className="text-foreground">Menu</SheetTitle> {/* Alterado para text-foreground */}
              </SheetHeader>
              <div className="flex flex-col gap-2 mt-6">
                {navItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={handleNavClick}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                    activeClassName="bg-muted/50 text-foreground font-medium"
                  >
                    <DynamicIcon name={item.icon} className="h-5 w-5" color={item.color} />
                    <span>{item.label}</span>
                  </NavLink>
                ))}
                <Button
                  variant="ghost"
                  onClick={() => {
                    handleNavClick();
                    signOut();
                  }}
                  className="justify-start px-4 py-3 h-auto text-muted-foreground hover:text-foreground hover:bg-muted"
                >
                  <DynamicIcon name="LogOut" className="h-5 w-5 mr-3" />
                  Sair
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
};