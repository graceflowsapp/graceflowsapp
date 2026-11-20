"use client";

import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { doc, getFirestore, setDoc } from "firebase/firestore";
import { firebaseApp, isFirebaseConfigured } from "./firebase";
import { raw, store } from "./store";
import { nowISO } from "./dates";
import type { Account, Assignment, UserProfile } from "./types";

export interface NewAccount {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: UserProfile["role"];
  ministries: string[];
  coordinatorOf: string[];
}

/**
 * A church Admin registers a new user directly into their church.
 * Firebase: the Auth account is created in a *secondary* app instance so the admin stays signed in;
 * that instance (signed in as the new user) writes the user's own global account doc, then the
 * admin writes the church membership (allowed for church admins by firestore.rules).
 */
export async function createAccount(churchId: string, data: NewAccount): Promise<string> {
  let uid: string;
  const account = (id: string): Account => ({
    id,
    email: data.email,
    name: data.name,
    churchIds: [churchId],
    activeChurchId: churchId,
    createdAt: nowISO(),
  });

  if (isFirebaseConfigured) {
    const secondary = initializeApp(firebaseApp().options, `create-${Date.now()}`);
    try {
      const auth = getAuth(secondary);
      const cred = await createUserWithEmailAndPassword(auth, data.email, data.password);
      uid = cred.user.uid;
      await setDoc(doc(getFirestore(secondary), "users", uid), account(uid));
      await signOut(auth);
    } finally {
      await deleteApp(secondary);
    }
  } else {
    uid = `u-${Math.random().toString(36).slice(2, 10)}`;
    await raw.set(`users/${uid}`, account(uid));
  }

  const profile: UserProfile = {
    id: uid,
    name: data.name,
    email: data.email,
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
