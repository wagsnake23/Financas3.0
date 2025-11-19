import React from "react";
import { SegmentedControl } from "./SegmentedControl";
import { useIsMobile } from "@/hooks/use-mobile";

interface SegmentedReceitaTypeProps {
  mode: "avulsa" | "recorrente";
  onSelectAvulsa: () => void;
  onSelectRecorrente: () => void;
}

export const SegmentedReceitaType: React.FC<SegmentedReceitaTypeProps> = ({
  mode,
  onSelectAvulsa,
  onSelectRecorrente,
}) => {
  const isMobile = useIsMobile();

  const options = [
    {
      label: "Avulsa",
      value: "avulsa",
      iconName: "DollarSign",
      iconColor: "hsl(var(--success))", // Cor verde para receita avulsa
    },
    {
      label: "Recorrente",
      value: "recorrente",
      iconName: "Calendar",
      iconColor: "hsl(var(--secondary))", // Cor secundária para receita recorrente
    },
  ];

  const handleSelect = (value: "avulsa" | "recorrente") => {
    if (value === "avulsa") {
      onSelectAvulsa();
    } else {
      onSelectRecorrente();
    }
  };

  return (
    <SegmentedControl
      options={options}
      selectedOption={mode}
      onSelect={handleSelect}
      isMobile={isMobile}
    />
  );
};