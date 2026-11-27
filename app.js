const USE_MOCK_DATA = true;
const MOCK_CLEANING_TODAY = true;

const API_KEY =
  (window.APP_CONFIG && window.APP_CONFIG.STHLM_API_KEY) || '';
const RADIUS_METERS = 60;
const FALLBACK_COORDS = { lat: 59.334591, lng: 18.06324 };
const STORAGE_APP_KEY = 'sthlm_p_selected_app';

const PARKING_APPS = [
  {
    id: 'easypark',
    name: 'EasyPark',
    tag: 'Vanlig i innerstan',
    url: 'https://easypark.se',
    note: 'Sök närmaste områdeskod på skylten i EasyPark.',
  },
  {
    id: 'parkster',
    name: 'Parkster',
    tag: 'Gata & p-plats',
    url: 'https://parkster.com/se',
    note: 'Välj gata/zonnummer i Parkster och starta tiden.',
  },
  {
    id: 'aimo',
    name: 'Aimo',
    tag: 'Gata & anläggning',
    url: 'https://aimopark.se',
    note: 'Kontrollera om ytan drivs av Aimo eller kommunen.',
  },
  {
    id: 'stockholm_stad',
    name: 'Stockholms stad / Betalsätt',
    tag: 'Kommunal gatuparkering',
    url: 'https://parkering.stockholm',
    note: 'Gäller kommunala gator med angiven taxa i Stockholm.',
  },
];

const WEEKDAYS_SV = [
  'söndag',
  'måndag',
  'tisdag',
  'onsdag',
  'torsdag',
  'fredag',
  'lördag',
];

const todayIndex = new Date().getDay();
const todayName = WEEKDAYS_SV[todayIndex];
const todayCapitalized = todayName.charAt(0).toUpperCase() + todayName.slice(1);
const otherWeekdayName = WEEKDAYS_SV[(todayIndex + 2) % 7];
const otherWeekdayCapitalized =
  otherWeekdayName.charAt(0).toUpperCase() + otherWeekdayName.slice(1);

function buildMockServiceData(includeToday) {
  const features = [];

  if (includeToday) {
    features.push({
      properties: {
        STREET_NAME: 'Sveavägen 42',
        START_WEEKDAY: todayCapitalized,
        START_TIME: 0,
        END_TIME: 600,
        CITATION: `Förbud att parkera fordon ${todayName} kl. 00.00–06.00 (servicedag/gaturenhållning).`,
      },
    });
  }

  features.push({
    properties: {
      STREET_NAME: 'Kungsgatan 18',
      START_WEEKDAY: otherWeekdayCapitalized,
      START_TIME: 0,
      END_TIME: 600,
      CITATION: `Förbud att parkera fordon ${otherWeekdayName} kl. 00.00–06.00.`,
    },
  });

  return { features };
}

const MOCK_ALLOWED_DATA = {
  features: [
    {
      properties: {
        STREET_NAME: 'Sveavägen 40–48',
        PARKING_RATE: 'Taxa 2 (31 kr/tim)',
        VEHICLE: 'Personbil klass I',
        CITATION: 'Avgift vardagar 07.00–19.00, lördag 11.00–17.00. Övrig tid avgiftsfri.',
      },
    },
    {
      properties: {
        STREET_NAME: 'Apelbergsgatan 54',
        PARKING_RATE: 'Taxa 2 (Boendeparkering)',
        VEHICLE: 'Personbil / MC',
        CITATION: 'Parkering tillåten i högst 24 timmar i följd. Boendeparkering Östermalm/Norrmalm.',
      },
    },
  ],
};

