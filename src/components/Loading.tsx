import React from "react";

const Loading = () => {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Carregando...</div>
    </div>
  );
};

export default Loading;