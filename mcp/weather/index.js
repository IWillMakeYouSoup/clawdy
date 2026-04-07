const WMO_CODES = {
  0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
  45: "Foggy", 48: "Icy fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain",
  71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
  80: "Light showers", 81: "Showers", 82: "Heavy showers",
  85: "Snow showers", 86: "Heavy snow showers",
  95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
};

async function geocode(location) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.results?.length) throw new Error(`Location not found: ${location}`);
  const { latitude, longitude, name, country } = data.results[0];
  return { latitude, longitude, label: `${name}, ${country}` };
}

async function fetchWeather(latitude, longitude) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum` +
    `&timezone=auto&forecast_days=4`;
  const res = await fetch(url);
  return res.json();
}

export const tools = [
  {
    name: "getCurrentWeather",
    description: "Get current weather conditions for a location.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name, e.g. 'Stockholm'" },
      },
      required: ["location"],
    },
  },
  {
    name: "getWeatherForecast",
    description: "Get a 3-day weather forecast for a location.",
    input_schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "City name, e.g. 'Stockholm'" },
      },
      required: ["location"],
    },
  },
];

export async function run(name, input) {
  const { latitude, longitude, label } = await geocode(input.location);
  const data = await fetchWeather(latitude, longitude);
  const c = data.current;

  if (name === "getCurrentWeather") {
    return JSON.stringify({
      location: label,
      condition: WMO_CODES[c.weather_code] ?? "Unknown",
      temperature: `${c.temperature_2m}°C`,
      feelsLike: `${c.apparent_temperature}°C`,
      humidity: `${c.relative_humidity_2m}%`,
      wind: `${c.wind_speed_10m} km/h`,
    });
  }

  if (name === "getWeatherForecast") {
    const d = data.daily;
    const days = d.time.map((date, i) => ({
      date,
      condition: WMO_CODES[d.weather_code[i]] ?? "Unknown",
      high: `${d.temperature_2m_max[i]}°C`,
      low: `${d.temperature_2m_min[i]}°C`,
      precipitation: `${d.precipitation_sum[i]}mm`,
    }));
    return JSON.stringify({ location: label, forecast: days });
  }

  throw new Error(`Unknown tool: ${name}`);
}
