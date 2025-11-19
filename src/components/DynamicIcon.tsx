import React from 'react';
import {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap, ShoppingBag, FileText,
  Wallet, TrendingUp, MoreHorizontal, Plus, Trash2, Search, Pencil, DollarSign,
  Percent, Calendar, TrendingDown, ArrowUp, CreditCard, FolderKanban, LogOut,
  Menu, Home, ScrollText, Eye, EyeOff, Plane, Coffee, Gift, Smartphone, HelpCircle,
  ChevronLeft, ChevronRight, CheckCircle, Circle, XCircle, Repeat, CalendarOff, ArrowDown,
  Building, House, Droplet, Lightbulb, Flame, Globe, Wrench, Sofa, Receipt, Fuel,
  Shield, ParkingSquare, Bus, Route, ShoppingCart, Croissant, Utensils,
  Package, Stethoscope, Pill, TestTube, Dumbbell, Brain, School, Laptop,
  Book, Ticket, PartyPopper, Clapperboard, FerrisWheel, Tv, Palette, Shirt,
  Sparkles, Landmark, AlertTriangle, Banknote, LineChart, Bomb, Handshake,
  Users, Puzzle, Baby, Coins, Bitcoin, PiggyBank, PlusCircle,
  Building2, Sandwich
} from 'lucide-react';

// Mapeia os nomes dos ícones para seus respectivos componentes Lucide
const iconMap: { [key: string]: React.ElementType } = {
  UtensilsCrossed, Car, Gamepad2, Heart, GraduationCap, ShoppingBag, FileText,
  Wallet, TrendingUp, MoreHorizontal, Plus, Trash2, Search, Pencil, DollarSign,
  Percent, Calendar, TrendingDown, ArrowUp, CreditCard, FolderKanban, LogOut,
  Menu, Home, ScrollText, Eye, EyeOff, Plane, Coffee, Gift, Smartphone, HelpCircle,
  ChevronLeft, ChevronRight,
  CheckCircle, Circle, XCircle, Repeat, CalendarOff, ArrowDown,
  Building, House, Droplet, Lightbulb, Flame, Globe, Wrench, Sofa, Receipt, Fuel,
  Shield, ParkingSquare, Bus, Route, ShoppingCart, Croissant, Utensils,
  Package, Stethoscope, Pill, TestTube, Dumbbell, Brain, School, Laptop,
  Book, Ticket, PartyPopper, Clapperboard, FerrisWheel, Tv, Palette, Shirt,
  Sparkles, Landmark, AlertTriangle, Banknote, LineChart, Bomb, Handshake,
  Users, Puzzle, Baby, Coins, Bitcoin, PiggyBank, PlusCircle,
  Building2, Sandwich
};

interface DynamicIconProps extends React.SVGProps<SVGSVGElement> {
  name: string;
  className?: string;
  color?: string; // Adicionada a propriedade color
}

const DynamicIcon: React.FC<DynamicIconProps> = ({ name, className, color, ...props }) => {
  // Evita erros com nome undefined, null ou emoji
  const safeName = typeof name === "string" ? name.trim() : "";

  // Somente nomes válidos (sem emoji)
  const isValidName = /^[A-Za-z0-9_]+$/.test(safeName);

  if (!isValidName) {
    console.warn(`Icon '${name}' is invalid (emoji or malformed).`);
    return <HelpCircle className={className} color={color} {...props} />;
  }

  const IconComponent = iconMap[safeName];

  if (!IconComponent) {
    console.warn(`Icon '${name}' not found in DynamicIcon map.`);
    return <HelpCircle className={className} color={color} {...props} />;
  }

  return <IconComponent className={className} color={color} {...props} />;
};

export default DynamicIcon;