const todayLabelEl = document.getElementById('today-label');
const gpsBtn = document.getElementById('gps-btn');
const testBtn = document.getElementById('test-btn');
const errorBox = document.getElementById('error-box');
const errorText = document.getElementById('error-text');
const statusCard = document.getElementById('status-card');
const statusDot = document.getElementById('status-dot');
const statusTitle = document.getElementById('status-title');
const statusCoords = document.getElementById('status-coords');
const detectedZoneEl = document.getElementById('detected-zone');
const appRecommendationEl = document.getElementById('app-recommendation');
const appSelectorEl = document.getElementById('app-selector');
const selectedAppSummaryEl = document.getElementById('selected-app-summary');
const selectedStreetInfoEl = document.getElementById('selected-street-info');
const copySpotBtn = document.getElementById('copy-spot-btn');
const openAppLinkEl = document.getElementById('open-app-link');
const copyFeedbackEl = document.getElementById('copy-feedback');
const serviceHeading = document.getElementById('service-heading');
const allowedHeading = document.getElementById('allowed-heading');
const serviceList = document.getElementById('service-list');
const allowedList = document.getElementById('allowed-list');

let currentSpotContext = {
  lat: null,
  lng: null,
  streetName: 'Okänd gata i närheten',
  rateText: '',
  hasCleaningToday: false,
};

let selectedAppId =
  localStorage.getItem(STORAGE_APP_KEY) || PARKING_APPS[0].id;

todayLabelEl.textContent = `Idag är det ${todayName}${USE_MOCK_DATA ? ' • Testläge' : ''}`;

function formatTime(timeNum) {
  if (timeNum === undefined || timeNum === null) return '';
  const str = String(timeNum).padStart(4, '0');
  return `${str.slice(0, 2)}:${str.slice(2, 4)}`;
}

function setLoading(isLoading) {
  gpsBtn.disabled = isLoading;
  gpsBtn.textContent = isLoading ? 'Söker...' : 'Uppdatera GPS';
}

function showError(message) {
  errorText.textContent = message;
  errorBox.classList.remove('hidden');
  statusCard.classList.add('hidden');
}

function clearError() {
  errorBox.classList.add('hidden');
  errorText.textContent = '';
}

function getSelectedApp() {
  return PARKING_APPS.find((app) => app.id === selectedAppId) || PARKING_APPS[0];
}

function renderAppSelector() {
  appSelectorEl.innerHTML = '';

  PARKING_APPS.forEach((app) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = app.id === selectedAppId ? 'app-option active' : 'app-option';
    btn.innerHTML = `
      <span class="app-option-name">${app.name}</span>
      <span class="app-option-tag">${app.tag}</span>
    `;
    btn.addEventListener('click', () => {
      selectedAppId = app.id;
      localStorage.setItem(STORAGE_APP_KEY, app.id);
      renderAppSelector();
      updatePaymentSummary();
    });
    appSelectorEl.appendChild(btn);
  });
}

function updatePaymentSummary() {
  const app = getSelectedApp();
  const { streetName, rateText, hasCleaningToday, lat, lng } = currentSpotContext;

  const coordPart =
    typeof lat === 'number' && typeof lng === 'number'
      ? ` (${lat.toFixed(4)}, ${lng.toFixed(4)})`
      : '';

  selectedAppSummaryEl.textContent = `Betala med ${app.name}`;
  selectedStreetInfoEl.textContent =
    `Avläst plats: ${streetName}${coordPart}` +
    (rateText ? ` • ${rateText}` : '') +
    (hasCleaningToday ? ' • OBS: Städdag idag!' : '');

  appRecommendationEl.textContent = rateText
    ? `Hittade ${rateText} vid ${streetName}. Välj app nedan – ${app.note.toLowerCase()}`
    : `Välj vilken parkeringsapp du vill använda vid ${streetName}. ${app.note}`;

  openAppLinkEl.href = app.url;
  openAppLinkEl.textContent = `Öppna ${app.name}`;
}

function detectLocationSummary(allowedFeatures, serviceFeatures) {
  const firstAllowed = allowedFeatures[0] && allowedFeatures[0].properties;
  const firstService = serviceFeatures[0] && serviceFeatures[0].properties;

  const streetName =
    (firstAllowed && firstAllowed.STREET_NAME) ||
    (firstService && firstService.STREET_NAME) ||
    'Position i Stockholm';

  const rateText = (firstAllowed && firstAllowed.PARKING_RATE) || '';

  return { streetName, rateText };
}

