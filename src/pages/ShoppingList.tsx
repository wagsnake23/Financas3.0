import React from "react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import Loading from "@/components/Loading";
import { ShoppingListContent } from "@/components/ShoppingListContent"; // Will create this next

export default function ShoppingList() {
  const { user, loading: authLoading } = useAuth();
  const isMobile = useIsMobile();

  if (authLoading) {
    return <Loading />;
  }

  return (
    <div className={cn("flex flex-col bg-background pt-16", isMobile ? "h-screen overflow-hidden bg-white" : "min-h-screen")}>
      <Navigation />
      <main className={cn("container mx-auto flex-grow", isMobile ? "px-0 py-4 pb-20 flex flex-col min-h-0 shrink" : "max-w-[1200px] px-6 py-8")}>
        {!isMobile && (
          <h1 className="text-3xl font-bold mb-6">Lista de Compras</h1>
        )}
        <ShoppingListContent user={user} isMobile={isMobile} />
      </main>
      <Footer
        isMobile={isMobile}
        user={user}
        className={cn(isMobile ? "fixed bottom-0 left-0 right-0 py-2 bg-white/80 backdrop-blur-sm border-t z-50 m-0" : "mt-8")}
      />
    </div>
  );
}