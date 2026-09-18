import { useEffect, useState } from "react";
import { getTrafficIncidents } from "../services/api";
import type { TrafficIncident } from "../types/traffic.types";

export function useTrafficIncidents() {
	const [incidents, setIncidents] = useState<TrafficIncident[]>([]);
	const [error, setError] = useState("");

	useEffect(() => {
		let active = true;
		getTrafficIncidents()
			.then((data) => {
				if (active) setIncidents(data);
			})
			.catch((reason: unknown) => {
				if (active) setError(reason instanceof Error ? reason.message : "Unable to load traffic incidents");
			});
		return () => {
				active = false;
			};
	}, []);

	return { incidents, error };
}