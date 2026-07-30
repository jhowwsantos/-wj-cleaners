import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
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
  loginWithEmailPassword: (email: string, pass: string) => Promise<boolean>;
  registerNewStaff: (user: Omit<User, 'id'> & { password?: string }) => Promise<void>;
  logout: () => void;

  // SaaS & Role
  companies: Company[];
  currentCompany: Company;
  setCurrentCompanyId: (id: string) => void;
  addCompany: (comp: Omit<Company, 'id'>) => void;
  updateCompany: (id: string, updates: Partial<Company>) => void;
  users: User[];
  currentUser: User;
  setCurrentUserId: (id: string) => void;
  addUser: (user: Omit<User, 'id'>) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  deleteUser: (id: string) => void;
  reassignUserJobs: (fromCleanerId: string, toCleanerId: string, toCleanerName: string) => void;
  userRole: UserRole;

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
  autoGenerateRecurringJobs: (clientId: string, weeksAhead?: number) => void;

  // Expenses & Financials
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, 'id' | 'companyId'>) => void;
  deleteExpense: (id: string) => void;

  // Notifications
  notifications: NotificationItem[];
  markNotificationRead: (id: string) => void;
  addNotification: (title: string, message: string, type?: NotificationItem['type']) => void;
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
    return companies[0]?.id || 'comp_wj_london';
  });

  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_users`);
    let result = INITIAL_USERS;
    if (saved) {
      try {
        const parsed: User[] = JSON.parse(saved);
        if (parsed.length > 0) {
          result = parsed;
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
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_current_user`);
    return saved || 'usr_jhonatan';
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_is_authenticated`);
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

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_clients`);
    if (saved) {
      try {
        const parsed: Client[] = JSON.parse(saved);
        if (parsed.some((c) => c.id === 'cli_scott' || c.id === 'cli_cece')) {
          return parsed;
        }
      } catch (err) {
        // Fallback
      }
    }
    return INITIAL_CLIENTS;
  });

  const [jobs, setJobs] = useState<CleaningJob[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_jobs`);
    if (saved) {
      try {
        const parsed: CleaningJob[] = JSON.parse(saved);
        if (parsed.some((j) => j.clientId === 'cli_cece' || j.clientId === 'cli_scott')) {
          return parsed;
        }
      } catch (err) {
        // Fallback
      }
    }
    return INITIAL_JOBS;
  });

  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_expenses`);
    return saved ? JSON.parse(saved) : INITIAL_EXPENSES;
  });

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
    const isSuperOwner = u && (
      u.email?.toLowerCase() === 'jhonatandossantos25@gmail.com' || 
      u.email?.toLowerCase() === 'jhonatan@wjcleaners.co.uk' ||
      u.email?.toLowerCase() === 'wayllasilva031@gmail.com' ||
      u.email?.toLowerCase() === 'waylla@wjcleaners.co.uk' ||
      u.id === 'usr_jhonatan' ||
      u.id === 'usr_waylla'
    );
    if (isSuperOwner) {
      return {
        ...u,
        role: 'OWNER' as UserRole,
        active: true,
      };
    }
    return u;
  }, [users, currentUserId]);

  const userRole: UserRole = useMemo(() => {
    const isSuperOwner = currentUser?.email?.toLowerCase() === 'jhonatandossantos25@gmail.com' || 
      currentUser?.email?.toLowerCase() === 'jhonatan@wjcleaners.co.uk' ||
      currentUser?.email?.toLowerCase() === 'wayllasilva031@gmail.com' ||
      currentUser?.email?.toLowerCase() === 'waylla@wjcleaners.co.uk' ||
      currentUser?.id === 'usr_jhonatan' ||
      currentUser?.id === 'usr_waylla';
    if (isSuperOwner) {
      return 'OWNER' as UserRole;
    }
    return currentUser?.role || 'OWNER';
  }, [currentUser]);

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
    const unsubClients = onSnapshot(collection(db, 'clients'), (snapshot) => {
      if (snapshot.empty) {
        // Seed Firestore if empty
        INITIAL_CLIENTS.forEach((c) => {
          setDoc(doc(db, 'clients', c.id), c).catch(() => {});
        });
        setClients(INITIAL_CLIENTS);
      } else {
        const docs = snapshot.docs.map((d) => d.data() as Client);
        setClients(docs);
      }
    });

    // 2. Jobs listener
    const unsubJobs = onSnapshot(collection(db, 'jobs'), (snapshot) => {
      if (snapshot.empty) {
        INITIAL_JOBS.forEach((j) => {
          setDoc(doc(db, 'jobs', j.id), j).catch(() => {});
        });
        setJobs(INITIAL_JOBS);
      } else {
        const docs = snapshot.docs.map((d) => d.data() as CleaningJob);
        setJobs(docs);
      }
    });

    // 3. Expenses listener
    const unsubExpenses = onSnapshot(collection(db, 'expenses'), (snapshot) => {
      if (snapshot.empty) {
        INITIAL_EXPENSES.forEach((e) => {
          setDoc(doc(db, 'expenses', e.id), e).catch(() => {});
        });
        setExpenses(INITIAL_EXPENSES);
      } else {
        const docs = snapshot.docs.map((d) => d.data() as Expense);
        setExpenses(docs);
      }
    });

    // 4. Users listener
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      if (snapshot.empty) {
        INITIAL_USERS.forEach((u) => {
          setDoc(doc(db, 'users', u.id), u).catch(() => {});
        });
        setUsers(INITIAL_USERS);
      } else {
        const docs: User[] = [];
        snapshot.docs.forEach((d) => {
          const u = d.data() as User;
          if (u.email?.toLowerCase() === 'teste@wjcleaners.co.uk' || u.id === 'usr_teste' || d.id === 'usr_teste') {
            deleteDoc(doc(db, 'users', d.id)).catch(() => {});
          } else {
            docs.push(u);
          }
        });
        setUsers(docs);
      }
    });

    // 5. Companies listener
    const unsubCompanies = onSnapshot(collection(db, 'companies'), (snapshot) => {
      if (snapshot.empty) {
        INITIAL_COMPANIES.forEach((comp) => {
          setDoc(doc(db, 'companies', comp.id), comp).catch(() => {});
        });
        setCompanies(INITIAL_COMPANIES);
      } else {
        const docs = snapshot.docs.map((d) => d.data() as Company);
        setCompanies(docs);
      }
    });

    // 6. Firebase Auth listener for seamless auth state persistence
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
  const loginWithEmailPassword = async (email: string, pass: string): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      throw new Error('Usuário não encontrado');
    }

    // 1. Look for matching user profile in application state or INITIAL_USERS
    const matchedUser = users.find((u) => u.email.toLowerCase() === cleanEmail) ||
                        INITIAL_USERS.find((u) => u.email.toLowerCase() === cleanEmail) ||
                        (cleanEmail === 'jhonatandossantos25@gmail.com' ? users.find((u) => u.id === 'usr_jhonatan') : undefined) ||
                        (cleanEmail === 'wayllasilva031@gmail.com' ? users.find((u) => u.id === 'usr_waylla') : undefined);

    // 2. Attempt Firebase Authentication
    let firebaseAuthenticated = false;
    let firebaseError: any = null;

    try {
      await signInWithEmailAndPassword(auth, cleanEmail, pass);
      firebaseAuthenticated = true;
    } catch (authErr: any) {
      firebaseError = authErr;
    }

    // 3. If user doesn't exist locally and Firebase Auth failed, throw User Not Found
    if (!matchedUser && !firebaseAuthenticated) {
      throw new Error('Usuário não encontrado');
    }

    // 4. Determine expected password for local profile
    const expectedPassword = matchedUser?.password || '123456';

    // 5. Successful Firebase Auth sign-in
    if (firebaseAuthenticated) {
      const isSuperOwnerEmail = cleanEmail === 'jhonatandossantos25@gmail.com' || cleanEmail === 'wayllasilva031@gmail.com';
      const userObj = matchedUser || {
        id: `usr_${Date.now()}`,
        companyId: currentCompany?.id || 'comp_wj_london',
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        phone: '',
        role: isSuperOwnerEmail ? ('OWNER' as UserRole) : ('CLEANER' as UserRole),
        active: true,
      };

      setCurrentUserIdState(userObj.id);
      setIsAuthenticated(true);
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_current_user`, userObj.id);
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_is_authenticated`, 'true');

      if (userObj.role === 'CLEANER') {
        setActiveTab('schedule');
      } else {
        setActiveTab('dashboard');
      }

      addNotification('Bem-vindo(a)!', `Conectado com sucesso como ${userObj.name}`, 'SUCCESS');
      return true;
    }

    // 6. Firebase Auth threw an error, validate against matchedUser password
    if (matchedUser) {
      if (pass !== expectedPassword) {
        throw new Error('Senha incorreta');
      }

      // Password matches local profile! Sync account to Firebase Auth
      if (firebaseError?.code === 'auth/user-not-found' || firebaseError?.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        } catch {
          // Ignore if user creation failed
        }
      }

      setCurrentUserIdState(matchedUser.id);
      setIsAuthenticated(true);
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_current_user`, matchedUser.id);
      localStorage.setItem(`${LOCAL_STORAGE_KEY}_is_authenticated`, 'true');

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
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_is_authenticated`, 'false');
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
      hourlyRate: data.hourlyRate || 14,
      password: data.password,
      mustChangePassword: data.mustChangePassword ?? true,
    };

    setUsers((prev) => [...prev, newUser]);
    await setDoc(doc(db, 'users', newUser.id), newUser);
    addNotification('Funcionário Cadastrado', `${newUser.name} foi adicionado como ${newUser.role}`, 'SUCCESS');
  };

  // Actions
  const setCurrentCompanyId = (id: string) => {
    setCurrentCompanyIdState(id);
    addNotification('Switched Branch', `Now operating under ${companies.find((c) => c.id === id)?.name}`, 'INFO');
  };

  const setCurrentUserId = (id: string) => {
    setCurrentUserIdState(id);
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_current_user`, id);
    const u = users.find((x) => x.id === id);
    if (u) {
      addNotification('Usuario Alterado', `Conectado como ${u.name} (${u.role})`, 'INFO');
    }
  };

  const addCompany = (comp: Omit<Company, 'id'>) => {
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
    setCompanies((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    setDoc(doc(db, 'companies', id), updates, { merge: true }).catch((err) => {
      console.warn('Error updating company in Firestore:', err);
    });
    addNotification('Empresa Atualizada', 'Configurações de Base Operacional salvas com sucesso.', 'SUCCESS');
  };

  const addUser = (user: Omit<User, 'id'>) => {
    const newUser: User = { ...user, id: `usr_${Date.now()}` };
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

    // Automatically generate future recurring jobs
    autoGenerateRecurringJobsInternal(newClient, 8);
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
    setClients((prev) => prev.filter((c) => c.id !== id));
    setJobs((prev) => prev.filter((j) => j.clientId !== id));
    deleteDoc(doc(db, 'clients', id)).catch(() => {});

    // Delete associated jobs from Firestore
    jobs.forEach((j) => {
      if (j.clientId === id || j.id.includes(id)) {
        if (!j.id.startsWith('virt_')) {
          deleteDoc(doc(db, 'jobs', j.id)).catch(() => {});
        }
      }
    });

    addNotification('Cliente Removido', 'Cliente e agendamentos associados foram removidos com sucesso.', 'WARNING');
  };

  const addJob = (j: Omit<CleaningJob, 'id' | 'companyId'>) => {
    const newJob: CleaningJob = {
      ...j,
      id: `job_${Date.now()}`,
      companyId: currentCompanyId,
      invoiceNumber: `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    };
    setJobs((prev) => [newJob, ...prev]);
    setDoc(doc(db, 'jobs', newJob.id), sanitizeFirestoreData(newJob)).catch(() => {});
    addNotification('Cleaning Scheduled', `Scheduled for ${newJob.clientName} on ${newJob.date}`, 'SUCCESS');
  };

  const updateJob = (id: string, updates: Partial<CleaningJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
    setDoc(doc(db, 'jobs', id), sanitizeFirestoreData(updates), { merge: true }).catch((err) => {
      console.warn('Error syncing job update to Firestore:', err);
    });
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

  // Helper for auto-generating recurring schedule
  const autoGenerateRecurringJobsInternal = (client: Client, weeksAhead = 8) => {
    const newJobs: CleaningJob[] = [];
    const startDate = new Date();

    let intervalDays = 7;
    if (client.frequency === 'FORTNIGHTLY') intervalDays = 14;
    if (client.frequency === 'MONTHLY') intervalDays = 28;
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
        cleanerId: 'usr_cleaner_1',
        cleanerName: 'Carlos Oliveira',
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
    setExpenses((prev) => [newExpense, ...prev]);
    setDoc(doc(db, 'expenses', newExpense.id), newExpense).catch(() => {});
    addNotification('Expense Logged', `Logged £${newExpense.amount} under ${newExpense.category}`, 'INFO');
  };

  const deleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    deleteDoc(doc(db, 'expenses', id)).catch(() => {});
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
      users,
      currentUser,
      setCurrentUserId,
      addUser,
      updateUser,
      deleteUser,
      reassignUserJobs,
      userRole,
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
      autoGenerateRecurringJobs,
      expenses: companyExpenses,
      addExpense,
      deleteExpense,
      notifications,
      markNotificationRead,
      addNotification,
    }),
    [
      isAuthenticated,
      companies,
      currentCompany,
      currentCompanyId,
      users,
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
      notifications,
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
