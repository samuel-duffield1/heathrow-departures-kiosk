const { DateTime } = require('luxon');

const HEATHROW_DEPARTURES_URL = 'https://api-dp-prod.dp.heathrow.com/pihub/flights/departures';
const HEATHROW_PAGE_URL = 'https://www.heathrow.com/departures';

function parseLondonLocal(isoWithoutZone) {
  if (!isoWithoutZone) {
    return null;
  }

  const dt = DateTime.fromISO(isoWithoutZone, { zone: 'Europe/London' });
  return dt.isValid ? dt : null;
}

function mapFlight(rawFlight) {
  const service = rawFlight?.flightService;
  if (!service) {
    return null;
  }

  if (service.codeShareStatus === 'CODESHARE_MARKETING_FLIGHT') {
    return null;
  }

  const route = service?.aircraftMovement?.route;
  const ports = route?.portsOfCall || [];

  const origin = ports.find((p) => p?.portOfCallType === 'ORIGIN');
  const destination = ports.find((p) => p?.portOfCallType === 'DESTINATION');

  if (!origin || !destination) {
    return null;
  }

  const scheduledLocal = origin?.operatingTimes?.scheduled?.local;
  const scheduled = parseLondonLocal(scheduledLocal);
  if (!scheduled) {
    return null;
  }

  const status = service?.aircraftMovement?.aircraftMovementStatus?.[0] || {};

  return {
    id: service?.iataFlightIdentifier || service?.icaoFlightIdentifier || `${service?.airlineParty?.iataIdentifier || ''}${service?.flightNumber || ''}`,
    flight: service?.iataFlightIdentifier || service?.icaoFlightIdentifier || `${service?.airlineParty?.iataIdentifier || ''}${service?.flightNumber || ''}`,
    airline: service?.airlineParty?.name || 'Unknown airline',
    destinationCity: destination?.airportFacility?.airportCityLocation?.name || destination?.airportFacility?.name || 'Unknown destination',
    destinationAirport: destination?.airportFacility?.iataIdentifier || '',
    terminal: origin?.airportFacility?.terminalFacility?.code || '-',
    gate: origin?.airportFacility?.terminalFacility?.gateFacility?.gateNumber || '-',
    statusCode: status?.statusCode || '',
    statusText: status?.message || 'Scheduled',
    scheduledIso: scheduled.toISO(),
    scheduledDisplay: scheduled.toFormat('HH:mm'),
    scheduled,
  };
}

function filterNextSixHours(flights) {
  const now = DateTime.now().setZone('Europe/London');
  const sixHours = now.plus({ hours: 6 });

  return flights
    .filter((flight) => flight.scheduled >= now && flight.scheduled <= sixHours)
    .sort((a, b) => a.scheduled.toMillis() - b.scheduled.toMillis())
    .map((flight) => ({
      id: flight.id,
      flight: flight.flight,
      airline: flight.airline,
      destinationCity: flight.destinationCity,
      destinationAirport: flight.destinationAirport,
      terminal: flight.terminal,
      gate: flight.gate,
      statusCode: flight.statusCode,
      statusText: flight.statusText,
      scheduledIso: flight.scheduledIso,
      scheduledDisplay: flight.scheduledDisplay,
    }));
}

async function fetchDeparturesNextSixHours() {
  const response = await fetch(HEATHROW_DEPARTURES_URL, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Referer: HEATHROW_PAGE_URL,
      Origin: 'https://www.heathrow.com',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Heathrow API request failed (${response.status})`);
  }

  const payload = await response.json();
  if (!Array.isArray(payload)) {
    throw new Error('Unexpected Heathrow API payload format');
  }

  const mapped = payload.map(mapFlight).filter(Boolean);
  return filterNextSixHours(mapped);
}

module.exports = {
  fetchDeparturesNextSixHours,
};