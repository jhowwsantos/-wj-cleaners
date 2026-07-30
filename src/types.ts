export type UserRole = 'OWNER' | 'ADMINISTRATOR' | 'CLEANER';

export type CleaningFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ONE_OFF';

export type JobStatus = 'SCHEDULED' | 'EN_ROUTE' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export type PaymentStatus = 'PENDING' | 'PAID' | 'INVOICED';

export type Language = 'en' | 'pt';

export type ThemeMode = 'light' | 'dark';

export interface Company {
  id: string;
  name: string;
  code: string;
  address: string;
  postcode: string;
  city: string;
  phone: string;
  email: string;
  ownerName: string;
  currency: string; // e.g. "£"
  subscriptionPlan: 'STARTER' | 'PRO' | 'ENTERPRISE';
  subscriptionStatus: 'ACTIVE' | 'TRIAL' | 'EXPIRED';
  logoUrl?: string;
  vatNumber?: string;
  operationalBaseAddress?: string;
  operationalBasePostcode?: string;
}

export interface User {
  id: string;
  companyId: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl?: string;
  homePostcode?: string;
  homeAddress?: string;
  active: boolean;
  hourlyRate?: number;
  rating?: number;
  password?: string;
  mustChangePassword?: boolean;
}

export interface Client {
  id: string;
  companyId: string;
  name: string;
  address: string;
  postcode: string;
  city: string;
  houseNumber?: string;
  street?: string;
  county?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  whatsapp: string;
  email: string;
  hourlyRate: number; // £/hr
  defaultPrice: number; // £ total = hourlyRate * estimatedDuration
  estimatedDuration: number; // in hours, e.g. 2.5
  frequency: CleaningFrequency;
  preferredDayOfWeek: number; // 0=Sunday, 1=Monday ... 6=Saturday
  preferredTime: string; // e.g., "09:00"
  hasKey: boolean;
  keyDetails?: string;
  alarmCode?: string;
  hasPets: boolean;
  petNotes?: string;
  specialPreferences?: string;
  preferredCleanerId?: string;
  preferredCleanerName?: string;
  notes?: string;
  active: boolean;
  createdAt: string;
}

export interface PhotoRecord {
  id: string;
  type: 'BEFORE' | 'AFTER';
  url: string;
  timestamp: string;
  caption?: string;
}

export interface CleaningJob {
  id: string;
  companyId: string;
  clientId: string;
  clientName: string;
  address: string;
  postcode: string;
  city: string;
  phone: string;
  whatsapp: string;
  cleanerId?: string;
  cleanerName?: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string; // HH:mm
  estimatedDuration: number; // hours
  price: number; // £
  status: JobStatus;
  paymentStatus: PaymentStatus;
  notes?: string;
  keyDetails?: string;
  alarmCode?: string;
  hasPets?: boolean;
  petNotes?: string;
  checkInTime?: string;
  checkOutTime?: string;
  checkInGps?: { lat: number; lng: number; address?: string };
  checkOutGps?: { lat: number; lng: number; address?: string };
  photos?: PhotoRecord[];
  clientSignature?: string; // base64 canvas image data
  completedAt?: string;
  invoiceNumber?: string;
  isDeleted?: boolean;
}

export interface Expense {
  id: string;
  companyId: string;
  category: 'FUEL' | 'PRODUCTS' | 'EQUIPMENT' | 'WAGES' | 'PARKING' | 'OTHER';
  description: string;
  amount: number; // £
  date: string; // YYYY-MM-DD
  receiptPhotoUrl?: string;
  createdBy: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING';
  read: boolean;
}

export interface RouteOptimizationResult {
  originPostcode: string;
  originAddress: string;
  jobsInOrder: CleaningJob[];
  totalDistanceMiles: number;
  totalTravelTimeMinutes: number;
  googleMapsUrl: string;
  wazeUrl: string;
}
