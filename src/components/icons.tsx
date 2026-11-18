import {
  Shirt, Footprints, Droplets, BriefcaseMedical, Laptop, Glasses, Backpack, IdCard, Package,
  Home, Briefcase, LayoutTemplate, User, MessageCircle, Plus, Minus, Check, ChevronRight, ChevronLeft,
  Search, Star, Trash2, Pencil, ArrowUp, ArrowDown, CloudSun, Calendar, MapPin, Users, Plane, Train,
  Car, Sparkles, Bell, Copy, Settings, Upload, Download, ListChecks, FileText, Map, Wallet, Camera,
  BookOpen, X, Luggage, WifiOff, Cloud, ShieldCheck, Undo2, Send, Palmtree, Mountain, Snowflake,
  Heart, Tent, Waves, Filter, Layers, RotateCcw, LogOut, Info, Image, Clock, RefreshCw, CircleAlert,
  CheckCircle2, Brain, Lock, Trash, Ticket, Receipt, ExternalLink, Paperclip
} from 'lucide-react';
import type { LucideProps } from 'lucide-react';

const MAP = {
  Shirt, Footprints, Droplets, BriefcaseMedical, Laptop, Glasses, Backpack, IdCard, Package,
  Home, Briefcase, LayoutTemplate, User, MessageCircle, Plus, Minus, Check, ChevronRight, ChevronLeft,
  Search, Star, Trash2, Pencil, ArrowUp, ArrowDown, CloudSun, Calendar, MapPin, Users, Plane, Train,
  Car, Sparkles, Bell, Copy, Settings, Upload, Download, ListChecks, FileText, Map, Wallet, Camera,
  BookOpen, X, Luggage, WifiOff, Cloud, ShieldCheck, Undo2, Send, Palmtree, Mountain, Snowflake,
  Heart, Tent, Waves, Filter, Layers, RotateCcw, LogOut, Info, Image, Clock, RefreshCw, CircleAlert,
  CheckCircle2, Brain, Lock, Trash, Ticket, Receipt, ExternalLink, Paperclip
} as const;

export type IconName = keyof typeof MAP;

export function Icon({ name, ...p }: { name: string } & LucideProps) {
  const C = (MAP as Record<string, React.ComponentType<LucideProps>>)[name] ?? Package;
  return <C aria-hidden="true" {...p} />;
}
