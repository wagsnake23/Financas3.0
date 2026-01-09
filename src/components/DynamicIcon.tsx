import React from 'react';
import {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap, ShoppingBag, FileText,
  Wallet, TrendingUp, MoreHorizontal, Plus, Trash2, Search, Pencil, DollarSign,
  Percent, Calendar, TrendingDown, ArrowUp, ArrowDown, CreditCard, FolderKanban, LogOut,
  Menu, Home, ScrollText, Eye, EyeOff, Plane, Coffee, Gift, Smartphone, HelpCircle,
  ChevronLeft, ChevronRight, CheckCircle, Circle, XCircle, CalendarOff,
  Building, House, Droplet, Lightbulb, Flame, Globe, Wrench, Sofa, Receipt, Fuel,
  Shield, ParkingSquare, Bus, Route, ShoppingCart, Croissant, Utensils,
  Package, Stethoscope, Pill, TestTube, Dumbbell, Brain, School, Laptop,
  Book, Ticket, PartyPopper, Clapperboard, FerrisWheel, Tv, Palette, Shirt,
  Sparkles, Landmark, AlertTriangle, Banknote, LineChart, Bomb, Handshake,
  Users, Puzzle, Baby, Coins, Bitcoin, PiggyBank,
  Building2, Sandwich, Zap, Repeat, Clock, History
} from 'lucide-react';
import { cn } from "@/lib/utils"; // Importar cn para mesclar classes

// Mapeia os nomes dos ícones para seus respectivos componentes Lucide
const iconMap: { [key: string]: React.ElementType } = {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap, ShoppingBag, FileText, // Corrigido ShoppingCap para ShoppingBag
  Wallet, TrendingUp, MoreHorizontal, Plus, Trash2, Search, Pencil, DollarSign,
  Percent, Calendar, TrendingDown, ArrowUp, ArrowDown, CreditCard, FolderKanban, LogOut,
  Menu, Home, ScrollText, Eye, EyeOff, Plane, Coffee, Gift, Smartphone, HelpCircle,
  ChevronLeft, ChevronRight,
  CheckCircle, Circle, XCircle, CalendarOff,
  Building, House, Droplet, Lightbulb, Flame, Globe, Wrench, Sofa, Receipt, Fuel,
  Shield, ParkingSquare, Bus, Route, ShoppingCart, Croissant, Utensils,
  Package, Stethoscope, Pill, TestTube, Dumbbell, Brain, School, Laptop,
  Book, Ticket, PartyPopper, Clapperboard, FerrisWheel, Tv, Palette, Shirt,
  Sparkles, Landmark, AlertTriangle, Banknote, LineChart, Bomb, Handshake,
  Users, Puzzle, Baby, Coins, Bitcoin, PiggyBank,
  Building2, Sandwich, Zap, Repeat, Clock, History
};

interface DynamicIconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  className?: string;
  color?: string;
}

const DynamicIcon: React.FC<DynamicIconProps> = ({ name, className, color, ...props }) => {
  const safeName = typeof name === "string" ? name.trim() : "";

  // Tenta encontrar um componente Lucide com o nome fornecido
  const IconComponent = iconMap[safeName];

  if (IconComponent) {
    // Se for um nome de ícone Lucide válido, renderiza o componente Lucide
    return <IconComponent className={className} style={{ color: color }} {...props} />; // Aplicar color via style
  } else if (safeName) {
    // Se não for um ícone Lucide, mas não for vazio, assume que é um emoji ou texto
    // Renderiza o texto diretamente dentro de um span, aplicando as classes e cores
    return (
      <span className={cn("emoji", className, "flex items-center justify-center")} style={{ color: color }} {...props}>
        {safeName}
      </span>
    );
  } else {
    // Se o nome for vazio ou inválido, renderiza o ícone de ajuda como fallback
    console.warn(`DynamicIcon: Icon name is empty or invalid: '${name}'. Rendering HelpCircle.`);
    return <HelpCircle className={className} style={{ color: color }} {...props} />; // Aplicar color via style
  }
};

export default DynamicIcon;