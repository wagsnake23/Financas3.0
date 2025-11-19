import React from 'react';
import {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap, ShoppingBag, FileText,
  Wallet, TrendingUp, MoreHorizontal, Plus, Trash2, Search, Pencil, DollarSign,
  Percent, Calendar, TrendingDown, ArrowUp, CreditCard, FolderKanban, LogOut,
  Menu, Home, ScrollText, Eye, EyeOff, Plane, Coffee, Gift, Smartphone, HelpCircle,
  ChevronLeft, ChevronRight, CheckCircle, Circle, XCircle, Repeat, CalendarOff, ArrowDown
} from 'lucide-react';

// Mapeia os nomes dos ícones para seus respectivos componentes Lucide
const iconMap: { [key: string]: React.ElementType } = {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap, ShoppingBag, FileText,
  Wallet, TrendingUp, MoreHorizontal, Plus, Trash2, Search, Pencil, DollarSign,
  Percent, Calendar, TrendingDown, ArrowUp, CreditCard, FolderKanban, LogOut,
  Menu, Home, ScrollText, Eye, EyeOff, Plane, Coffee, Gift, Smartphone, HelpCircle,
  ChevronLeft, ChevronRight,
  CheckCircle, Circle, XCircle, Repeat, CalendarOff, ArrowDown
};

interface DynamicIconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  className?: string;
  color?: string; // Adicionada a propriedade color
}

const DynamicIcon: React.FC<DynamicIconProps> = ({ name, className, color, ...props }) => {
  const IconComponent = iconMap[name];

  if (!IconComponent) {
    console.warn(`Icon '${name}' not found in DynamicIcon map. Using HelpCircle as fallback.`);
    return <HelpCircle className={className} {...props} />; // Ícone de fallback
  }

  // Passa a propriedade 'color' diretamente para o componente Lucide
  return <IconComponent className={className} color={color} {...props} />;
};

export default DynamicIcon;