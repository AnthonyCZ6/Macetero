"use client";

import { useCallback, useEffect, useState } from "react";

type Estado<T> = { key: string | null; data: T | null; error: string | null };

/**
 * GET de JSON ligado a una clave (`url` + `options.key`). Cuando la clave
 * cambia se vuelve a pedir y, mientras llega, `loading` es true y no se exponen
 * datos de la clave anterior. `url` null = no pedir nada (p. ej. sin sesión).
 * `reload()` vuelve a pedir conservando los datos actuales mientras tanto.
 *
 * El estado solo se actualiza al llegar la respuesta, así que no hay setState
 * síncrono dentro del efecto.
 */
export function useApiGet<T>(
  url: string | null,
  options: { key?: string | null; errorMessage?: string } = {}
) {
  const { key: extraKey = null, errorMessage = "No se pudo cargar" } = options;
  const key = url === null ? null : `${url}|${extraKey ?? ""}`;
  const [estado, setEstado] = useState<Estado<T>>({
    key: null,
    data: null,
    error: null,
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (url === null || key === null) return;
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        const body = (await r.json().catch(() => null)) as
          | (T & { error?: unknown })
          | null;
        if (cancelled) return;
        if (!r.ok || !body || typeof body.error === "string") {
          const msg =
            body && typeof body.error === "string" ? body.error : errorMessage;
          setEstado({ key, data: null, error: msg });
        } else {
          setEstado({ key, data: body, error: null });
        }
      })
      .catch(() => {
        if (!cancelled) setEstado({ key, data: null, error: errorMessage });
      });
    return () => {
      cancelled = true;
    };
  }, [url, key, version, errorMessage]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const vigente = key !== null && estado.key === key;
  return {
    data: vigente ? estado.data : null,
    error: vigente ? estado.error : null,
    loading: key !== null && !vigente,
    reload,
  };
}
