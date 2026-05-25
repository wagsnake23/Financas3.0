import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Navigation } from "./Navigation";

export const AppLayout = () => {
  return (
    <>
      <Navigation />
      <main>
        <Suspense fallback={null}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
};
