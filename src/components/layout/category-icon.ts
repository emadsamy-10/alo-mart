import { Dumbbell, Home, LayoutGrid, type LucideIcon, Monitor, Shirt, Sofa, Sparkles } from "lucide-react";

/**
 * Decorative line icon for a department heading, chosen from the API's slug.
 * Unknown departments get a neutral icon, so a new category never breaks.
 */
const ICONS: [RegExp, LucideIcon][] = [
  [/electronic|computer|phone|tech/, Monitor],
  [/furniture|sofa|living/, Sofa],
  [/home|kitchen/, Home],
  [/fashion|cloth|apparel|wear/, Shirt],
  [/beauty|care|cosmetic/, Sparkles],
  [/sport|fitness/, Dumbbell],
];

export function categoryIcon(slug: string): LucideIcon {
  return ICONS.find(([pattern]) => pattern.test(slug))?.[1] ?? LayoutGrid;
}
