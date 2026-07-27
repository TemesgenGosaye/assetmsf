import { useEffect, useState } from "react";

/**
 * Returns a debounced version of the input value.
 * The returned value only updates after `delay` ms of inactivity.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * Returns [isSearching, debouncedSearchTerm].
 * Sets isSearching=true while the user is actively typing (before debounce settles).
 */
export function useSearchLoading(term: string, delay = 250): [boolean, string] {
  const [isSearching, setIsSearching] = useState(false);
  const debounced = useDebouncedValue(term, delay);

  useEffect(() => {
    if (term !== debounced) {
      setIsSearching(true);
    } else {
      setIsSearching(false);
    }
  }, [term, debounced]);

  return [isSearching, debounced];
}
