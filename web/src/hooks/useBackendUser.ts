"use client";

import { useCallback, useEffect, useState } from "react";

const KEY_ID = "macetero_user_id";
const KEY_NAME = "macetero_display_name";
const KEY_PHONE = "macetero_phone";
const KEY_EMAIL = "macetero_email";

type Me = {
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type MeResult =
  | { kind: "user"; me: Me }
  /** El servidor respondió 401: no hay sesión válida. */
  | { kind: "anon" }
  /** Error de red o del servidor: se conserva lo que haya en localStorage. */
  | { kind: "offline" };

/**
 * Una sola consulta a /api/auth/me por carga de página, compartida entre todos
 * los componentes que usan el hook.
 */
let mePromise: Promise<MeResult> | null = null;
function fetchMe(): Promise<MeResult> {
  mePromise ??= fetch("/api/auth/me", { cache: "no-store" })
    .then(async (r): Promise<MeResult> => {
      if (r.ok) return { kind: "user", me: (await r.json()) as Me };
      if (r.status === 401) return { kind: "anon" };
      throw new Error(`auth/me ${r.status}`);
    })
    .catch((): MeResult => {
      mePromise = null;
      return { kind: "offline" };
    });
  return mePromise;
}

function writeKey(key: string, value: string | null) {
  if (value) window.localStorage.setItem(key, value);
  else window.localStorage.removeItem(key);
}

/**
 * Datos del usuario para la UI. La sesión real es una cookie httpOnly que
 * valida el servidor; localStorage solo guarda una copia para pintar rápido.
 */
export function useBackendUser() {
  const [userId, setUserIdState] = useState<string | null>(null);
  const [displayName, setDisplayNameState] = useState<string | null>(null);
  const [phone, setPhoneState] = useState<string | null>(null);
  const [email, setEmailState] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const cachedId = window.localStorage.getItem(KEY_ID);

    fetchMe().then((result) => {
      if (cancelled) return;
      setDisplayNameState(window.localStorage.getItem(KEY_NAME));
      setPhoneState(window.localStorage.getItem(KEY_PHONE));
      setEmailState(window.localStorage.getItem(KEY_EMAIL));
      if (result.kind === "user") {
        const { me } = result;
        writeKey(KEY_ID, me.userId);
        setUserIdState(me.userId);
        if (me.name) {
          writeKey(KEY_NAME, me.name);
          setDisplayNameState(me.name);
        }
        if (me.email) {
          writeKey(KEY_EMAIL, me.email);
          setEmailState(me.email);
        }
      } else if (result.kind === "offline") {
        setUserIdState(cachedId);
      } else if (cachedId) {
        // Había datos locales pero la cookie no es válida (expiró o sesión anterior a las cookies).
        for (const key of [KEY_ID, KEY_NAME, KEY_PHONE, KEY_EMAIL]) {
          window.localStorage.removeItem(key);
        }
        setDisplayNameState(null);
        setPhoneState(null);
        setEmailState(null);
      }
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setUserId = useCallback((id: string | null) => {
    writeKey(KEY_ID, id);
    // Tras login/registro la cookie ya cambió: la próxima consulta debe ir al servidor.
    mePromise = null;
    setUserIdState(id);
  }, []);

  const setDisplayName = useCallback((name: string | null) => {
    writeKey(KEY_NAME, name);
    setDisplayNameState(name);
  }, []);

  const setPhone = useCallback((p: string | null) => {
    writeKey(KEY_PHONE, p);
    setPhoneState(p);
  }, []);

  const setEmail = useCallback((e: string | null) => {
    writeKey(KEY_EMAIL, e);
    setEmailState(e);
  }, []);

  const clearSession = useCallback(() => {
    void fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    mePromise = Promise.resolve({ kind: "anon" });
    for (const key of [KEY_ID, KEY_NAME, KEY_PHONE, KEY_EMAIL]) {
      window.localStorage.removeItem(key);
    }
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
