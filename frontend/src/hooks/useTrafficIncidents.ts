import { useEffect, useState } from 'react';
import { getTrafficIncidents } from '../services/api';
import type { TrafficIncident } from '../types/traffic.types';

const POLL_MS = 5 * 60 * 1000; // 5 minutes

export function useTrafficIncidents(enabled: boolean) {
  const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // 🛑 THE HARD GATE: If not enabled, do absolutely nothing.
    // Do not fetch, do not set loading, do not start the timer.
    if (!enabled) {
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

    // Fetch immediately ONLY because we passed the gate above
    load(); 
    
    const timer = setInterval(load, POLL_MS);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [enabled]);

  return { incidents, loading, error };
}