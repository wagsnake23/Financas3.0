import React from 'react';
import {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap, ShoppingBag, FileText,
  Wallet, TrendingUp, MoreHorizontal, Plus, Trash2, Search, Pencil, DollarSign,
  Percent, Calendar, TrendingDown, ArrowUp, CreditCard, FolderKanban, LogOut,
  Menu, Home, ScrollText, Eye, EyeOff, Plane, Coffee, Gift, Smartphone, HelpCircle,
  ChevronLeft, ChevronRight, CheckCircle, Circle, XCircle, Repeat, CalendarOff, ArrowDown,
  Building, House, Droplet, Lightbulb, Flame, Globe, Wrench, Sofa, Receipt, GasStation,
  CarService, Shield, ParkingSquare, Bus, CarTaxi, Road, ShoppingCart, Croissant, Restaurant,
  Package, Burger, Stethoscope, Pill, UserMd, TestTube, Dumbbell, Brain, School, Laptop,
  Book, Ticket, PartyPopper, Clapperboard, FerrisWheel, Tv, Palette, Shirt, Tshirt,
  Sparkles, Landmark, AlertTriangle, Banknote, LineChart, Bomb, Handshake,
  Users, Puzzle, Baby, Coins, Bitcoin, PiggyBank, PlusCircle,
  Building2 // Adicionado Building2
} from 'lucide-react';

// Mapeia os nomes dos ícones para seus respectivos componentes Lucide
const iconMap: { [key: string]: React.ElementType } = {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap, ShoppingBag, FileText,
  Wallet, TrendingUp, MoreHorizontal, Plus, Trash2, Search, Pencil, DollarSign,
  Percent, Calendar, TrendingDown, ArrowUp, CreditCard, FolderKanban, LogOut,
  Menu, Home, ScrollText, Eye, EyeOff, Plane, Coffee, Gift, Smartphone, HelpCircle,
  ChevronLeft, ChevronRight,
  CheckCircle, Circle, XCircle, Repeat, CalendarOff, ArrowDown,
  Building, House, Droplet, Lightbulb, Flame, Globe, Wrench, Sofa, Receipt, GasStation,
  CarService, Shield, ParkingSquare, Bus, CarTaxi, Road, ShoppingCart, Croissant, Restaurant,
  Package, Burger, Stethoscope, Pill, UserMd, TestTube, Dumbbell, Brain, School, Laptop,
  Book, Ticket, PartyPopper, Clapperboard, FerrisWheel, Tv, Palette, Shirt, Tshirt,
  Sparkles, Landmark, AlertTriangle, Banknote, LineChart, Bomb, Handshake,
  Users, Puzzle, Baby, Coins, Bitcoin, PiggyBank, PlusCircle,
  Building2 // Adicionado Building2
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