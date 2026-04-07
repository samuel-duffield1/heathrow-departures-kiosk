const rowsEl = document.getElementById('rows');
const updatedEl = document.getElementById('updated');
const errorEl = document.getElementById('error');
const clockEl = document.getElementById('clock');
const DEFAULT_REFRESH_INTERVAL_MS = 300000;

let refreshIntervalMs = DEFAULT_REFRESH_INTERVAL_MS;
let refreshTimer = null;

function scheduleNextRefresh() {
  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(fetchDepartures, refreshIntervalMs);
}

function statusClass(statusText) {
  const normalized = (statusText || '').toUpperCase();
  if (normalized.includes('CANCELLED') || normalized.includes('DIVERTED')) {
    return 'bad';
  }
  if (normalized.includes('DELAYED') || normalized.includes('LAST CALL')) {
    return 'warn';
  }
  return 'ok';
}

function renderRows(flights) {
  rowsEl.innerHTML = '';

  if (!flights.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = 'No departures found in the next 6 hours.';
    rowsEl.appendChild(empty);
    return;
  }

  for (const flight of flights) {
    const row = document.createElement('div');
    row.className = 'row';

    row.innerHTML = `
      <div>${flight.scheduledDisplay}</div>
      <div class="flight">${flight.flight}</div>
      <div>${flight.destinationCity} ${flight.destinationAirport ? `(${flight.destinationAirport})` : ''}</div>
      <div>T${flight.terminal}</div>
      <div>${flight.gate}</div>
      <div class="status ${statusClass(flight.statusText)}">${flight.statusText}</div>
    `;

    rowsEl.appendChild(row);
  }
}

function updateClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: 'Europe/London',
  });
}

async function fetchDepartures() {
  try {
    const response = await fetch('/api/departures', { cache: 'no-store' });
    const payload = await response.json();

    if (Number.isFinite(payload.refreshIntervalMs) && payload.refreshIntervalMs > 0) {
      refreshIntervalMs = payload.refreshIntervalMs;
    }

    renderRows(payload.flights || []);

    if (payload.refreshedAt) {
      const date = new Date(payload.refreshedAt);
      updatedEl.textContent = `Last refresh: ${date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'Europe/London',
      })}`;
    }

    errorEl.textContent = payload.lastError ? `Data warning: ${payload.lastError}` : '';
  } catch (error) {
    errorEl.textContent = 'Data warning: unable to load departures.';
  } finally {
    scheduleNextRefresh();
  }
}

updateClock();
setInterval(updateClock, 1000);
fetchDepartures();