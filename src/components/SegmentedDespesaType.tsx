import React from "react";
import { SegmentedControl } from "./SegmentedControl";
import { useIsMobile } from "@/hooks/use-mobile";

interface SegmentedDespesaTypeProps {
  mode: "avulsa" | "recorrente";
  onSelectAvulsa: () => void;
  onSelectRecorrente: () => void;
}

export const SegmentedDespesaType: React.FC<SegmentedDespesaTypeProps> = ({
  mode,
  onSelectAvulsa,
  onSelectRecorrente,
}) => {
  const isMobile = useIsMobile();

  const options = [
    {
      label: "Avulsa",
      value: "avulsa",
      iconName: "CreditCard",
    },
    {
      label: "Recorrente",
      value: "recorrente",
      iconName: "Repeat",
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