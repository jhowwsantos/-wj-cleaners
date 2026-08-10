export type UserRole = 'OWNER' | 'ADMINISTRATOR' | 'CLEANER';

export type CleaningFrequency = 'WEEKLY' | 'FORTNIGHTLY' | 'MONTHLY' | 'ONE_OFF' | 'CUSTOM_DAYS';

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
  primaryColor?: string;
  secondaryColor?: string;
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
  customIntervalDays?: number;
  customStartDate?: string;
  customEndDate?: string;
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
  latitude?: number;
  longitude?: number;
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
  frequency?: CleaningFrequency;
  customIntervalDays?: number;
  customStartDate?: string;
  customEndDate?: string;
  isDeleted?: boolean;
  isRescheduled?: boolean;
  createdAt?: string;
  isCleared?: boolean;
  recurrenceSeriesId?: string;
}

export type RecurrenceStatus = 'ACTIVE' | 'CANCELLED';

export interface RecurrenceSeries {
  id: string;
  companyId: string;
  clientId: string;
  clientName: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD optional
  frequency: CleaningFrequency; // WEEKLY, FORTNIGHTLY, MONTHLY, ONE_OFF
  weekday?: number; // 0=Sunday, 1=Monday ... 6=Saturday
  time: string; // e.g. "09:00"
  cleanerId?: string;
  cleanerName?: string;
  estimatedDuration?: number;
  price?: number;
  status: RecurrenceStatus;
  cancelledAtDate?: string; // YYYY-MM-DD cutoff date from which series was cancelled
  createdAt: string;
  updatedAt?: string;
}

export type ExpenseCategory =
  | 'Combustível'
  | 'Salários'
  | 'Produtos de Limpeza'
  | 'Equipamentos'
  | 'Outros'
  | 'FUEL'
  | 'PRODUCTS'
  | 'EQUIPMENT'
  | 'WAGES'
  | 'PARKING'
  | 'OTHER'
  | string;

export type ExpensePaymentMethod = 'CARD' | 'CASH' | 'TRANSFER' | 'OTHER' | string;

export interface Expense {
  id: string;
  companyId: string;
  category: ExpenseCategory;
  description: string;
  amount: number; // £
  date: string; // YYYY-MM-DD
  paymentMethod?: ExpensePaymentMethod;
  notes?: string;
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

export type PaymentMethod = 'TRANSFER' | 'CASH' | 'OTHER';

export interface PayrollPayment {
  id: string;
  companyId: string;
  staffId: string;
  staffName: string;
  periodLabel: string;
  startDate: string;
  endDate: string;
  amount: number;
  hours: number;
  jobIds: string[];
  paymentMethod: PaymentMethod;
  paidAt: string;
  paidBy: string;
  notes?: string;
}

export interface JobScheduleValidation {
  jobId: string;
  travelTimeFromPrevMinutes: number;
  distanceFromPrevMiles: number;
  estimatedArrivalMinutes: number;
  estimatedArrivalTime: string; // e.g. "11:48"
  estimatedDepartureTime: string; // e.g. "13:48"
  scheduledTimeMinutes: number; // e.g. 705
  scheduledTime: string; // e.g. "11:45"
  delayMinutes: number; // 0 if on time, > 0 if delayed
  delayStatus: 'on_time' | 'warning' | 'critical';
  alertMessageEn: string;
  alertMessagePt: string;
}

export interface RouteOptimizationResult {
  originPostcode: string;
  originAddress: string;
  jobsInOrder: CleaningJob[];
  totalDistanceMiles: number;
  totalTravelTimeMinutes: number;
  googleMapsUrl: string;
  wazeUrl: string;
  scheduleValidations?: Record<string, JobScheduleValidation>;
  hasScheduleDelayAlert?: boolean;
  totalDelayMinutes?: number;
}
