import {
  BarChart3, BellRing, Calculator, ChefHat, Clock, Coffee, CreditCard, Gift, Globe, Heart, MessageSquareText, Palette,
  Percent, Printer, QrCode, ShieldCheck, Smartphone, Sparkles, Star, Store, Truck, Users, UtensilsCrossed, Zap,
} from "lucide-react";

/** فقط آیکون‌های مجازِ کارت‌های امکانات (FEATURE_ICONS) — نه کلِ کتابخانهٔ آیکون */
const MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  QrCode, Smartphone, CreditCard, BellRing, Calculator, Users, MessageSquareText, Palette, Store, Sparkles, Clock,
  ShieldCheck, Truck, Coffee, UtensilsCrossed, ChefHat, Printer, Globe, Heart, Star, Zap, BarChart3, Gift, Percent,
};
export function FeatureIcon({ name, className = "size-5" }: { name: string; className?: string }) {
  const I = MAP[name] || Sparkles;
  return <I className={className} />;
}
