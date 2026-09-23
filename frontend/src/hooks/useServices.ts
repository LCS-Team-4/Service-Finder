// import { useEffect, useState } from "react";
// import { getServices } from "../services/api";
// import type { Service } from "../types/service.types";

// export function useServices() {
// 	const [services, setServices] = useState<Service[]>([]);
// 	const [loading, setLoading] = useState(true);
// 	const [error, setError] = useState("");

// 	useEffect(() => {
// 		let active = true;
// 		getServices()
// 			.then((data) => {
// 				if (active) setServices(data);
// 			})
// 			.catch((reason: unknown) => {
// 				if (active) setError(reason instanceof Error ? reason.message : "Unable to load services");
// 			})
// 			.finally(() => {
// 				if (active) setLoading(false);
// 			});
// 		return () => {
// 			active = false;
// 		};
// 	}, []);

// 	return { services, loading, error };
// }


import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { db } from '../db';
import { refreshServicesIfStale } from '../db/serviceCache';
import type { Service } from '../types/service.types';

export function useServices() {
  const services = useLiveQuery(() => db.services.toArray(), [], [] as Service[]);
  const [error, setError] = useState('');

  useEffect(() => {
    refreshServicesIfStale().catch((err) => {
      setError(err instanceof Error ? err.message : 'Unable to refresh services.');
    });
  }, []);

  return {
    services: services ?? [],
    loading: services === undefined,
    error,
  };
}