function renderServiceDays(features) {
  serviceHeading.textContent = `Städdagar & Parkeringsförbud (${features.length})`;
  serviceList.innerHTML = '';

  if (features.length === 0) {
    serviceList.innerHTML =
      '<div class="card"><p class="card-meta">Inga servicedagar hittades direkt vid denna position.</p></div>';
    return;
  }

  features.forEach((item) => {
    const p = item.properties || {};
    const isToday = Boolean(
      p.START_WEEKDAY && p.START_WEEKDAY.toLowerCase().includes(todayName)
    );

    const card = document.createElement('div');
    card.className = isToday ? 'card today-alert' : 'card';

    const timeRange =
      p.START_TIME !== undefined || p.END_TIME !== undefined
        ? `${formatTime(p.START_TIME)}–${formatTime(p.END_TIME)}`
        : '';

    const badgeHtml = p.START_WEEKDAY
      ? `<span class="badge ${isToday ? 'alert' : 'info'}">${p.START_WEEKDAY} ${timeRange}</span>`
      : '';

    const citationHtml = p.CITATION
      ? `<div class="citation"><span class="citation-label">Skylttext / Föreskrift:</span>${p.CITATION}</div>`
      : '';

    card.innerHTML = `
      <div class="card-top">
        <h4 class="card-title">${p.STREET_NAME || 'Okänd gata'}</h4>
        ${badgeHtml}
      </div>
      ${citationHtml}
    `;

    serviceList.appendChild(card);
  });
}

function renderAllowedRules(features) {
  allowedHeading.textContent = `Övriga parkeringsregler & Taxa (${features.length})`;
  allowedList.innerHTML = '';

  if (features.length === 0) {
    allowedList.innerHTML = `<div class="card"><p class="card-meta">Inga övriga regler hittades inom ${RADIUS_METERS} m.</p></div>`;
    return;
  }

  features.forEach((item) => {
    const p = item.properties || {};
    const card = document.createElement('div');
    card.className = 'card';

    const rateHtml = p.PARKING_RATE
      ? `<span class="badge rate">${p.PARKING_RATE}</span>`
      : '';

    const vehicleHtml = p.VEHICLE
      ? `<p class="card-meta">Fordon: ${p.VEHICLE}</p>`
      : '';

    const citationHtml = p.CITATION
      ? `<div class="citation">${p.CITATION}</div>`
      : '';

    card.innerHTML = `
      <div class="card-top">
        <h4 class="card-title">${p.STREET_NAME || 'Gata i närheten'}</h4>
        ${rateHtml}
      </div>
      ${vehicleHtml}
      ${citationHtml}
    `;

    allowedList.appendChild(card);
  });
}

