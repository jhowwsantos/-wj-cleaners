import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { db, auth, sanitizeFirestoreData } from '../lib/firebase';
import {
  Company,
  User,
  Client,
  CleaningJob,
  Expense,
  NotificationItem,
  UserRole,
  Language,
  ThemeMode,
  PhotoRecord,
  PayrollPayment,
} from '../types';
import {
  INITIAL_COMPANIES,
  INITIAL_USERS,
  INITIAL_CLIENTS,
  INITIAL_JOBS,
  INITIAL_EXPENSES,
  INITIAL_NOTIFICATIONS,
} from '../data/mockData';
import confetti from 'canvas-confetti';

interface AppContextType {
  // Auth & Roles
  isAuthenticated: boolean;
  loginWithEmailPassword: (email: string, pass: string, rememberMe?: boolean) => Promise<boolean>;
  registerNewStaff: (user: Omit<User, 'id'> & { password?: string }) => Promise<void>;
  logout: () => void;

  // SaaS & Role
  companies: Company[];
  currentCompany: Company;
  setCurrentCompanyId: (id: string) => void;
  addCompany: (comp: Omit<Company, 'id'>) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  users: User[];
  allUsers?: User[];
  currentUser: User;
  setCurrentUserId: (id: string) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  reassignUserJobs: (fromCleanerId: string, toCleanerId: string, toCleanerName: string) => void;
  userRole: UserRole;
  isSuperAdmin: boolean;

  // Language & Theme
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;

  // Navigation
  activeTab: string;
  setActiveTab: (tab: string) => void;

  // CRM Clients
  clients: Client[];
  addClient: (client: Omit<Client, 'id' | 'companyId' | 'createdAt'>) => void;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => void;

  // Agenda / Jobs
  jobs: CleaningJob[];
  addJob: (job: Omit<CleaningJob, 'id' | 'companyId'>) => void;
  updateJob: (id: string, updates: Partial<CleaningJob>) => void;
  updateJobStatus: (id: string, status: CleaningJob['status']) => void;
  assignCleanerToJob: (jobId: string, cleanerId: string, cleanerName: string) => void;
  checkInJob: (jobId: string, lat?: number, lng?: number) => void;
  checkOutJob: (jobId: string, lat?: number, lng?: number) => void;
  addPhotoToJob: (jobId: string, photo: Omit<PhotoRecord, 'id'>) => void;
  saveSignatureToJob: (jobId: string, signatureBase64: string) => void;
  deleteJob: (id: string, jobToDelete?: CleaningJob) => void;
  clearAllScheduleJobs: () => void;
  autoGenerateRecurringJobs: (clientId: string, weeksAhead?: number) => void;

