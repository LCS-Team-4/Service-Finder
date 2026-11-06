import { memo, useState } from 'react';
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Sun,
  X,
} from 'lucide-react';
import type { CurrentWeather } from '../../hooks/useWeather';

interface WeatherWidgetProps {
  weather: CurrentWeather | null;
  error: string;
  now: Date;
  locationLabel: string;
}

function getWeatherDescription(code: number) {
  if (code === 0) return 'Clear sky';
  if (code === 1) return 'Mainly clear';
  if (code === 2) return 'Partly cloudy';
  if (code === 3) return 'Overcast';
  if (code === 45 || code === 48) return 'Fog';
  if ([51, 53, 55].includes(code)) return 'Drizzle';
  if ([56, 57].includes(code)) return 'Freezing drizzle';
  if ([61, 63, 65].includes(code)) return 'Rain';
  if ([66, 67].includes(code)) return 'Freezing rain';
  if ([71, 73, 75, 77].includes(code)) return 'Snow';
  if ([80, 81, 82].includes(code)) return 'Rain showers';
  if ([85, 86].includes(code)) return 'Snow showers';
  if (code === 95 || code === 96 || code === 99) return 'Thunderstorm';
  return 'Current conditions';
}

function WeatherIcon({ code }: { code: number }) {
  if (code === 0) return <Sun aria-hidden="true" />;
  if (code <= 2) return <CloudSun aria-hidden="true" />;
  if (code <= 3) return <Cloud aria-hidden="true" />;
  if (code <= 48) return <CloudFog aria-hidden="true" />;
  if (code <= 57) return <CloudDrizzle aria-hidden="true" />;
  if (code <= 67 || (code >= 80 && code <= 82)) return <CloudRain aria-hidden="true" />;
  if (code <= 77 || (code >= 85 && code <= 86)) return <CloudSnow aria-hidden="true" />;
  if (code >= 95) return <CloudLightning aria-hidden="true" />;
  return <CloudSun aria-hidden="true" />;
}

function WeatherWidget({ weather, error, now, locationLabel }: WeatherWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <aside className={`weather-widget-wrapper ${isExpanded ? 'is-expanded' : ''}`}>
      <div
        className="weather-pill"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {weather ? (
          <>
            <WeatherIcon code={weather.weatherCode} />
            <span>{Math.round(weather.temperature)}°C</span>
          </>
        ) : (
          <span className="weather-loading">--°C</span>
        )}
      </div>

      <div className="weather-card">
        <button
          className="weather-close"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsExpanded(false);
          }}
          aria-label="Close weather"
        >
          <X size={16} />
        </button>

        <div className="weather-clock">
          <span>{now.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
          <time>{now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</time>
        </div>
        <div className="weather-location">{locationLabel} · Today</div>

        {weather ? (
          <div className="weather-conditions">
            <WeatherIcon code={weather.weatherCode} />
            <div className="weather-current">
              <strong>{Math.round(weather.temperature)}°C</strong>
              <span>{getWeatherDescription(weather.weatherCode)}</span>
            </div>
            <div className="weather-range">
              <span>H {Math.round(weather.high)}°</span>
              <span>L {Math.round(weather.low)}°</span>
            </div>
            <div className="weather-details">
              Feels {Math.round(weather.feelsLike)}° · Wind {Math.round(weather.windSpeed)} km/h
            </div>
          </div>
        ) : (
          <p className={error ? 'weather-message error' : 'weather-message'}>
            {error ? 'Weather unavailable right now.' : 'Loading today’s weather...'}
          </p>
        )}
      </div>
    </aside>
  );
}

export default memo(WeatherWidget);