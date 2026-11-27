# Sthlm Parkering

En enkel, mobilvänlig webbapp (HTML, CSS och vanilla JavaScript) för att visa parkeringsregler och städdagar/servicedagar i Stockholm baserat på GPS-position.

## Funktioner

* **GPS-positionering:** Hämtar din nuvarande position i webbläsaren och visar regler inom en vald radie (standard: 60 meter), med fallback/testknapp för centrala Stockholm.
* **Statuskort:** Markerar tydligt om det finns en registrerad städdag idag eller inte.
* **Städdagar & övriga regler:** Listar gator, tider, taxor och föreskriftstexter i överskådliga kort.
* **Test-/mockläge:** Inbyggd mockdata (`USE_MOCK_DATA = true`) så att gränssnitt och logik kan testas utan aktivt API eller GPS.

## Projektstruktur

* `index.html` – Grundstruktur och mobilvänlig layout.
* `style.css` – Mörkt tema, kort och statusindikatorer.
* `app.js` – GPS-logik, mockdata, API-anrop mot Stockholms stad och rendering av regler.
* `config.local.js` – Lokal konfiguration med egen API-nyckel (ignoreras av Git).
* `.gitignore` – Ser till att lokala hemligheter/nyckelfiler inte checkas in.

## Kom igång

1. Klona repot eller öppna projektmappen i din editor (t.ex. VS Code).
2. Starta en lokal webbserver (till exempel med **Live Server** i VS Code), eftersom GPS (`navigator.geolocation`) fungerar bäst över `http://localhost` eller `https://`.
3. Öppna sidan i webbläsaren. Med `USE_MOCK_DATA = true` i `app.js` laddas testdata automatiskt.

## Konfiguration och data

* **Mockläge:** I `app.js` styr `USE_MOCK_DATA` om testdata används, och `MOCK_CLEANING_TODAY` om en städdag för dagens veckodag ska simuleras.
* **Stockholms stads data:** När `USE_MOCK_DATA` sätts till `false` anropar appen Stockholms stads LTF-Tolken API (`openparking.stockholm.se/LTF-Tolken/v1/...`) för `ptillaten` och `servicedagar` med nyckeln från `config.local.js` (`window.APP_CONFIG.STHLM_API_KEY`).

> **Obs:** Kontrollera alltid fysiska vägmärken och tillfälliga skyltar på plats innan du parkerar.