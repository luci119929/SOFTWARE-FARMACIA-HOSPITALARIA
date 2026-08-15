import { useEffect, useState } from 'react';

// Retrasa la propagación de un valor que cambia rápido (p. ej. un input de
// búsqueda) para no disparar una petición por cada tecla presionada.
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
