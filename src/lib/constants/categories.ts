// ABOUTME: Static mapping of category names to lucide-react icons and display labels
// ABOUTME: Used by sidebar nav and category pages for Vine-style category browsing

import type { LucideIcon } from 'lucide-react';
import {
  Laugh,
  Music,
  PartyPopper,
  PawPrint,
  Cat,
  Trophy,
  UtensilsCrossed,
  ChefHat,
  Shirt,
  Sparkles,
  Gamepad2,
  TreePine,
  Plane,
  Palette,
  Dumbbell,
  Cpu,
  GraduationCap,
  Wrench,
  Newspaper,
  Clapperboard,
  Heart,
  Baby,
  Video,
  Home,
  Users,
  Car,
  Film,
  ShoppingBag,
  Landmark,
  Drama,
  Smile,
  DollarSign,
  Scissors,
  Building2,
  Sprout,
  MapPin,
  Sofa,
  Share2,
  CircleDot,
  Tv,
  Coffee,
  Bus,
  Bitcoin,
  Tag,
} from 'lucide-react';

export interface CategoryConfig {
  icon: LucideIcon;
  label: string;
  emoji: string;
}

const CATEGORY_ICONS: Record<string, CategoryConfig> = {
  // Core categories (from original plan)
  comedy: { icon: Laugh, label: 'Comedy', emoji: '\u{1F602}' },
  music: { icon: Music, label: 'Music', emoji: '\u{1F3B5}' },
  dance: { icon: PartyPopper, label: 'Dance', emoji: '\u{1F483}' },
  animals: { icon: PawPrint, label: 'Animals', emoji: '\u{1F43E}' },
  pets: { icon: Cat, label: 'Pets', emoji: '\u{1F431}' },
  sports: { icon: Trophy, label: 'Sports', emoji: '\u{1F3C6}' },
  food: { icon: UtensilsCrossed, label: 'Food', emoji: '\u{1F355}' },
  cooking: { icon: ChefHat, label: 'Cooking', emoji: '\u{1F468}\u200D\u{1F373}' },
  fashion: { icon: Shirt, label: 'Fashion', emoji: '\u{1F457}' },
  beauty: { icon: Sparkles, label: 'Beauty', emoji: '\u2728' },
  gaming: { icon: Gamepad2, label: 'Gaming', emoji: '\u{1F3AE}' },
  nature: { icon: TreePine, label: 'Nature', emoji: '\u{1F33F}' },
  travel: { icon: Plane, label: 'Travel', emoji: '\u2708\uFE0F' },
  art: { icon: Palette, label: 'Art', emoji: '\u{1F3A8}' },
  fitness: { icon: Dumbbell, label: 'Fitness', emoji: '\u{1F4AA}' },
  technology: { icon: Cpu, label: 'Tech', emoji: '\u{1F4BB}' },
  education: { icon: GraduationCap, label: 'Education', emoji: '\u{1F4DA}' },
  diy: { icon: Wrench, label: 'DIY', emoji: '\u{1F527}' },
  news: { icon: Newspaper, label: 'News', emoji: '\u{1F4F0}' },
  entertainment: { icon: Clapperboard, label: 'Entertainment', emoji: '\u{1F3AC}' },

  // Additional categories from staging API
  lifestyle: { icon: Heart, label: 'Lifestyle', emoji: '\u{1F496}' },
  family: { icon: Baby, label: 'Family', emoji: '\u{1F46A}' },
  vlog: { icon: Video, label: 'Vlog', emoji: '\u{1F4F9}' },
  vlogging: { icon: Video, label: 'Vlogging', emoji: '\u{1F4F9}' },
  home: { icon: Home, label: 'Home', emoji: '\u{1F3E0}' },
  people: { icon: Users, label: 'People', emoji: '\u{1F465}' },
  automotive: { icon: Car, label: 'Automotive', emoji: '\u{1F697}' },
  animation: { icon: Film, label: 'Animation', emoji: '\u{1F3AC}' },
  shopping: { icon: ShoppingBag, label: 'Shopping', emoji: '\u{1F6CD}\uFE0F' },
  politics: { icon: Landmark, label: 'Politics', emoji: '\u{1F3DB}\uFE0F' },
  drama: { icon: Drama, label: 'Drama', emoji: '\u{1F3AD}' },
  humor: { icon: Smile, label: 'Humor', emoji: '\u{1F604}' },
  emotions: { icon: Heart, label: 'Emotions', emoji: '\u{2764}\uFE0F' },
  finance: { icon: DollarSign, label: 'Finance', emoji: '\u{1F4B0}' },
  grooming: { icon: Scissors, label: 'Grooming', emoji: '\u{1F488}' },
  urban: { icon: Building2, label: 'Urban', emoji: '\u{1F3D9}\uFE0F' },
  model: { icon: Sparkles, label: 'Model', emoji: '\u{1F4F8}' },
  selfie: { icon: Smile, label: 'Selfie', emoji: '\u{1F933}' },
  plants: { icon: Sprout, label: 'Plants', emoji: '\u{1FAB4}' },
  cityscape: { icon: MapPin, label: 'Cityscape', emoji: '\u{1F306}' },
  'interior-design': { icon: Sofa, label: 'Interior Design', emoji: '\u{1F6CB}\uFE0F' },
  airplane: { icon: Plane, label: 'Airplane', emoji: '\u{2708}\uFE0F' },
  'social-media': { icon: Share2, label: 'Social Media', emoji: '\u{1F4F1}' },
  football: { icon: CircleDot, label: 'Football', emoji: '\u{26BD}' },
  anime: { icon: Tv, label: 'Anime', emoji: '\u{1F1EF}\u{1F1F5}' },
  beverage: { icon: Coffee, label: 'Beverage', emoji: '\u{2615}' },
  transportation: { icon: Bus, label: 'Transportation', emoji: '\u{1F68C}' },
  cryptocurrency: { icon: Bitcoin, label: 'Crypto', emoji: '\u{20BF}' },
  laundry: { icon: Home, label: 'Laundry', emoji: '\u{1F9FA}' },
};

/** Fallback for any category not in the map */
const DEFAULT_CONFIG: CategoryConfig = { icon: Tag, label: '', emoji: '\u{1F3F7}\uFE0F' };

/**
 * Get category config by name (case-insensitive lookup).
 * Always returns a config — uses a generic fallback for unknown categories.
 */
export function getCategoryConfig(name: string): CategoryConfig {
  const config = CATEGORY_ICONS[name] || CATEGORY_ICONS[name.toLowerCase()];
  if (config) return config;

  // Fallback: capitalize the name for display
  const label = name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return { ...DEFAULT_CONFIG, label };
}
