const express = require('express');
const path = require('path');
const { DateTime } = require('luxon');
const { fetchDeparturesNextSixHours } = require('./scrapeDepartures');

const app = express();
const PORT = process.env.PORT || 80;
const DEFAULT_REFRESH_INTERVAL_SECONDS = 300;
const configuredInterval = Number.parseInt(
  process.env.BOARD_REFRESH_INTERVAL_SECONDS || `${DEFAULT_REFRESH_INTERVAL_SECONDS}`,
  10,
);
const REFRESH_INTERVAL_SECONDS = Number.isFinite(configuredInterval) && configuredInterval > 0
  ? configuredInterval
  : DEFAULT_REFRESH_INTERVAL_SECONDS;
const REFRESH_INTERVAL_MS = REFRESH_INTERVAL_SECONDS * 1000;

const cache = {
  flights: [],
  refreshedAt: null,
  lastError: null,
};

async function refreshCache() {
  try {
    const flights = await fetchDeparturesNextSixHours();
    cache.flights = flights;
    cache.refreshedAt = DateTime.now().setZone('Europe/London').toISO();
    cache.lastError = null;
    console.log(`Refreshed departures (${flights.length} flights)`);
  } catch (error) {
    cache.lastError = error.message;
    console.error('Failed to refresh departures:', error.message);
  }
}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/departures', (req, res) => {
  res.json({
    refreshedAt: cache.refreshedAt,
    lastError: cache.lastError,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
    flights: cache.flights,
  });
});

app.get('/health', (req, res) => {
  const isHealthy = Array.isArray(cache.flights) && cache.refreshedAt;
  res.status(isHealthy ? 200 : 503).json({
    ok: Boolean(isHealthy),
    refreshedAt: cache.refreshedAt,
    lastError: cache.lastError,
    flightCount: cache.flights.length,
  });
});

app.listen(PORT, async () => {
  console.log(`Departures board listening on port ${PORT}`);
  console.log(`Refresh interval: ${REFRESH_INTERVAL_SECONDS}s`);
  await refreshCache();

  // Keep data fresh for kiosk display.
  setInterval(refreshCache, REFRESH_INTERVAL_MS);
});