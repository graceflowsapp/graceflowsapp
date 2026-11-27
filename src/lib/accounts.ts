"use client";

import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import { firebaseApp, isFirebaseConfigured } from "./firebase";
import { raw, store } from "./store";
import { nowISO } from "./dates";
import type { Account, Assignment, UserProfile } from "./types";
import { normalizeUsername, placeholderEmail, usernameError, type UsernameDoc } from "./username";
import { tr } from "@/lib/i18n";

export interface NewAccount {
  name: string;
  /** Login username; the person connects their own email later (Profil → Akun & login). */
  username: string;
  password: string;
  phone?: string;
  role: UserProfile["role"];
  ministries: string[];
  coordinatorOf: string[];
}

const taken = () => Object.assign(new Error(tr("Username sudah dipakai, coba yang lain.")), { code: "app/username-taken" });

/**
 * A church Admin registers a new user directly into their church, with a USERNAME (no email).
 * Firebase: the Auth account (placeholder login email, see lib/username.ts) is created in a *secondary* app
 * instance so the admin stays signed in; that instance (signed in as the new user) claims usernames/{username}
 * and writes the user's own global account doc, then the admin writes the church membership
 * (allowed for church admins by firestore.rules).
 */
export async function createAccount(churchId: string, data: NewAccount): Promise<string> {
  const u = normalizeUsername(data.username);
  const problem = usernameError(u);
  if (problem) throw Object.assign(new Error(problem), { code: "app/invalid-username" });
  if (await raw.get(`usernames/${u}`)) throw taken();

  let uid: string;
  const account = (id: string): Account => ({
    id,
    email: "",
    username: u,
    name: data.name,
    churchIds: [churchId],
    activeChurchId: churchId,
    createdAt: nowISO(),
  });

  if (isFirebaseConfigured) {
    const secondary = initializeApp(firebaseApp().options, `create-${Date.now()}`);
    try {
      const auth = getAuth(secondary);
      const email = placeholderEmail(u);
      let cred;
      try {
        cred = await createUserWithEmailAndPassword(auth, email, data.password);
      } catch (e) {
        if ((e as { code?: string }).code?.includes("email-already-in-use")) throw taken();
        throw e;
      }
      uid = cred.user.uid;
      const db = getFirestore(secondary);
      try {
        await setDoc(doc(db, "usernames", u), { uid, username: u, email } satisfies UsernameDoc);
      } catch {
        // claimed by someone else a moment earlier → undo the half-created login
        await cred.user.delete().catch(() => undefined);
        throw taken();
      }
      await setDoc(doc(db, "users", uid), account(uid));
      await signOut(auth);
    } finally {
      await deleteApp(secondary);
    }
  } else {
    uid = `u-${Math.random().toString(36).slice(2, 10)}`;
    await raw.set(`usernames/${u}`, { uid, username: u, email: "" } satisfies UsernameDoc);
    await raw.set(`users/${uid}`, account(uid));
  }

  const profile: UserProfile = {
    id: uid,
    name: data.name,
    email: "",
    username: u,
    phone: data.phone,
    role: data.role,
    ministries: data.ministries,
    coordinatorOf: data.role === "servant" ? [] : data.coordinatorOf,
    skills: [],
    available: true,
    active: true,
    createdAt: nowISO(),
  };
  await store.set("users", uid, profile);
  return uid;
}

export async function setAccountActive(user: UserProfile, active: boolean, assignments: Assignment[], today: string, serviceDate: (id: string) => string) {
  await store.update("users", user.id, { active });
  if (!active) await clearFutureAssignments(user, assignments, today, serviceDate);
}

/**
 * Removes the person from THIS church only (their login and other churches are untouched).
 * Firebase keeps a soft-deleted record so the membership can't silently come back.
 */
export async function deleteAccount(user: UserProfile, assignments: Assignment[], today: string, serviceDate: (id: string) => string) {
  await clearFutureAssignments(user, assignments, today, serviceDate);
  if (isFirebaseConfigured) {
    await store.update("users", user.id, { active: false, deleted: true });
  } else {
    await store.remove("users", user.id);
  }
}

async function clearFutureAssignments(user: UserProfile, assignments: Assignment[], today: string, serviceDate: (id: string) => string) {
  const future = assignments.filter((a) => a.userId === user.id && serviceDate(a.serviceId) >= today);
  await Promise.all(future.map((a) => store.remove("assignments", a.id)));
}
