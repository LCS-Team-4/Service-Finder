import { useEffect, useState } from 'react';

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    sunrise: string[];
    sunset: string[];
  };
}

export interface CurrentWeather {
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  high: number;
  low: number;
  sunrise: string;
  sunset: string;
}

const WEATHER_REFRESH_MS = 15 * 60 * 1000;

export function useWeather(latitude: number, longitude: number) {
  const [weather, setWeather] = useState<CurrentWeather | null>(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const roundedLatitude = Math.round(latitude * 100) / 100;
  const roundedLongitude = Math.round(longitude * 100) / 100;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(roundedLatitude),
      longitude: String(roundedLongitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m',
      daily: 'temperature_2m_max,temperature_2m_min,sunrise,sunset',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      timezone: 'auto',
      forecast_days: '1',
    }).toString();

    const loadWeather = async () => {
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Weather service returned HTTP ${response.status}.`);
        const data = await response.json() as OpenMeteoResponse;
        if (!data.current || !data.daily || data.daily.temperature_2m_max.length === 0) {
          throw new Error('Weather service returned incomplete forecast data.');
        }

        setWeather({
          temperature: data.current.temperature_2m,
          feelsLike: data.current.apparent_temperature,
          humidity: data.current.relative_humidity_2m,
          windSpeed: data.current.wind_speed_10m,
          weatherCode: data.current.weather_code,
          high: data.daily.temperature_2m_max[0],
          low: data.daily.temperature_2m_min[0],
          sunrise: data.daily.sunrise[0],
          sunset: data.daily.sunset[0],
        });
        setError('');
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(reason instanceof Error ? reason.message : 'Unable to load current weather.');
      }
    };

    void loadWeather();
    const timer = window.setInterval(() => void loadWeather(), WEATHER_REFRESH_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [roundedLatitude, roundedLongitude]);

  return { weather, error, now };
}