async function fetchParkingData(lat, lng, options = {}) {
  const { fallbackUsed = false } = options;
  setLoading(true);
  clearError();

  try {
    let serviceData;
    let allowedData;

    if (USE_MOCK_DATA) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      serviceData = buildMockServiceData(MOCK_CLEANING_TODAY);
      allowedData = MOCK_ALLOWED_DATA;
    } else {
      if (!API_KEY || API_KEY === 'BYT_UT_MOT_DIN_EGNA_NYCKEL') {
        showError('Saknar API-nyckel. Kopiera config.example.js till config.local.js och fyll i din nyckel.');
        setLoading(false);
        return;
      }

      const allowedUrl = `https://openparking.stockholm.se/LTF-Tolken/v1/ptillaten/within?radius=${RADIUS_METERS}&lat=${lat}&lng=${lng}&outputFormat=json&apiKey=${API_KEY}`;
      const serviceUrl = `https://openparking.stockholm.se/LTF-Tolken/v1/servicedagar/within?radius=${RADIUS_METERS}&lat=${lat}&lng=${lng}&outputFormat=json&apiKey=${API_KEY}`;

      const [allowedRes, serviceRes] = await Promise.all([
        fetch(allowedUrl),
        fetch(serviceUrl),
      ]);

      allowedData = allowedRes.ok ? await allowedRes.json() : { features: [] };
      serviceData = serviceRes.ok ? await serviceRes.json() : { features: [] };
    }

    const serviceFeatures = serviceData.features || [];
    const allowedFeatures = allowedData.features || [];

    const hasCleaningToday = serviceFeatures.some((item) => {
      const wd = item.properties && item.properties.START_WEEKDAY;
      return wd && wd.toLowerCase().includes(todayName);
    });

    const { streetName, rateText } = detectLocationSummary(
      allowedFeatures,
      serviceFeatures
    );

    currentSpotContext = {
      lat,
      lng,
      streetName,
      rateText,
      hasCleaningToday,
    };

    statusCard.classList.remove('hidden', 'warning', 'ok');
    statusDot.classList.remove('warning', 'ok');

    if (hasCleaningToday) {
      statusCard.classList.add('warning');
      statusDot.classList.add('warning');
      statusTitle.textContent = 'Varning: Städdag i närheten idag!';
    } else {
      statusCard.classList.add('ok');
      statusDot.classList.add('ok');
      statusTitle.textContent = 'Ingen städdag registrerad idag';
    }

    const notes = [];
    if (USE_MOCK_DATA) notes.push('testdata');
    if (fallbackUsed) notes.push('GPS saknas – visar Sthlm city');
    const suffix = notes.length > 0 ? ` (${notes.join(', ')})` : '';

    statusCoords.textContent = `Visar regler inom ${RADIUS_METERS} m från (${lat.toFixed(4)}, ${lng.toFixed(4)})${suffix}.`;
    detectedZoneEl.textContent = `Avläst plats: ${streetName}${rateText ? ` • ${rateText}` : ''}`;

    renderServiceDays(serviceFeatures);
    renderAllowedRules(allowedFeatures);
    updatePaymentSummary();
  } catch (err) {
    showError('Kunde inte hämta parkeringsdata. Kontrollera anslutningen.');
  } finally {
    setLoading(false);
  }
}

function locateMe() {
  clearError();

  if (!navigator.geolocation) {
    if (USE_MOCK_DATA) {
      fetchParkingData(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng, { fallbackUsed: true });
    } else {
      showError('Din webbläsare stöder inte GPS-positionering.');
    }
    return;
  }

  setLoading(true);
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const { latitude, longitude } = position.coords;
      fetchParkingData(latitude, longitude);
    },
    () => {
      setLoading(false);
      if (USE_MOCK_DATA) {
        fetchParkingData(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng, { fallbackUsed: true });
      } else {
        showError('Kunde inte hämta din plats. Tillåt platstjänster eller använd testknappen nedan.');
      }
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

copySpotBtn.addEventListener('click', async () => {
  const app = getSelectedApp();
  const { lat, lng, streetName, rateText } = currentSpotContext;
  const coordStr =
    typeof lat === 'number' && typeof lng === 'number'
      ? `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      : 'okänd position';
  const textToCopy = `${streetName} (${coordStr})${rateText ? ` – ${rateText}` : ''} | App: ${app.name}`;

  try {
    await navigator.clipboard.writeText(textToCopy);
    copyFeedbackEl.textContent = `Kopierade: ${textToCopy}`;
    copyFeedbackEl.classList.remove('hidden');
  } catch {
    copyFeedbackEl.textContent = textToCopy;
    copyFeedbackEl.classList.remove('hidden');
  }
});

gpsBtn.addEventListener('click', locateMe);
testBtn.addEventListener('click', () => {
  fetchParkingData(FALLBACK_COORDS.lat, FALLBACK_COORDS.lng, { fallbackUsed: true });
});

renderAppSelector();
updatePaymentSummary();
locateMe();