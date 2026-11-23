import { useCallback, useEffect, useState } from 'react';
import { getMySuggestions } from '../services/api';
import type { Suggestion } from '../types/suggestion.types';

export function useMySuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
        const data = await getMySuggestions();
      // The backend returns the array directly in this case
      setSuggestions((data as unknown as Suggestion[]) || []);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load suggestions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { suggestions, loading, error, refresh };
}