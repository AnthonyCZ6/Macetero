"use client";

import { useCallback, useEffect, useState } from "react";

const KEY_ID = "macetero_user_id";
const KEY_NAME = "macetero_display_name";
const KEY_PHONE = "macetero_phone";
const KEY_EMAIL = "macetero_email";

export function useBackendUser() {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [phone, setPhoneState] = useState<string | null>(null);
  const [email, setEmailState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setUserIdState(window.localStorage.getItem(KEY_ID));
    setDisplayNameState(window.localStorage.getItem(KEY_NAME));
    setPhoneState(window.localStorage.getItem(KEY_PHONE));
    setEmailState(window.localStorage.getItem(KEY_EMAIL));
    setHydrated(true);
  }, []);

  const setUserId = useCallback((id: string | null) => {
    if (id) window.localStorage.setItem(KEY_ID, id);
    else window.localStorage.removeItem(KEY_ID);
    setUserIdState(id);
  }, []);

  const setDisplayName = useCallback((name: string | null) => {
    if (name) window.localStorage.setItem(KEY_NAME, name);
    else window.localStorage.removeItem(KEY_NAME);
    setDisplayNameState(name);
  }, []);

  const setPhone = useCallback((p: string | null) => {
    if (p) window.localStorage.setItem(KEY_PHONE, p);
    else window.localStorage.removeItem(KEY_PHONE);
    setPhoneState(p);
  }, []);

  const setEmail = useCallback((e: string | null) => {
    if (e) window.localStorage.setItem(KEY_EMAIL, e);
    else window.localStorage.removeItem(KEY_EMAIL);
    setEmailState(e);
  }, []);

  const clearSession = useCallback(() => {
    window.localStorage.removeItem(KEY_ID);
    window.localStorage.removeItem(KEY_NAME);
    window.localStorage.removeItem(KEY_PHONE);
    window.localStorage.removeItem(KEY_EMAIL);
    setUserIdState(null);
    setDisplayNameState(null);
    setPhoneState(null);
    setEmailState(null);
  }, []);

  return {
    userId,
    displayName,
    phone,
    email,
    setUserId,
    setDisplayName,
    setPhone,
    setEmail,
    clearSession,
    hydrated,
    hasBackendUser: Boolean(userId),
  };
}
