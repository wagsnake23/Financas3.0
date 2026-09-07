import React from "react";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import Loading from "@/components/Loading";
import { ShoppingListContent } from "@/components/ShoppingListContent"; // Will create this next

export default function ShoppingList() {
  const { user } = useAuth();
  const isMobile = useIsMobile();

  return (
    <div className={cn("flex flex-col global-bg pt-[calc(3.5rem+env(safe-area-inset-top))] md:pt-[72px]", isMobile ? "h-[100dvh] relative overflow-hidden" : "min-h-screen relative")}>
      <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
              background: "linear-gradient(180deg, #FAFAFA 0%, #FAFAFA 75%, #F8F9FB 88%, #FCFCFE 100%)"
          }}
      />
      <main className={cn("container-app relative z-20 flex-grow", isMobile ? "pt-4 pb-20 flex flex-col min-h-0 shrink" : "py-8")}>

        <ShoppingListContent user={user} isMobile={isMobile} />
      </main>
      <Footer
        isMobile={isMobile}
        user={user}
        className={cn(isMobile ? "fixed bottom-0 left-0 right-0 pb-2 pt-0 bg-transparent z-50 m-0" : "mt-8 relative z-20")}
      />
    </div>
  );
}
