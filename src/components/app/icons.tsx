"use client";

import {
  Banknote,
  Book,
  Briefcase,
  CalendarClock,
  Car,
  Coffee,
  CreditCard,
  Dumbbell,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  MoreHorizontal,
  Palmtree,
  Percent,
  PiggyBank,
  Plane,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Store,
  Tag,
  Target,
  Utensils,
  Wallet,
  Zap,
  Baby,
  Bike,
  Bus,
  Dog,
  Film,
  Music,
  Wrench,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export const ICONS: Record<string, LucideIcon> = {
  landmark: Landmark,
  "credit-card": CreditCard,
  wallet: Wallet,
  "calendar-clock": CalendarClock,
  "piggy-bank": PiggyBank,
  banknote: Banknote,
  utensils: Utensils,
  car: Car,
  home: Home,
  zap: Zap,
  shirt: Shirt,
  "heart-pulse": HeartPulse,
  coffee: Coffee,
  "gamepad-2": Gamepad2,
  briefcase: Briefcase,
  store: Store,
  percent: Percent,
  gift: Gift,
  tag: Tag,
  target: Target,
  palmtree: Palmtree,
  laptop: Laptop,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  smartphone: Smartphone,
  book: Book,
  "graduation-cap": GraduationCap,
  plane: Plane,
  dumbbell: Dumbbell,
  baby: Baby,
  bike: Bike,
  bus: Bus,
  dog: Dog,
  film: Film,
  music: Music,
  wrench: Wrench,
  sparkles: Sparkles,
  "more-horizontal": MoreHorizontal,
};

export const ICON_NAMES = Object.keys(ICONS);

export function getIcon(name: string | null | undefined): LucideIcon {
  if (!name) return Tag;
  return ICONS[name] ?? Tag;
}

/** Color palette for pickers (mint-friendly, matches design) */
export const COLOR_PALETTE = [
  "#4E9B72",
  "#8CC7A5",
  "#5E9EA0",
  "#F0A868",
  "#E5B84E",
  "#E5757A",
  "#D97BA6",
  "#A78BCA",
  "#B08968",
];

export const ACCOUNT_COLORS = COLOR_PALETTE;

export const ACCOUNT_ICONS = ["landmark", "credit-card", "wallet", "piggy-bank", "banknote"];
