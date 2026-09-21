import { useEffect, useRef } from 'react';

declare const L: any;

/** A deliberately quiet instance of the same Cape Town map used in the guide. */
function AuthMap() {
	const mapElement = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!mapElement.current || typeof L === 'undefined') return;

		const map = L.map(mapElement.current, {
			zoomControl: false,
			attributionControl: false,
			zoomSnap: 0.25,
		}).setView([-33.95, 18.48], 11.25);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19,
		}).addTo(map);

		return () => map.remove();
	}, []);

	return <div className="auth-map" ref={mapElement} aria-label="Interactive map of Cape Town" />;
}

export default AuthMap;
