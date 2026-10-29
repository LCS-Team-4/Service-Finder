import { useEffect, useState } from 'react';
import { getTrafficIncidents } from '../services/api';
import type { TrafficIncident } from '../types/traffic.types';

const POLL_MS = 5 * 60 * 1000; // 5 minutes

export function useTrafficIncidents(enabled: boolean) {
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Nothing loads until the caller says location is confirmed
    if (!enabled) {
      setIncidents([]);
      setError('');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    const load = () => {
      getTrafficIncidents()
        .then((data) => {
          if (active) {
            setIncidents(data);
            setError('');
          }
        })
        .catch((reason) => {
          if (active) {
            setError(reason instanceof Error ? reason.message : 'Unable to load traffic incidents');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    };

    load();
    const timer = setInterval(load, POLL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled]);

  return { incidents, loading, error };
}