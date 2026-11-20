"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile as fbUpdateProfile,
  type User,
} from "firebase/auth";
import { firebaseAuth, isFirebaseConfigured } from "@/lib/firebase";
import { raw, setChurchScope, store } from "@/lib/store";
import { nowISO } from "@/lib/dates";
import { sortServices } from "@/lib/scheduling";
import { setChurchAccent } from "@/lib/theme";
import { switchChurch as switchChurchAction } from "@/lib/tenancy";
import type { Account, AppNotification, Assignment, Church, Ministry, Service, UserProfile } from "@/lib/types";

const DEMO_USER_KEY = "graceflow-demo-user";

interface AppState {
  ready: boolean;
  demo: boolean;
  uid: string | null;
  /** Global login account (which churches this person belongs to) */
  account: Account | null;
  /** Churches this account belongs to */
  churches: Church[];
  /** The church currently open — everything below is scoped to it */
  church: Church | null;
  me: UserProfile | null;
  users: UserProfile[];
  ministries: Ministry[];
  services: Service[];
  assignments: Assignment[];
  notifications: AppNotification[];
  switchChurch(id: string): Promise<void>;
  loginEmail(email: string, password: string): Promise<void>;
  registerEmail(name: string, email: string, password: string): Promise<void>;
  loginGoogle(): Promise<void>;
  loginDemo(uid: string): void;
  createDemoAccount(name: string): Promise<void>;
  logout(): Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

async function ensureAccount(user: User, name?: string) {
  const existing = await raw.get<Account>(`users/${user.uid}`);
  if (existing) return;
  const account: Account = {
    id: user.uid,
    email: user.email ?? "",
    name: name || user.displayName || user.email?.split("@")[0] || "Pelayan",
    churchIds: [],
    activeChurchId: null,
    createdAt: nowISO(),
  };
  await raw.set(`users/${user.uid}`, account);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [authReady, setAuthReady] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null | undefined>(undefined);
  const [churchMap, setChurchMap] = useState<Record<string, Church>>({});
  const [loadedChurch, setLoadedChurch] = useState<string | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [ministries, setMinistries] = useState<Ministry[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // --- auth ---
  useEffect(() => {
    if (!isFirebaseConfigured) {
      try {
        setUid(localStorage.getItem(DEMO_USER_KEY));
      } catch {
        /* ignore */
      }
      setAuthReady(true);
      return;
    }
    return onAuthStateChanged(firebaseAuth(), async (user) => {
      if (user) {
        try {
          await ensureAccount(user);
        } catch (e) {
          console.error("Could not create account", e);
        }
      }
      setUid(user?.uid ?? null);
      setAuthReady(true);
    });
  }, []);

  // --- global account ---
  useEffect(() => {
    if (!uid) {
      setAccount(undefined);
      return;
    }
    return raw.subscribeDoc<Account>(`users/${uid}`, (a) => setAccount(a));
  }, [uid]);

  // --- church docs for every church this account belongs to ---
  const churchKey = (account?.churchIds ?? []).join(",");
  useEffect(() => {
    if (!churchKey) {
      setChurchMap({});
      return;
    }
    const ids = churchKey.split(",");
    const unsubs = ids.map((id) =>
      raw.subscribeDoc<Church>(`churches/${id}`, (c) =>
        setChurchMap((m) => {
          const next = { ...m };
          if (c) next[id] = c;
          else delete next[id];
          return next;
        }),
      ),
    );
    return () => unsubs.forEach((u) => u());
  }, [churchKey]);

  const ids = account?.churchIds ?? [];
  const activeChurchId = account?.activeChurchId && ids.includes(account.activeChurchId) ? account.activeChurchId : ids[0] ?? null;

  // --- data of the active church ---
  useEffect(() => {
    setLoadedChurch(null);
    setChurchScope(uid ? activeChurchId : null);
    if (!uid || !activeChurchId) {
      setUsers([]);
      setMinistries([]);
      setServices([]);
      setAssignments([]);
      setNotifications([]);
      return;
    }
    const unsubs = [
      store.subscribe<UserProfile>("users", (u) => {
        setUsers(u.sort((a, b) => a.name.localeCompare(b.name)));
        setLoadedChurch(activeChurchId);
      }),
      store.subscribe<Ministry>("ministries", (m) => setMinistries(m.sort((a, b) => a.order - b.order))),
      store.subscribe<Service>("services", (s) => setServices(s.sort(sortServices))),
      store.subscribe<Assignment>("assignments", setAssignments),
      store.subscribe<AppNotification>(
        "notifications",
        (n) => setNotifications(n.sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
        { field: "userId", value: uid },
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid, activeChurchId]);

  const church = activeChurchId ? churchMap[activeChurchId] ?? null : null;

  // church default accent (a personal accent on the device still wins)
  useEffect(() => {
    setChurchAccent(church?.accent ?? null);
  }, [church?.accent]);

  const loginDemo = useCallback((id: string) => {
    try {
      localStorage.setItem(DEMO_USER_KEY, id);
    } catch {
      /* ignore */
    }
    setUid(id);
  }, []);

  const logout = useCallback(async () => {
    setChurchScope(null);
    if (isFirebaseConfigured) await signOut(firebaseAuth());
    else {
      try {
        localStorage.removeItem(DEMO_USER_KEY);
      } catch {
        /* ignore */
      }
      setUid(null);
    }
  }, []);

  const value = useMemo<AppState>(() => {
    const me = users.find((u) => u.id === uid) ?? null;
    const accountLoaded = account !== undefined;
    return {
      ready: authReady && (!uid || (accountLoaded && (!activeChurchId || loadedChurch === activeChurchId))),
      demo: !isFirebaseConfigured,
      uid,
      account: account ?? null,
      churches: ids.map((id) => churchMap[id]).filter(Boolean),
      church,
      me,
      users: users.filter((u) => !u.deleted),
      ministries,
      services,
      assignments,
      notifications,
      async switchChurch(id) {
        if (account) await switchChurchAction(account, id);
      },
      async loginEmail(email, password) {
        await signInWithEmailAndPassword(firebaseAuth(), email, password);
      },
      async registerEmail(name, email, password) {
        const cred = await createUserWithEmailAndPassword(firebaseAuth(), email, password);
        await fbUpdateProfile(cred.user, { displayName: name });
        await ensureAccount(cred.user, name);
      },
      async loginGoogle() {
        await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
      },
      loginDemo,
      async createDemoAccount(name) {
        const id = `u-${Math.random().toString(36).slice(2, 10)}`;
        const acc: Account = {
          id,
          name,
          email: `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@demo.gia`,
          churchIds: [],
          activeChurchId: null,
          createdAt: nowISO(),
        };
        await raw.set(`users/${id}`, acc);
        loginDemo(id);
      },
      logout,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, uid, account, churchMap, church, activeChurchId, loadedChurch, users, ministries, services, assignments, notifications, loginDemo, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside AppProvider");
  return v;
}

/** Ministries the current user may schedule. */
export function useCoordinatedMinistries() {
  const { me, ministries } = useApp();
  if (!me) return [];
  if (me.role === "superadmin") return ministries;
  return ministries.filter((m) => me.coordinatorOf.includes(m.id));
}