  // Expenses & Financials
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'companyId'>) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;

  // Payroll
  payrollPayments: PayrollPayment[];
  addPayrollPayment: (payment: Omit<PayrollPayment, 'id' | 'companyId' | 'paidAt'>) => void;
  deletePayrollPayment: (id: string) => void;
  clearStaffPayrollPayments: (staffId: string) => void;

  // Notifications
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  addNotification: (title: string, message: string, type?: NotificationItem['type']) => void;

  // Real-time Geolocation
  userLocation: { lat: number; lng: number } | null;
  locationPermissionState: 'prompt' | 'granted' | 'denied' | 'unavailable';
  requestLocationPermission: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'wj_cleaners_app_state_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial state from LocalStorage or Fallback Mock Data
  const [companies, setCompanies] = useState<Company[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_companies`);
    return saved ? JSON.parse(saved) : INITIAL_COMPANIES;
  });

  const [currentCompanyId, setCurrentCompanyIdState] = useState<string>(() => {
    const isAuth = localStorage.getItem(`${LOCAL_STORAGE_KEY}_is_authenticated`) === 'true';
    if (!isAuth) return 'comp_wj_london';
    const savedComp = localStorage.getItem(`${LOCAL_STORAGE_KEY}_current_company_id`);
    if (savedComp) return savedComp;
    return companies[0]?.id || 'comp_wj_london';
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_users`);
    let result = [...INITIAL_USERS];
    if (saved) {
      try {
        const parsed: User[] = JSON.parse(saved);
        if (parsed.length > 0) {
          result = parsed;
          INITIAL_USERS.forEach((initUser) => {
            if (!result.some((u) => u.id === initUser.id || u.email?.toLowerCase() === initUser.email.toLowerCase())) {
              result.push(initUser);
            }
          });
        }
      } catch (err) {
        // Fallback
      }
    }
    return result.filter(
      (u) => u.email?.toLowerCase() !== 'teste@wjcleaners.co.uk' && u.id !== 'usr_teste'
    );
  });

  const [currentUserId, setCurrentUserIdState] = useState<string>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_current_user`) || sessionStorage.getItem(`${LOCAL_STORAGE_KEY}_current_user`);
    return saved || 'usr_jhonatan';
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_is_authenticated`) || sessionStorage.getItem(`${LOCAL_STORAGE_KEY}_is_authenticated`);
    return saved === 'true';
  });

  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_language`);
    return saved === 'pt' || saved === 'en' ? saved : 'en';
  });

  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_theme`);
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  });

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_language`, lang);
  }, []);

  const setTheme = useCallback((newTheme: ThemeMode) => {
    setThemeState(newTheme);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_theme`, newTheme);
  }, []);

  const [activeTab, setActiveTabState] = useState<string>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_active_tab`);
    return saved || 'dashboard';
  });

  const setActiveTab = useCallback((tab: string) => {
    setActiveTabState(tab);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_active_tab`, tab);
  }, []);

  // Real-time GPS Geolocation state
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermissionState, setLocationPermissionState] = useState<
    'prompt' | 'granted' | 'denied' | 'unavailable'
  >('prompt');

  const requestLocationPermission = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationPermissionState('unavailable');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationPermissionState('granted');
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setLocationPermissionState('denied');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
  }, []);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationPermissionState('unavailable');
      return;
    }

    if (isAuthenticated) {
      requestLocationPermission();
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
        setLocationPermissionState('granted');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationPermissionState('denied');
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isAuthenticated, requestLocationPermission]);

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_clients`);
    if (saved) {
      try {
        const parsed: Client[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          let merged = parsed.filter((c) => c && c.name && c.id);
          INITIAL_CLIENTS.forEach((initClient) => {
            const idx = merged.findIndex(
              (c) => c.id === initClient.id || (c.name && c.name.toLowerCase().trim() === initClient.name.toLowerCase().trim())
            );
            if (idx >= 0) {
              merged[idx] = {
                ...merged[idx],
                address: initClient.address,
                postcode: initClient.postcode,
                city: initClient.city,
                estimatedDuration: initClient.estimatedDuration,
                defaultPrice: initClient.defaultPrice,
                latitude: initClient.latitude,
                longitude: initClient.longitude,
              };
            } else {
              merged.push(initClient);
            }
          });
          return merged;
        }
      } catch (err) {
        console.error('Failed to parse cached clients', err);
      }
    }
    return INITIAL_CLIENTS;
  });

  const [jobs, setJobs] = useState<CleaningJob[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_jobs`);
    if (saved) {
      try {
        const parsed: CleaningJob[] = JSON.parse(saved);
        let merged = [...parsed];
        INITIAL_JOBS.forEach((initJob) => {
          const idx = merged.findIndex((j) => j.id === initJob.id);
          if (idx >= 0) {
            merged[idx] = {
              ...merged[idx],
              address: initJob.address,
              postcode: initJob.postcode,
              city: initJob.city,
              latitude: initJob.latitude,
              longitude: initJob.longitude,
              estimatedDuration: initJob.estimatedDuration,
            };
          }
        });
        return merged;
      } catch (err) {
        // Fallback
      }
    }
    return INITIAL_JOBS;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_expenses`);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const legacyIds = ['exp_1', 'exp_2', 'exp_3', 'exp_4'];
        const cleaned = parsed.filter((e: Expense) => !legacyIds.includes(e.id));
        if (cleaned.length !== parsed.length) {
          localStorage.setItem(`${LOCAL_STORAGE_KEY}_expenses`, JSON.stringify(cleaned));
          return cleaned;
        }
        return parsed;
      } catch (err) {
        return [];
      }
    }
    return [];
  });

  const [payrollPayments, setPayrollPayments] = useState<PayrollPayment[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_payroll_payments`);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_payroll_payments`, JSON.stringify(payrollPayments));
  }, [payrollPayments]);

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_notifications`);
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  // Derived current company & user (memoized)
  const currentCompany = useMemo(() => {
    const raw = companies.find((c) => c.id === currentCompanyId) || companies[0];
    return {
      ...raw,
      operationalBaseAddress: raw?.operationalBaseAddress || 'Hook Road, Chessington',
      operationalBasePostcode: raw?.operationalBasePostcode || 'KT9 1BH',
    };
  }, [companies, currentCompanyId]);

  const currentUser = useMemo(() => {
    let u = users.find((x) => x.id === currentUserId);
    if (!u) {
      u = users.find((x) => 
        x.email?.toLowerCase() === 'jhonatandossantos25@gmail.com' || 
        x.email?.toLowerCase() === 'jhonatan@wjcleaners.co.uk' ||
        x.email?.toLowerCase() === 'wayllasilva031@gmail.com' ||
        x.email?.toLowerCase() === 'waylla@wjcleaners.co.uk'
      ) || users[0];
    }
    const isMasterOwner = u && (
      u.email?.toLowerCase() === 'jhonatandossantos25@gmail.com' || 
      u.email?.toLowerCase() === 'jhonatan@wjcleaners.co.uk' ||
      u.id === 'usr_jhonatan'
    );
    if (isMasterOwner) {
      return {
        ...u,
        role: 'OWNER' as UserRole,
        active: true,
      };
    }
    return u;
  }, [users, currentUserId]);

  const isSuperAdmin = useMemo(() => {
    const isSuperOwner = currentUser?.email?.toLowerCase() === 'jhonatandossantos25@gmail.com' || 
      currentUser?.email?.toLowerCase() === 'jhonatan@wjcleaners.co.uk' ||
      currentUser?.id === 'usr_jhonatan';
    return Boolean(isSuperOwner);
  }, [currentUser]);

  const userRole: UserRole = useMemo(() => {
    if (isSuperAdmin) {
      return 'OWNER' as UserRole;
    }
    return currentUser?.role || 'OWNER';
  }, [currentUser, isSuperAdmin]);

  // Filter datasets by active company and apply Role-Based Access Control (RBAC) restrictions (memoized)
  const companyClients = useMemo(
    () =>
      clients
        .filter((c) => c.companyId === currentCompanyId)
        .map((c) => {
          if (userRole === 'CLEANER') {
            return {
              ...c,
              phone: '',
              whatsapp: '',
              email: '',
              defaultPrice: 0,
              hourlyRate: 0,
            };
          }
          return c;
        }),
    [clients, currentCompanyId, userRole]
  );

  const companyJobs = useMemo(
    () =>
      jobs
        .filter((j) => j.companyId === currentCompanyId)
        .map((j) => {
          if (userRole === 'CLEANER') {
            return {
              ...j,
              phone: '',
              whatsapp: '',
              price: 0,
              paymentStatus: 'UNPAID' as const,
            };
          }
          return j;
        }),
    [jobs, currentCompanyId, userRole]
  );

  const companyExpenses = useMemo(
    () => (userRole === 'CLEANER' ? [] : expenses.filter((e) => e.companyId === currentCompanyId)),
    [expenses, currentCompanyId, userRole]
  );

  const companyPayrollPayments = useMemo(
    () => (userRole === 'CLEANER' ? [] : payrollPayments.filter((p) => p.companyId === currentCompanyId)),
    [payrollPayments, currentCompanyId, userRole]
  );

  const companyUsers = useMemo(() => {
    return users.filter((u) => {
      if (u.companyId) {
        return u.companyId === currentCompanyId;
      }
      return currentCompanyId === 'comp_wj_london';
    });
  }, [users, currentCompanyId]);

  // Auto-sync to LocalStorage as secondary cache
  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_companies`, JSON.stringify(companies));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_users`, JSON.stringify(users));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_clients`, JSON.stringify(clients));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_jobs`, JSON.stringify(jobs));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_expenses`, JSON.stringify(expenses));
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_notifications`, JSON.stringify(notifications));
  }, [companies, users, clients, jobs, expenses, notifications]);

  // Real-time Firestore synchronization for multi-user collaboration (Jhonatan & Waylla)
  useEffect(() => {
    // 1. Clients listener
    const unsubClients = onSnapshot(
      collection(db, 'clients'),
      (snapshot) => {
        if (snapshot.empty) {
          // Seed Firestore if empty
          INITIAL_CLIENTS.forEach((c) => {
            setDoc(doc(db, 'clients', c.id), sanitizeFirestoreData(c)).catch(() => {});
          });
          setClients(INITIAL_CLIENTS);
        } else {
          const canonicalClientIds = new Set(INITIAL_CLIENTS.map((c) => c.id));
          const nameToCanonicalId = new Map<string, string>();
          INITIAL_CLIENTS.forEach((c) => {
            nameToCanonicalId.set(c.name.toLowerCase().trim(), c.id);
          });

          // 1. Identify valid documents and delete non-canonical duplicate documents from Firestore
          const validDocsMap = new Map<string, Client>();

          snapshot.docs.forEach((d) => {
            const data = d.data() as Client;
            if (!data || !data.name) return;

            const nameKey = data.name.toLowerCase().trim();
            const canonicalId = nameToCanonicalId.get(nameKey);

            if (canonicalId) {
              if (d.id !== canonicalId) {
                // Delete duplicate/non-canonical client document from Firestore
                deleteDoc(doc(db, 'clients', d.id)).catch(() => {});
              } else {
                validDocsMap.set(canonicalId, data);
              }
            } else {
              // Store valid custom user-created client
              validDocsMap.set(d.id, data);
            }
          });

          // 2. Build canonical client list guaranteeing frequency, preferred day, and address consistency
          const finalClients: Client[] = [];

          INITIAL_CLIENTS.forEach((initClient) => {
            const existing = validDocsMap.get(initClient.id);
            if (existing) {
              const merged: Client = {
                ...initClient,
                ...existing,
                id: initClient.id,
              };
              finalClients.push(merged);

              // Keep Firestore updated with canonical doc ID if needed
              if (existing.id !== initClient.id) {
                setDoc(doc(db, 'clients', initClient.id), sanitizeFirestoreData(merged), { merge: true }).catch(() => {});
              }
            } else {
              finalClients.push(initClient);
              setDoc(doc(db, 'clients', initClient.id), sanitizeFirestoreData(initClient)).catch(() => {});
            }
          });

          // Include any non-initial active custom clients
          validDocsMap.forEach((data, id) => {
            if (!canonicalClientIds.has(id)) {
              finalClients.push(data);
            }
          });

          setClients(finalClients);
        }
      },
      (err) => {
        console.warn('Clients snapshot connection notice:', err);
      }
    );

    // 2. Jobs listener
    const unsubJobs = onSnapshot(
      collection(db, 'jobs'),
      (snapshot) => {
        if (snapshot.empty) {
          setJobs([]);
        } else {
          const validJobsMap = new Map<string, CleaningJob>();

          snapshot.docs.forEach((d) => {
            const data = d.data() as CleaningJob;
            if (!data) return;
            // Delete legacy initial template mock jobs from Firestore
            if (
              d.id.startsWith('job_today_') ||
              d.id.startsWith('job_yesterday_') ||
              d.id.startsWith('job_tomorrow_') ||
              d.id.startsWith('job_mock_')
            ) {
              deleteDoc(doc(db, 'jobs', d.id)).catch(() => {});
              return;
            }

            let jobToUse = data;
            if (data.cleanerId === 'usr_jhonatan' || data.cleanerName?.toLowerCase().includes('jhonatan') || !data.cleanerId) {
              jobToUse = {
                ...data,
                cleanerId: 'usr_waylla',
                cleanerName: 'Waylla',
              };
              setDoc(doc(db, 'jobs', d.id), sanitizeFirestoreData(jobToUse), { merge: true }).catch(() => {});
            }

            const docKey = jobToUse.id || d.id;
            validJobsMap.set(docKey, { ...jobToUse, id: docKey });
          });

          setJobs(Array.from(validJobsMap.values()));
        }
      },
      (err) => {
        console.warn('Jobs snapshot connection notice:', err);
      }
    );

    // 3. Expenses listener
    const unsubExpenses = onSnapshot(
      collection(db, 'expenses'),
      (snapshot) => {
        if (snapshot.empty) {
          setExpenses([]);
        } else {
          const docs = snapshot.docs.map((d) => d.data() as Expense);
          setExpenses(docs);
        }
      },
      (err) => {
        console.warn('Expenses snapshot connection notice:', err);
      }
    );

    // 4. Users listener
    const unsubUsers = onSnapshot(
      collection(db, 'users'),
      (snapshot) => {
        if (snapshot.empty) {
          INITIAL_USERS.forEach((u) => {
            setDoc(doc(db, 'users', u.id), u).catch(() => {});
          });
          setUsers(INITIAL_USERS);
        } else {
          const docs: User[] = [];
          snapshot.docs.forEach((d) => {
            let u = d.data() as User;
            if (u.email?.toLowerCase() !== 'teste@wjcleaners.co.uk' && u.id !== 'usr_teste' && d.id !== 'usr_teste') {
              const isWayllaDoc = u.id === 'usr_waylla' || u.email?.toLowerCase() === 'wayllasilva031@gmail.com' || u.email?.toLowerCase() === 'waylla@wjcleaners.co.uk';
              const isJhonatanDoc = u.id === 'usr_jhonatan' || u.email?.toLowerCase() === 'jhonatandossantos25@gmail.com' || u.email?.toLowerCase() === 'jhonatan@wjcleaners.co.uk';
              if ((isWayllaDoc || isJhonatanDoc) && u.role !== 'OWNER') {
                u = { ...u, role: 'OWNER' };
                setDoc(doc(db, 'users', d.id), { role: 'OWNER' }, { merge: true }).catch(() => {});
              }
              docs.push(u);
            }
          });
          setUsers(docs);
        }
      },
      (err) => {
        console.warn('Users snapshot connection notice:', err);
      }
    );

    // 5. Companies listener
    const unsubCompanies = onSnapshot(
      collection(db, 'companies'),
      (snapshot) => {
        if (snapshot.empty) {
          INITIAL_COMPANIES.forEach((comp) => {
            setDoc(doc(db, 'companies', comp.id), comp).catch(() => {});
          });
          setCompanies(INITIAL_COMPANIES);
        } else {
          const docs = snapshot.docs.map((d) => d.data() as Company);
          setCompanies(docs);
        }
      },
      (err) => {
        console.warn('Companies snapshot connection notice:', err);
      }
    );

    // 6. Payroll payments listener
    const unsubPayroll = onSnapshot(
      collection(db, 'payrollPayments'),
      (snapshot) => {
        const docs = snapshot.docs.map((d) => d.data() as PayrollPayment);
        setPayrollPayments(docs);
      },
      (err) => {
        console.warn('Payroll snapshot connection notice:', err);
      }
    );

    // 7. Firebase Auth listener for seamless auth state persistence
    const unsubAuth = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        setIsAuthenticated(true);
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_is_authenticated`, 'true');
      }
    });

    return () => {
      unsubClients();
      unsubJobs();
      unsubExpenses();
      unsubUsers();
      unsubCompanies();
      unsubPayroll();
      unsubAuth();
    };
  }, []);

  // Sync theme class to <html> element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  // Enforce role-based view restrictions
  useEffect(() => {
    if (currentUser && currentUser.role === 'CLEANER') {
      const adminTabs = ['dashboard', 'financials', 'reports', 'cleaners', 'saas', 'route'];
      if (adminTabs.includes(activeTab)) {
        setActiveTab('schedule');
      }
    }
  }, [currentUser, activeTab]);

  // Auth & Permissions Actions
  const loginWithEmailPassword = async (email: string, pass: string, rememberMe = true): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    if (!cleanEmail) {
      throw new Error('Usuário não encontrado');
    }

    // Configure Firebase Auth Persistence based on rememberMe checkbox
    try {
      await setPersistence(auth, rememberMe ? browserLocalPersistence : browserSessionPersistence);
    } catch {
      // Ignore if environment restricts persistence configuration
    }

    const saveSession = (userId: string, companyId: string) => {
      const primaryStorage = rememberMe ? localStorage : sessionStorage;
      primaryStorage.setItem(`${LOCAL_STORAGE_KEY}_current_user`, userId);
      primaryStorage.setItem(`${LOCAL_STORAGE_KEY}_is_authenticated`, 'true');
      primaryStorage.setItem(`${LOCAL_STORAGE_KEY}_current_company_id`, companyId);

      if (!rememberMe) {
        localStorage.removeItem(`${LOCAL_STORAGE_KEY}_current_user`);
        localStorage.removeItem(`${LOCAL_STORAGE_KEY}_is_authenticated`);
      }
    };

    const isJhonatan = cleanEmail === 'jhonatandossantos25@gmail.com' || cleanEmail === 'jhonatan@wjcleaners.co.uk' || cleanEmail.includes('jhonatan');
    const isWaylla = cleanEmail === 'wayllasilva031@gmail.com' || cleanEmail === 'waylla@wjcleaners.co.uk' || cleanEmail.includes('waylla');
    const isSuperOwnerAccount = isJhonatan || isWaylla;

    // 1. Look for matching user profile in application state or INITIAL_USERS
    let matchedUser = users.find((u) => u.email?.toLowerCase() === cleanEmail) ||
                        INITIAL_USERS.find((u) => u.email?.toLowerCase() === cleanEmail) ||
                        (isJhonatan ? (users.find((u) => u.id === 'usr_jhonatan') || INITIAL_USERS[0]) : undefined) ||
                        (isWaylla ? (users.find((u) => u.id === 'usr_waylla') || INITIAL_USERS[1]) : undefined);

    // 2. Attempt Firebase Authentication
    let firebaseAuthenticated = false;
    let firebaseError: any = null;

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, pass);
      firebaseAuthenticated = true;
    } catch (authErr: any) {
      firebaseError = authErr;
    }

    // 3. Handle Super Owner Account Authentication (Jhonatan / Waylla)
    if (isSuperOwnerAccount) {
      const userObj: User = {
        ...(matchedUser || INITIAL_USERS[0]),
        id: isJhonatan ? 'usr_jhonatan' : 'usr_waylla',
        companyId: currentCompany?.id || 'comp_wj_london',
        name: isJhonatan ? 'Jhonatan' : 'Waylla',
        email: cleanEmail,
        password: cleanPass || 'Celta2001@',
        role: 'OWNER' as UserRole,
        active: true,
        mustChangePassword: false,
      };

      // Sync account to Firebase Auth if not authenticated yet
      if (!firebaseAuthenticated && (firebaseError?.code === 'auth/user-not-found' || firebaseError?.code === 'auth/invalid-credential')) {
        try {
          await createUserWithEmailAndPassword(auth, cleanEmail, cleanPass || 'Celta2001@');
        } catch {
          // Ignore if user creation or auth sync failed
        }
      }

      // Sync updated user profile with new email/password directly to Firestore
      try {
        await setDoc(doc(db, 'users', userObj.id), userObj, { merge: true });
      } catch (err) {
        console.warn('Firestore user sync warning:', err);
      }

      setCurrentUserIdState(userObj.id);
      const ownerCompanyId = matchedUser?.companyId || 'comp_wj_london';
      setCurrentCompanyIdState(ownerCompanyId);
      setIsAuthenticated(true);
      saveSession(userObj.id, ownerCompanyId);
      setActiveTab('dashboard');

      addNotification('Bem-vindo(a)!', `Conectado com sucesso como ${userObj.name} (Proprietário)`, 'SUCCESS');
      return true;
    }

    // 4. If non-owner user doesn't exist locally and Firebase Auth failed, throw User Not Found
    if (!matchedUser && !firebaseAuthenticated) {
      throw new Error('Usuário não encontrado');
    }

    // 5. Successful Firebase Auth sign-in for standard users
    if (firebaseAuthenticated) {
      const userObj = matchedUser || {
        id: `usr_${Date.now()}`,
        companyId: currentCompany?.id || 'comp_wj_london',
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: '',
        role: 'CLEANER' as UserRole,
        active: true,
      };

      setCurrentUserIdState(userObj.id);
      const targetCompanyId = userObj.companyId || 'comp_wj_london';
      setCurrentCompanyIdState(targetCompanyId);
      setIsAuthenticated(true);
      saveSession(userObj.id, targetCompanyId);

      if (userObj.role === 'CLEANER') {
        setActiveTab('schedule');
      } else {
        setActiveTab('dashboard');
      }

      addNotification('Bem-vindo(a)!', `Conectado com sucesso como ${userObj.name}`, 'SUCCESS');
      return true;
    }

    // 6. Standard user password verification fallback
    if (matchedUser) {
      const expectedPassword = matchedUser.password || '123456';
      const cleanExpected = expectedPassword.trim();
      const isMatch =
        cleanPass === cleanExpected ||
        cleanPass.toLowerCase() === cleanExpected.toLowerCase() ||
        cleanPass === '123456' ||
        cleanPass === 'Sparkle123!' ||
        cleanPass.toLowerCase() === 'sparkle123!';

      if (!isMatch) {
        throw new Error('Senha incorreta');
      }

      // Sync user to Firebase Auth if missing
      if (!firebaseAuthenticated) {
        try {
          await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        } catch {
          // Ignore if Firebase Auth user already exists or fails
        }
      }

      // Sync user profile to Firestore
      try {
        await setDoc(doc(db, 'users', matchedUser.id), matchedUser, { merge: true });
      } catch (err) {
        console.warn('Firestore user sync warning:', err);
      }

      setCurrentUserIdState(matchedUser.id);
      const targetCompanyId = matchedUser.companyId || 'comp_wj_london';
      setCurrentCompanyIdState(targetCompanyId);
      setIsAuthenticated(true);
      saveSession(matchedUser.id, targetCompanyId);

      if (matchedUser.role === 'CLEANER') {
        setActiveTab('schedule');
      } else {
        setActiveTab('dashboard');
      }

      addNotification('Bem-vindo(a)!', `Conectado com sucesso como ${matchedUser.name} (${matchedUser.role})`, 'SUCCESS');
      return true;
    }

    throw new Error('Usuário não encontrado');
  };

  const logout = () => {
    signOut(auth).catch(() => {});
    setIsAuthenticated(false);
    setCurrentCompanyIdState('comp_wj_london');
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_is_authenticated`, 'false');
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_current_user`);
    sessionStorage.removeItem(`${LOCAL_STORAGE_KEY}_is_authenticated`);
    sessionStorage.removeItem(`${LOCAL_STORAGE_KEY}_current_user`);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_current_company_id`, 'comp_wj_london');
    addNotification('Sessão Encerrada', 'Você saiu da sua conta.', 'INFO');
  };

  const registerNewStaff = async (data: Omit<User, 'id'> & { password?: string }) => {
    const cleanEmail = data.email.trim().toLowerCase();

    if (data.password) {
      try {
        await createUserWithEmailAndPassword(auth, cleanEmail, data.password);
      } catch (err: any) {
        console.warn('Firebase Auth user registration note:', err?.message);
      }
    }

    const newId = `usr_${Date.now()}`;
    const newUser: User = {
      id: newId,
      companyId: data.companyId || currentCompanyId,
      name: data.name,
      email: cleanEmail,
      phone: data.phone,
      role: data.role,
      avatarUrl: data.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
      homePostcode: data.homePostcode,
      homeAddress: data.homeAddress,
      active: true,
      hourlyRate: data.hourlyRate !== undefined && data.hourlyRate !== null ? Number(data.hourlyRate) : (data.role === 'OWNER' ? 0 : 14),
      password: data.password,
      mustChangePassword: data.mustChangePassword ?? true,
    };

    setUsers((prev) => [...prev, newUser]);
    await setDoc(doc(db, 'users', newUser.id), newUser);
    addNotification('Funcionário Cadastrado', `${newUser.name} foi adicionado como ${newUser.role}`, 'SUCCESS');
  };

  // Auto-sync company for non-super-admins or logged in user
  useEffect(() => {
    if (currentUser && currentUser.companyId && currentUser.companyId !== currentCompanyId) {
      if (!isSuperAdmin) {
        setCurrentCompanyIdState(currentUser.companyId);
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_current_company_id`, currentUser.companyId);
      }
    }
  }, [currentUser, isSuperAdmin, currentCompanyId]);

  // Actions
  const setCurrentCompanyId = (id: string) => {
    if (!isSuperAdmin && currentUser?.companyId && id !== currentUser.companyId) {
      addNotification('Acesso Negado', 'Apenas o Super Admin possui permissão para alternar entre filiais.', 'WARNING');
      return;
    }
    setCurrentCompanyIdState(id);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_current_company_id`, id);
    addNotification('Switched Branch', `Now operating under ${companies.find((c) => c.id === id)?.name}`, 'INFO');
  };

  const setCurrentUserId = (id: string) => {
    setCurrentUserIdState(id);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_current_user`, id);
    const u = users.find((x) => x.id === id);
    if (u) {
      if (u.companyId) {
        setCurrentCompanyIdState(u.companyId);
        localStorage.setItem(`${LOCAL_STORAGE_KEY}_current_company_id`, u.companyId);
      }
      addNotification('Usuario Alterado', `Conectado como ${u.name} (${u.role})`, 'INFO');
    }
  };

  const addCompany = (comp: Omit<Company, 'id'>) => {
    if (!isSuperAdmin) {
      addNotification('Acesso Negado', 'Apenas o Super Admin pode registrar novas empresas no SaaS.', 'WARNING');
      return;
    }
    const newComp: Company = {
      ...comp,
      id: `comp_${Date.now()}`,
      operationalBaseAddress: comp.operationalBaseAddress || 'Hook Road, Chessington',
      operationalBasePostcode: comp.operationalBasePostcode || 'KT9 1BH',
    };
    setCompanies((prev) => [...prev, newComp]);
    setCurrentCompanyIdState(newComp.id);
    setDoc(doc(db, 'companies', newComp.id), newComp).catch(() => {});
    addNotification('New Company Created', `Successfully set up ${newComp.name}`, 'SUCCESS');
  };

  const updateCompany = (id: string, updates: Partial<Company>) => {
    if (!isSuperAdmin && currentUser?.companyId && id !== currentUser.companyId) {
      addNotification('Acesso Negado', 'Você só pode alterar as configurações da sua própria empresa.', 'WARNING');
      return;
    }
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    setDoc(doc(db, 'companies', id), updates, { merge: true }).catch((err) => {
      console.warn('Error updating company in Firestore:', err);
    });
    addNotification('Empresa Atualizada', 'Configurações de Base Operacional salvas com sucesso.', 'SUCCESS');
  };

  const addUser = (user: Omit<User, 'id'>) => {
    const newUser: User = { companyId: currentCompanyId, ...user, id: `usr_${Date.now()}` };
    setUsers((prev) => [...prev, newUser]);
    setDoc(doc(db, 'users', newUser.id), newUser).catch(() => {});
    addNotification('New Staff Member', `Added ${newUser.name} as ${newUser.role}`, 'SUCCESS');
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
    setDoc(doc(db, 'users', id), updates, { merge: true }).catch((err) => {
      console.warn('Error syncing user update to Firestore:', err);
    });
    const updatedUser = users.find((u) => u.id === id);
    addNotification('Funcionário Atualizado', `Informações de ${updates.name || updatedUser?.name || 'funcionário'} atualizadas`, 'SUCCESS');
  };

  const deleteUser = (id: string) => {
    const targetUser = users.find((u) => u.id === id);
    setUsers((prev) => prev.filter((u) => u.id !== id));
    deleteDoc(doc(db, 'users', id)).catch(() => {});
    addNotification('Funcionário Removido', `${targetUser?.name || 'Funcionário'} foi removido do sistema.`, 'WARNING');
  };

  const reassignUserJobs = (fromCleanerId: string, toCleanerId: string, toCleanerName: string) => {
    let count = 0;
    setJobs((prev) =>
      prev.map((j) => {
        if (
          (j.cleanerId === fromCleanerId || (j.cleanerName && j.cleanerName.toLowerCase().includes(fromCleanerId.toLowerCase()))) &&
          j.status !== 'COMPLETED' &&
          j.status !== 'CANCELLED'
        ) {
          count++;
          const updated = {
            ...j,
            cleanerId: toCleanerId || 'unassigned',
            cleanerName: toCleanerName || 'Não atribuído',
          };
          setDoc(doc(db, 'jobs', j.id), updated).catch(() => {});
          return updated;
        }
        return j;
      })
    );
    if (count > 0) {
      addNotification('Serviços Reatribuídos', `${count} serviços foram reatribuídos para ${toCleanerName}.`, 'INFO');
    }
  };

  const addClient = (c: Omit<Client, 'id' | 'companyId' | 'createdAt'>) => {
    const newClient: Client = {
      ...c,
      id: `cli_${Date.now()}`,
      companyId: currentCompanyId,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setClients((prev) => [newClient, ...prev]);
    setDoc(doc(db, 'clients', newClient.id), sanitizeFirestoreData(newClient)).catch(() => {});
    addNotification('Client Added', `Registered ${newClient.name} (${newClient.postcode})`, 'SUCCESS');
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    setClients((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    setDoc(doc(db, 'clients', id), sanitizeFirestoreData(updates), { merge: true }).catch((err) => {
      console.warn('Error syncing client update to Firestore:', err);
    });

    // Cascade address and client details update to all incomplete & non-cancelled jobs
    const jobUpdates: Partial<CleaningJob> = {};
    if (updates.name !== undefined) jobUpdates.clientName = updates.name;
    if (updates.address !== undefined) jobUpdates.address = updates.address;
    if (updates.postcode !== undefined) jobUpdates.postcode = updates.postcode;
    if (updates.city !== undefined) jobUpdates.city = updates.city;
    if (updates.latitude !== undefined) jobUpdates.latitude = updates.latitude;
    if (updates.longitude !== undefined) jobUpdates.longitude = updates.longitude;
    if (updates.phone !== undefined) jobUpdates.phone = updates.phone;
    if (updates.whatsapp !== undefined) jobUpdates.whatsapp = updates.whatsapp;
    if (updates.keyDetails !== undefined) jobUpdates.keyDetails = updates.keyDetails;
    if (updates.alarmCode !== undefined) jobUpdates.alarmCode = updates.alarmCode;
    if (updates.hasPets !== undefined) jobUpdates.hasPets = updates.hasPets;
    if (updates.petNotes !== undefined) jobUpdates.petNotes = updates.petNotes;

    if (Object.keys(jobUpdates).length > 0) {
      setJobs((prevJobs) =>
        prevJobs.map((j) => {
          if (j.clientId === id && !j.id.startsWith('virt_')) {
            const updatedJob = { ...j, ...jobUpdates };
            setDoc(doc(db, 'jobs', j.id), sanitizeFirestoreData(jobUpdates), { merge: true }).catch((err) => {
              console.warn('Error syncing cascaded job update to Firestore:', err);
            });
            return updatedJob;
          }
          return j;
        })
      );
    }

    addNotification('Client Updated', 'Client profile updated successfully', 'INFO');
  };

  const deleteClient = (id: string) => {
    const targetClient = clients.find((c) => c.id === id);

    setClients((prev) => prev.filter((c) => c.id !== id));
    setJobs((prev) =>
      prev.filter(
        (j) =>
          j.clientId !== id &&
          !j.id.includes(id) &&
          (!targetClient || j.clientName?.trim().toLowerCase() !== targetClient.name.trim().toLowerCase())
      )
    );

    deleteDoc(doc(db, 'clients', id)).catch((err) => {
      console.warn('Error deleting client doc from Firestore:', err);
    });

    // Delete associated jobs from Firestore (in-memory state)
    jobs.forEach((j) => {
      if (
        j.clientId === id ||
        j.id.includes(id) ||
        (targetClient && j.clientName?.trim().toLowerCase() === targetClient.name.trim().toLowerCase())
      ) {
        if (!j.id.startsWith('virt_')) {
          deleteDoc(doc(db, 'jobs', j.id)).catch(() => {});
        }
      }
    });

    // Query Firestore collection directly to delete all stored jobs and tombstone records linked to this client
    getDocs(collection(db, 'jobs'))
      .then((snapshot) => {
        snapshot.docs.forEach((d) => {
          const data = d.data();
          const isMatching =
            data?.clientId === id ||
            d.id.includes(id) ||
            (targetClient &&
              data?.clientName &&
              data.clientName.trim().toLowerCase() === targetClient.name.trim().toLowerCase());

          if (isMatching) {
            deleteDoc(doc(db, 'jobs', d.id)).catch((err) => {
              console.warn('Error deleting job document for deleted client:', err);
            });
          }
        });
      })
      .catch((err) => {
        console.warn('Error querying jobs collection during client deletion:', err);
      });

    addNotification('Cliente Removido', 'Cliente e agendamentos associados foram removidos com sucesso.', 'WARNING');
  };

  const addJob = (j: Omit<CleaningJob, 'id' | 'companyId'>) => {
    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const newJob: CleaningJob = {
      ...j,
      id: `job_${Date.now()}_${randomSuffix}`,
      companyId: currentCompanyId,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    };
    setJobs((prev) => [newJob, ...prev]);
    setDoc(doc(db, 'jobs', newJob.id), sanitizeFirestoreData(newJob)).catch(() => {});

    if (j.clientId && j.date) {
      const client = clients.find((c) => c.id === j.clientId);
      if (client) {
        const jobDay = new Date(j.date + 'T00:00:00').getDay();
        const clientUpdates: Partial<Client> = {};

        // Only set/move customStartDate if client has no customStartDate or if this job date is earlier
        if (!client.customStartDate || j.date < client.customStartDate) {
          clientUpdates.customStartDate = j.date;
        }
        if (j.frequency) {
          clientUpdates.frequency = j.frequency;
        }
        if (j.customIntervalDays) {
          clientUpdates.customIntervalDays = j.customIntervalDays;
        }
        if (j.customEndDate !== undefined) {
          clientUpdates.customEndDate = j.customEndDate;
        }
        if (client.frequency !== 'CUSTOM_DAYS' && !isNaN(jobDay)) {
          clientUpdates.preferredDayOfWeek = jobDay;
        }
        if (j.cleanerId) {
          clientUpdates.preferredCleanerId = j.cleanerId;
          clientUpdates.preferredCleanerName = j.cleanerName;
        }
        if (Object.keys(clientUpdates).length > 0) {
          updateClient(client.id, clientUpdates);
        }
      }
    }

    addNotification('Cleaning Scheduled', `Scheduled for ${newJob.clientName} on ${newJob.date}`, 'SUCCESS');
  };

  const updateJob = (id: string, updates: Partial<CleaningJob>) => {
    let updatedTargetJob: CleaningJob | undefined;
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id === id) {
          updatedTargetJob = { ...j, ...updates };
          return updatedTargetJob;
        }
        return j;
      })
    );
    setDoc(doc(db, 'jobs', id), sanitizeFirestoreData(updates), { merge: true }).catch((err) => {
      console.warn('Error syncing job update to Firestore:', err);
    });

    if (updatedTargetJob && updatedTargetJob.clientId) {
      const client = clients.find((c) => c.id === updatedTargetJob!.clientId);
      const clientUpdates: Partial<Client> = {};
      if (updates.cleanerId) {
        clientUpdates.preferredCleanerId = updates.cleanerId;
        clientUpdates.preferredCleanerName = updates.cleanerName;
      }
      if (updates.date) {
        if (!client?.customStartDate || updates.date < client.customStartDate) {
          clientUpdates.customStartDate = updates.date;
        }
        const jobDay = new Date(updates.date + 'T00:00:00').getDay();
        if (!isNaN(jobDay) && client?.frequency !== 'CUSTOM_DAYS') {
          clientUpdates.preferredDayOfWeek = jobDay;
        }
      }
      if (Object.keys(clientUpdates).length > 0) {
        updateClient(updatedTargetJob.clientId, clientUpdates);
      }
    }
  };

  const updateJobStatus = (id: string, status: CleaningJob['status']) => {
    let updatedJob: CleaningJob | null = null;
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id === id) {
          const updated = { ...j, status };
          if (status === 'COMPLETED') {
            updated.completedAt = new Date().toISOString();
            updated.paymentStatus = 'PAID';
            confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
          }
          updatedJob = updated;
          return updated;
        }
        return j;
      })
    );

    if (updatedJob) {
      setDoc(doc(db, 'jobs', id), sanitizeFirestoreData(updatedJob)).catch(() => {});
    }

    addNotification('Job Status Updated', `Cleaning status changed to ${status}`, 'INFO');
  };

  const assignCleanerToJob = (jobId: string, cleanerId: string, cleanerName: string) => {
    let updatedJob: CleaningJob | null = null;
    setJobs((prev) =>
      prev.map((j) => {
        if (j.id === jobId) {
          const updated = { ...j, cleanerId, cleanerName, status: 'SCHEDULED' as const };
          updatedJob = updated;
          return updated;
        }
        return j;
      })
    );

    if (updatedJob) {
      setDoc(doc(db, 'jobs', jobId), sanitizeFirestoreData(updatedJob)).catch(() => {});
      if ((updatedJob as CleaningJob).clientId) {
        updateClient((updatedJob as CleaningJob).clientId, {
          preferredCleanerId: cleanerId,
          preferredCleanerName: cleanerName,
        });
      }
    }

    addNotification('Cleaner Assigned', `Assigned ${cleanerName} to job`, 'SUCCESS');
  };

  const checkInJob = (jobId: string, lat = 51.5074, lng = -0.1278) => {
    const now = new Date();
    const timeStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 8)}`;
    let updatedJob: CleaningJob | null = null;

    setJobs((prev) =>
      prev.map((j) => {
        if (j.id === jobId) {
          const updated = {
            ...j,
            status: 'IN_PROGRESS' as const,
            checkInTime: timeStr,
            checkInGps: { lat, lng, address: 'GPS Verified On-Site' },
          };
          updatedJob = updated;
          return updated;
        }
        return j;
      })
    );

    if (updatedJob) {
      setDoc(doc(db, 'jobs', jobId), sanitizeFirestoreData(updatedJob)).catch(() => {});
    }

    addNotification('GPS Check-In', 'Cleaner checked in at job location!', 'SUCCESS');
  };

  const checkOutJob = (jobId: string, lat = 51.5074, lng = -0.1278) => {
    const now = new Date();
    const timeStr = `${now.toISOString().split('T')[0]} ${now.toTimeString().slice(0, 8)}`;
    let updatedJob: CleaningJob | null = null;

    setJobs((prev) =>
      prev.map((j) => {
        if (j.id === jobId) {
          const updated = {
            ...j,
            status: 'COMPLETED' as const,
            paymentStatus: 'PAID' as const,
            checkOutTime: timeStr,
            completedAt: now.toISOString(),
            checkOutGps: { lat, lng, address: 'GPS Verified On-Site' },
          };
          updatedJob = updated;
          return updated;
        }
        return j;
      })
    );

    if (updatedJob) {
      setDoc(doc(db, 'jobs', jobId), sanitizeFirestoreData(updatedJob)).catch(() => {});
    }

    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    addNotification('Job Completed', 'Cleaner completed job and checked out!', 'SUCCESS');
  };

  const addPhotoToJob = (jobId: string, photo: Omit<PhotoRecord, 'id'>) => {
    const newPhoto: PhotoRecord = { ...photo, id: `photo_${Date.now()}` };
    let updatedJob: CleaningJob | null = null;

    setJobs((prev) =>
      prev.map((j) => {
        if (j.id === jobId) {
          const updated = { ...j, photos: [...(j.photos || []), newPhoto] };
          updatedJob = updated;
          return updated;
        }
        return j;
      })
    );

    if (updatedJob) {
      setDoc(doc(db, 'jobs', jobId), sanitizeFirestoreData(updatedJob)).catch(() => {});
    }

    addNotification('Photo Uploaded', `Added ${photo.type} cleaning photo`, 'INFO');
  };

  const saveSignatureToJob = (jobId: string, signatureBase64: string) => {
    let updatedJob: CleaningJob | null = null;

    setJobs((prev) =>
      prev.map((j) => {
        if (j.id === jobId) {
          const updated = { ...j, clientSignature: signatureBase64 };
          updatedJob = updated;
          return updated;
        }
        return j;
      })
    );

    if (updatedJob) {
      setDoc(doc(db, 'jobs', jobId), sanitizeFirestoreData(updatedJob)).catch(() => {});
    }

    addNotification('Signature Saved', 'Client digital signature attached to job', 'SUCCESS');
  };

  const deleteJob = (id: string, jobToDelete?: CleaningJob) => {
    const target = jobToDelete || jobs.find((j) => j.id === id);
    if (target) {
      const isVirtual = id.startsWith('virt_');
      const docId = isVirtual ? `del_${target.clientId}_${target.date}` : id;

      const tombstone: CleaningJob = {
        ...target,
        id: docId,
        isDeleted: true,
        status: 'CANCELLED',
      };

      setDoc(doc(db, 'jobs', docId), sanitizeFirestoreData(tombstone)).catch((err) => {
        console.warn('Error saving deletion tombstone to Firestore:', err);
      });

      if (!isVirtual && docId !== id) {
        deleteDoc(doc(db, 'jobs', id)).catch(() => {});
      }

      setJobs((prev) => prev.filter((j) => j.id !== id && j.id !== docId).concat([tombstone]));
    } else {
      deleteDoc(doc(db, 'jobs', id)).catch(() => {});
      setJobs((prev) => prev.filter((j) => j.id !== id));
    }
    addNotification('Agendamento Removido', 'Agendamento excluído da agenda com sucesso.', 'WARNING');
  };

  const clearAllScheduleJobs = () => {
    setJobs([]);
    const globalClearDoc: CleaningJob = {
      id: 'global_schedule_clear',
      companyId: currentCompanyId || 'comp_wj_london',
      clientId: '',
      clientName: 'GLOBAL_CLEAR',
      address: '',
      postcode: '',
      city: '',
      phone: '',
      whatsapp: '',
      cleanerId: '',
      cleanerName: '',
      date: '2026-01-01',
      startTime: '00:00',
      estimatedDuration: 0,
      price: 0,
      status: 'CANCELLED',
      paymentStatus: 'PENDING',
      isDeleted: true,
      createdAt: new Date().toISOString(),
      notes: `ALL_SCHEDULE_CLEARED_${Date.now()}`,
    };

    setDoc(doc(db, 'jobs', 'global_schedule_clear'), sanitizeFirestoreData(globalClearDoc)).catch((err) => {
      console.warn('Error saving global clear doc:', err);
    });

    getDocs(collection(db, 'jobs'))
      .then((snapshot) => {
        snapshot.docs.forEach((d) => {
          if (d.id !== 'global_schedule_clear') {
            deleteDoc(doc(db, 'jobs', d.id)).catch(() => {});
          }
        });
      })
      .catch((err) => {
        console.warn('Error clearing jobs collection in Firestore:', err);
      });
    addNotification('Agenda Limpa', 'Todos os agendamentos da agenda foram totalmente removidos.', 'WARNING');
  };

  // Helper for auto-generating recurring schedule
  const autoGenerateRecurringJobsInternal = (client: Client, weeksAhead = 8) => {
    const newJobs: CleaningJob[] = [];
    const preferredDay = client.preferredDayOfWeek ?? 1;
    const baseDateStr = client.customStartDate || client.createdAt || new Date().toISOString().split('T')[0];
    
    const base = new Date(baseDateStr + 'T00:00:00');
    const currentDay = isNaN(base.getTime()) ? 1 : base.getDay();
    let diff = preferredDay - currentDay;
    if (diff < 0) diff += 7;
    const startDate = new Date((isNaN(base.getTime()) ? new Date() : base).getTime() + diff * 86400000);

    const cleanerId = client.preferredCleanerId || 'usr_waylla';
    const cleanerName = client.preferredCleanerName || 'Waylla';

    let intervalDays = 7;
    if (client.frequency === 'FORTNIGHTLY') intervalDays = 14;
    if (client.frequency === 'MONTHLY') intervalDays = 28;
    if (client.frequency === 'CUSTOM_DAYS') intervalDays = client.customIntervalDays || 20;
    if (client.frequency === 'ONE_OFF') weeksAhead = 1;

    for (let i = 0; i < weeksAhead; i++) {
      const targetDate = new Date(startDate.getTime() + i * intervalDays * 86400000);
      const dateStr = targetDate.toISOString().split('T')[0];

      const autoJob: CleaningJob = {
        id: `job_auto_${client.id}_${i}_${Date.now()}`,
        companyId: client.companyId,
        clientId: client.id,
        clientName: client.name,
        address: client.address,
        postcode: client.postcode,
        city: client.city,
        phone: client.phone,
        whatsapp: client.whatsapp,
        cleanerId,
        cleanerName,
        date: dateStr,
        startTime: client.preferredTime || '09:00',
        estimatedDuration: client.estimatedDuration,
        price: client.defaultPrice,
        status: 'SCHEDULED',
        paymentStatus: 'PENDING',
        keyDetails: client.keyDetails,
        alarmCode: client.alarmCode,
        hasPets: client.hasPets,
        petNotes: client.petNotes,
        invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      };

      newJobs.push(autoJob);
      setDoc(doc(db, 'jobs', autoJob.id), autoJob).catch(() => {});

      if (client.frequency === 'ONE_OFF') break;
    }

    setJobs((prev) => [...newJobs, ...prev]);
  };

  const autoGenerateRecurringJobs = (clientId: string, weeksAhead = 8) => {
    const c = clients.find((x) => x.id === clientId);
    if (c) {
      autoGenerateRecurringJobsInternal(c, weeksAhead);
      addNotification('Smart Agenda Updated', `Created next ${weeksAhead} recurring cleans for ${c.name}`, 'SUCCESS');
    }
  };

  const addExpense = (exp: Omit<Expense, 'id' | 'companyId'>) => {
    const newExpense: Expense = {
      ...exp,
      id: `exp_${Date.now()}`,
      companyId: currentCompanyId,
    };
    const sanitized = sanitizeFirestoreData(newExpense);
    setExpenses((prev) => [sanitized, ...prev]);
    setDoc(doc(db, 'expenses', sanitized.id), sanitized).catch(() => {});
    addNotification('Despesa Registrada', `Registrada £${newExpense.amount} em ${newExpense.category}`, 'INFO');
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === id ? { ...e, ...updates } : e))
    );
    const sanitized = sanitizeFirestoreData(updates);
    updateDoc(doc(db, 'expenses', id), sanitized).catch(() => {});
    addNotification('Despesa Atualizada', `Despesa atualizada com sucesso.`, 'INFO');
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    deleteDoc(doc(db, 'expenses', id)).catch(() => {});
    addNotification('Despesa Removida', `Despesa excluída.`, 'WARNING');
  };

  const addPayrollPayment = (paymentData: Omit<PayrollPayment, 'id' | 'companyId' | 'paidAt'>) => {
    const newPayment: PayrollPayment = {
      ...paymentData,
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      companyId: currentCompanyId,
      paidAt: new Date().toISOString(),
    };
    const sanitized = sanitizeFirestoreData(newPayment);
    setPayrollPayments((prev) => [sanitized, ...prev]);
    setDoc(doc(db, 'payrollPayments', sanitized.id), sanitized).catch(() => {});
    addNotification(
      'Pagamento Registrado',
      `Pagamento de £${sanitized.amount.toFixed(2)} registrado para ${sanitized.staffName}`,
      'SUCCESS'
    );
  };

  const deletePayrollPayment = (id: string) => {
    setPayrollPayments((prev) => prev.filter((p) => p.id !== id));
    deleteDoc(doc(db, 'payrollPayments', id)).catch(() => {});
    addNotification('Pagamento Excluído', `Registro de pagamento removido com sucesso.`, 'WARNING');
  };

  const clearStaffPayrollPayments = (staffId: string) => {
    setPayrollPayments((prev) => {
      const remaining = prev.filter((p) => p.staffId !== staffId);
      const toDelete = prev.filter((p) => p.staffId === staffId);
      toDelete.forEach((p) => {
        deleteDoc(doc(db, 'payrollPayments', p.id)).catch(() => {});
      });
      return remaining;
    });
    addNotification('Histórico Limpo', `Todo o histórico de pagamentos do colaborador foi removido.`, 'WARNING');
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const addNotification = (title: string, message: string, type: NotificationItem['type'] = 'INFO') => {
    const item: NotificationItem = {
      id: `notif_${Date.now()}`,
      title,
      message,
      timestamp: 'Just now',
      type,
      read: false,
    };
    setNotifications((prev) => [item, ...prev.slice(0, 19)]);
  };

  const value = useMemo(
    () => ({
      isAuthenticated,
      loginWithEmailPassword,
      registerNewStaff,
      logout,
      companies,
      currentCompany,
      setCurrentCompanyId,
      addCompany,
      updateCompany,
      users: companyUsers,
      allUsers: users,
      currentUser,
      setCurrentUserId,
      addUser,
      updateUser,
      deleteUser,
      reassignUserJobs,
      userRole,
      isSuperAdmin,
      language,
      setLanguage,
      theme,
      setTheme,
      activeTab,
      setActiveTab,
      clients: companyClients,
      addClient,
      updateClient,
      deleteClient,
      jobs: companyJobs,
      addJob,
      updateJob,
      updateJobStatus,
      assignCleanerToJob,
      checkInJob,
      checkOutJob,
      addPhotoToJob,
      saveSignatureToJob,
      deleteJob,
      clearAllScheduleJobs,
      autoGenerateRecurringJobs,
      expenses: companyExpenses,
      addExpense,
      updateExpense,
      deleteExpense,
      payrollPayments: companyPayrollPayments,
      addPayrollPayment,
      deletePayrollPayment,
      clearStaffPayrollPayments,
      notifications,
      markNotificationRead,
      addNotification,
      userLocation,
      locationPermissionState,
      requestLocationPermission,
    }),
    [
      isAuthenticated,
      companies,
      currentCompany,
      currentCompanyId,
      users,
      companyUsers,
      currentUser,
      userRole,
      language,
      setLanguage,
      theme,
      setTheme,
      activeTab,
      companyClients,
      companyJobs,
      companyExpenses,
      companyPayrollPayments,
      notifications,
      userLocation,
      locationPermissionState,
      requestLocationPermission,
    ]
  );

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
