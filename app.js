// TrailGIS - Fase 1 evoluta
// Funzioni: login/registrazione, ricerca per nome, miei percorsi, caricamento GPX/KML/KMZ/TRK.
const SUPABASE_URL = "https://uvkboeiognxsmkufmzgs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV2a2JvZWlvZ254c21rdWZtemdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDY0MjMsImV4cCI6MjA5NTAyMjQyM30.XRefx4ztMwKU4O8Q6BS-KHZLuNGrBR-En35f1vLgEW8";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = (id) => document.getElementById(id);
let currentUser = null;
let authMode = "login";

const map = L.map("map", { zoomControl: true }).setView([40.1, 9.0], 8);
const baseLayers = {
  topo: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Powered by Esri" }),
  imagery: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Powered by Esri" }),
  streets: L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Powered by Esri" })
};
let activeBaseLayer = baseLayers.topo.addTo(map);
function switchBaseLayer(name) { const next = baseLayers[name] || baseLayers.topo; if (activeBaseLayer !== next) { map.removeLayer(activeBaseLayer); activeBaseLayer = next.addTo(map); } }

let current = { sourceText: null, sourceFormat: "gpx", geojson: null, layer: null, distanceM: 0, points: [], centroid: null };
let allPublishedTrails = [];
let visiblePublishedTrails = [];
let publishedCluster = L.markerClusterGroup();
let publishedRouteLayer = null;
let searchCircle = null;
let searchMarker = null;
map.addLayer(publishedCluster);

bindEvents();
initAuth();

function bindEvents() {
  $("gpxFile").addEventListener("change", handleRouteFile);
  $("btnPublish").addEventListener("click", publishTrail);
  $("btnDownload").addEventListener("click", downloadCurrentRoute);
  $("btnClear").addEventListener("click", clearCurrent);
  $("btnLoadRemote").addEventListener("click", loadPublishedTrails);
  $("btnSearchMunicipality").addEventListener("click", searchByMunicipality);
  $("btnSearchMunicipality2").addEventListener("click", searchByMunicipality);
  $("btnResetSearch").addEventListener("click", resetSearch);
  $("btnSearchName").addEventListener("click", searchByName);
  $("trailNameSearch").addEventListener("keydown", e => { if (e.key === "Enter") searchByName(); });
  $("btnExplore").addEventListener("click", () => { setActiveNav("btnExplore"); resetSearch(); $("trailNameSearch").focus(); });
  $("btnMyTrails").addEventListener("click", showMyTrails);
  $("municipalitySearch").addEventListener("keydown", e => { if (e.key === "Enter") searchByMunicipality(); });
  $("radiusKm").addEventListener("input", () => { $("radiusValue").textContent = `${$("radiusKm").value} km`; });
  $("openUpload").addEventListener("click", () => { $("uploadPanel").classList.toggle("open"); });
  $("closeUpload").addEventListener("click", () => $("uploadPanel").classList.remove("open"));
  $("baseLayerSelect").addEventListener("change", e => { switchBaseLayer(e.target.value); document.querySelectorAll('input[name="floatingLayer"]').forEach(r => r.checked = r.value === e.target.value); });
  document.querySelectorAll('input[name="floatingLayer"]').forEach(radio => radio.addEventListener("change", e => { switchBaseLayer(e.target.value); $("baseLayerSelect").value = e.target.value; }));
  $("userMenu").addEventListener("click", openAuthModal);
  $("closeAuth").addEventListener("click", closeAuthModal);
  $("tabLogin").addEventListener("click", () => setAuthMode("login"));
  $("tabRegister").addEventListener("click", () => setAuthMode("register"));
  $("btnAuthSubmit").addEventListener("click", submitAuth);
  $("btnLogout").addEventListener("click", logoutUser);
}

async function initAuth() {
  const { data } = await supabaseClient.auth.getUser();
  currentUser = data?.user || null;
  updateUserUi();
  supabaseClient.auth.onAuthStateChange((_event, session) => { currentUser = session?.user || null; updateUserUi(); });
}

function updateUserUi() {
  const name = getDisplayName();
  $("userLabel").textContent = currentUser ? name : "Accedi";
  $("userAvatar").textContent = currentUser ? name.slice(0, 1).toUpperCase() : "?";
  $("btnLogout").classList.toggle("hidden", !currentUser);
  $("authMessage").textContent = currentUser ? `Accesso effettuato come ${name}.` : "Accedi per vedere i tuoi percorsi e pubblicare nuove tracce.";
}

function getDisplayName() { return currentUser?.user_metadata?.display_name || currentUser?.email?.split("@")[0] || "Utente"; }
function openAuthModal() { $("authModal").classList.add("open"); $("authModal").setAttribute("aria-hidden", "false"); }
function closeAuthModal() { $("authModal").classList.remove("open"); $("authModal").setAttribute("aria-hidden", "true"); }
function setAuthMode(mode) { authMode = mode; $("tabLogin").classList.toggle("active", mode === "login"); $("tabRegister").classList.toggle("active", mode === "register"); $("authName").classList.toggle("hidden", mode !== "register"); $("btnAuthSubmit").textContent = mode === "login" ? "Accedi" : "Registrati"; }
async function submitAuth() {
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;
  const displayName = $("authName").value.trim();
  if (!email || !password) { $("authMessage").textContent = "Inserisci email e password."; return; }
  const result = authMode === "login"
    ? await supabaseClient.auth.signInWithPassword({ email, password })
    : await supabaseClient.auth.signUp({ email, password, options: { data: { display_name: displayName || email.split("@")[0] } } });
  if (result.error) { $("authMessage").textContent = result.error.message; return; }
  currentUser = result.data?.user || result.data?.session?.user || currentUser;
  updateUserUi();
  $("authMessage").textContent = authMode === "register" ? "Registrazione completata. Se richiesto, conferma l'email." : "Accesso effettuato.";
}
async function logoutUser() { await supabaseClient.auth.signOut(); currentUser = null; updateUserUi(); closeAuthModal(); }

async function handleRouteFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = await parseRouteFile(file);
    if (parsed.points.length < 2) throw new Error("La traccia contiene meno di 2 punti.");
    current.sourceText = parsed.sourceText;
    current.sourceFormat = parsed.format;
    current.points = parsed.points;
    current.geojson = pointsToGeoJson(parsed.points);
    current.distanceM = calculateDistance(parsed.points);
    current.centroid = calculateCentroid(parsed.points);
    drawCurrentGeoJson(current.geojson, "Traccia caricata", true);
    updateStats();
    $("btnPublish").disabled = false;
    $("btnDownload").disabled = false;
    if (!$("trailTitle").value.trim()) $("trailTitle").value = file.name.replace(/\.[^.]+$/, "");
  } catch (err) { alert("Errore caricamento: " + err.message); }
}

async function parseRouteFile(file) {
  const ext = file.name.split(".").pop().toLowerCase();
  if (ext === "kmz") {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const kmlEntry = Object.values(zip.files).find(f => !f.dir && f.name.toLowerCase().endsWith(".kml"));
    if (!kmlEntry) throw new Error("KMZ senza file KML interno.");
    const text = await kmlEntry.async("text");
    return { points: parseKml(text), sourceText: text, format: "kml" };
  }
  const text = await file.text();
  if (ext === "kml") return { points: parseKml(text), sourceText: text, format: "kml" };
  if (ext === "gpx" || ext === "trk") return { points: parseGpxLike(text), sourceText: text, format: ext };
  throw new Error("Formato non supportato. Usa GPX, KML, KMZ o TRK.");
}

function parseGpxLike(text) {
  const xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("File XML non valido.");
  const nodes = [...xml.querySelectorAll("trkpt"), ...xml.querySelectorAll("rtept"), ...xml.querySelectorAll("wpt")];
  return nodes.map(node => ({
    lat: Number(node.getAttribute("lat") || node.querySelector("lat")?.textContent),
    lon: Number(node.getAttribute("lon") || node.getAttribute("lng") || node.querySelector("lon")?.textContent || node.querySelector("lng")?.textContent),
    ele: node.querySelector("ele") ? Number(node.querySelector("ele").textContent) : null,
    time: node.querySelector("time") ? node.querySelector("time").textContent : null
  })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon));
}

function parseKml(text) {
  const xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.querySelector("parsererror")) throw new Error("KML non valido.");
  const coordNodes = [...xml.querySelectorAll("LineString coordinates"), ...xml.querySelectorAll("gx\\:Track coord, Track coord")];
  const points = [];
  coordNodes.forEach(node => {
    const chunks = node.textContent.trim().split(/\s+/);
    chunks.forEach(chunk => {
      const vals = chunk.split(",").map(Number);
      if (vals.length >= 2 && Number.isFinite(vals[0]) && Number.isFinite(vals[1])) points.push({ lon: vals[0], lat: vals[1], ele: Number.isFinite(vals[2]) ? vals[2] : null });
    });
  });
  return points;
}

function pointsToGeoJson(points) { return { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: points.map(p => [p.lon, p.lat, p.ele].filter(v => v !== null && Number.isFinite(v))) } }; }
function geoJsonToPoints(geojson) { return (geojson?.geometry?.coordinates || []).map(c => ({ lon: Number(c[0]), lat: Number(c[1]), ele: c.length > 2 ? Number(c[2]) : null })).filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lon)); }

function drawCurrentGeoJson(geojson, title, zoom = true) { if (current.layer) map.removeLayer(current.layer); current.layer = L.geoJSON(geojson, { style: { weight: 5, color: "#0f5f2f", opacity: 0.95 } }).addTo(map).bindPopup(title || "Percorso"); if (zoom) map.fitBounds(current.layer.getBounds(), { padding: [30, 30] }); }
function drawPublishedRoute(trail) { if (publishedRouteLayer) map.removeLayer(publishedRouteLayer); publishedRouteLayer = L.geoJSON(trail.geojson, { style: { weight: 5, color: "#0f5f2f", opacity: 0.95 } }).addTo(map).bindPopup(escapeHtml(trail.title || "Percorso pubblicato")); publishedRouteLayer.openPopup(); map.fitBounds(publishedRouteLayer.getBounds(), { padding: [30, 30] }); }
function renderPublishedCluster(trails) { publishedCluster.clearLayers(); trails.forEach(trail => { const centroid = getTrailCentroid(trail); if (!centroid) return; const marker = L.marker([centroid.lat, centroid.lon]); marker.bindPopup(`<strong>${escapeHtml(trail.title || "Percorso")}</strong><br>${escapeHtml(trail.area || "Zona non indicata")}<br>${((trail.distance_m || 0) / 1000).toFixed(2)} km<br><em>Tocca il marker per visualizzare la traccia.</em>`); marker.on("click", () => drawPublishedRoute(trail)); publishedCluster.addLayer(marker); }); }

function calculateDistance(points) { let total = 0; for (let i = 1; i < points.length; i++) total += haversine(points[i - 1], points[i]); return total; }
function haversine(a, b) { const R = 6371000, toRad = d => d * Math.PI / 180; const dLat = toRad(b.lat - a.lat), dLon = toRad(b.lon - a.lon), lat1 = toRad(a.lat), lat2 = toRad(b.lat); const x = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2; return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)); }
function calculateCentroid(points) { if (!points.length) return null; const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.lat, lon: acc.lon + p.lon }), { lat: 0, lon: 0 }); return { lat: sum.lat / points.length, lon: sum.lon / points.length }; }
function getTrailCentroid(trail) { const latRaw = trail.centroid_lat, lonRaw = trail.centroid_lon; const hasStored = latRaw !== null && latRaw !== undefined && latRaw !== "" && lonRaw !== null && lonRaw !== undefined && lonRaw !== ""; if (hasStored) { const lat = Number(latRaw), lon = Number(lonRaw); if (Number.isFinite(lat) && Number.isFinite(lon) && isPlausibleTrailCoordinate(lat, lon)) return { lat, lon }; } const centroid = calculateCentroid(geoJsonToPoints(trail.geojson)); return centroid && isPlausibleTrailCoordinate(centroid.lat, centroid.lon) ? centroid : null; }
function isPlausibleTrailCoordinate(lat, lon) { return lat >= 37 && lat <= 43.5 && lon >= 6 && lon <= 12.8; }

function updateStats() { const km = (current.distanceM / 1000).toFixed(2); const elevations = current.points.map(p => p.ele).filter(Number.isFinite); const minEle = elevations.length ? Math.min(...elevations).toFixed(0) : "n.d."; const maxEle = elevations.length ? Math.max(...elevations).toFixed(0) : "n.d."; $("stats").innerHTML = `<strong>Punti:</strong> ${current.points.length}<br><strong>Lunghezza stimata:</strong> ${km} km<br><strong>Quota min/max:</strong> ${minEle} / ${maxEle} m`; }

async function publishTrail() {
  if (!currentUser) { openAuthModal(); $("authMessage").textContent = "Accedi o registrati per pubblicare il percorso."; return; }
  if (!current.sourceText || !current.geojson) return;
  const title = $("trailTitle").value.trim() || "Percorso senza nome";
  const area = $("trailArea").value.trim();
  const description = $("trailDescription").value.trim();
  const { error } = await supabaseClient.from("trails").insert({ user_id: currentUser.id, title, area, description, gpx_xml: current.sourceText, source_format: current.sourceFormat, geojson: current.geojson, distance_m: current.distanceM, centroid_lat: current.centroid?.lat ?? null, centroid_lon: current.centroid?.lon ?? null });
  if (error) { alert("Errore pubblicazione: " + error.message); return; }
  alert("Percorso pubblicato.");
  await loadPublishedTrails();
}

async function loadPublishedTrails() { setActiveNav("btnExplore"); const { data, error } = await supabaseClient.from("trails").select("id,user_id,title,area,description,distance_m,geojson,gpx_xml,source_format,centroid_lat,centroid_lon,created_at").order("created_at", { ascending: false }).limit(500); if (error) { $("trailList").textContent = "Errore caricamento: " + error.message; return; } allPublishedTrails = data || []; visiblePublishedTrails = allPublishedTrails; renderTrailList(visiblePublishedTrails); renderPublishedCluster(visiblePublishedTrails); $("searchStatus").textContent = `Percorsi caricati: ${allPublishedTrails.length}. Puoi cercare per nome o per comune.`; }

async function searchByName() { if (!allPublishedTrails.length) await loadPublishedTrails(); const words = $("trailNameSearch").value.trim().toLowerCase().split(/\s+/).filter(Boolean); if (!words.length) { resetSearch(); return; } visiblePublishedTrails = allPublishedTrails.filter(t => words.every(w => `${t.title || ""} ${t.area || ""} ${t.description || ""}`.toLowerCase().includes(w))); renderTrailList(visiblePublishedTrails); renderPublishedCluster(visiblePublishedTrails); $("resultCount").textContent = `(${visiblePublishedTrails.length})`; $("searchStatus").textContent = `${visiblePublishedTrails.length} percorsi trovati per “${$("trailNameSearch").value.trim()}”.`; }

async function showMyTrails() { if (!currentUser) { openAuthModal(); $("authMessage").textContent = "Accedi per vedere i tuoi percorsi."; return; } setActiveNav("btnMyTrails"); const { data, error } = await supabaseClient.from("trails").select("id,user_id,title,area,description,distance_m,geojson,gpx_xml,source_format,centroid_lat,centroid_lon,created_at").eq("user_id", currentUser.id).order("created_at", { ascending: false }); if (error) { $("trailList").textContent = "Errore caricamento: " + error.message; return; } visiblePublishedTrails = data || []; renderTrailList(visiblePublishedTrails); renderPublishedCluster(visiblePublishedTrails); $("searchStatus").textContent = `I tuoi percorsi: ${visiblePublishedTrails.length}.`; }

async function searchByMunicipality() { if (!allPublishedTrails.length) await loadPublishedTrails(); const name = $("municipalitySearch").value.trim(); const radiusKm = Number($("radiusKm").value || 10); if (!name) { alert("Inserisci il nome di un comune."); return; } $("searchStatus").textContent = "Ricerca del comune in corso..."; const place = await geocodeMunicipality(name); if (!place) { $("searchStatus").textContent = "Comune non trovato. Prova con nome e provincia, ad esempio: Dorgali, Nuoro."; return; } const center = { lat: place.lat, lon: place.lon }; visiblePublishedTrails = allPublishedTrails.filter(trail => { const centroid = getTrailCentroid(trail); return centroid && haversine(center, centroid) <= radiusKm * 1000; }); renderTrailList(visiblePublishedTrails); renderPublishedCluster(visiblePublishedTrails); drawSearchArea(center, radiusKm, place.label); $("searchStatus").textContent = `${visiblePublishedTrails.length} percorsi entro ${radiusKm} km da ${place.label}.`; }
async function geocodeMunicipality(name) { const url = new URL("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"); url.searchParams.set("f", "json"); url.searchParams.set("SingleLine", `${name}, Sardegna, Italia`); url.searchParams.set("countryCode", "ITA"); url.searchParams.set("maxLocations", "1"); url.searchParams.set("outFields", "PlaceName,City,Region"); const response = await fetch(url.toString()); if (!response.ok) return null; const first = (await response.json())?.candidates?.[0]; if (!first?.location) return null; return { lat: Number(first.location.y), lon: Number(first.location.x), label: first.address || name }; }
function drawSearchArea(center, radiusKm, label) { if (searchCircle) map.removeLayer(searchCircle); if (searchMarker) map.removeLayer(searchMarker); const selectedIcon = L.divIcon({ className: "custom-selected-marker", iconSize: [24, 24], iconAnchor: [12, 12] }); searchMarker = L.marker([center.lat, center.lon], { icon: selectedIcon }).addTo(map).bindPopup(escapeHtml(label)); searchCircle = L.circle([center.lat, center.lon], { radius: radiusKm * 1000, weight: 2, color: "#2d9b68", className: "search-circle", fillColor: "#7fd69c", fillOpacity: 0.10 }).addTo(map); map.fitBounds(searchCircle.getBounds(), { padding: [30, 30] }); }
function resetSearch() { visiblePublishedTrails = allPublishedTrails; renderTrailList(visiblePublishedTrails); renderPublishedCluster(visiblePublishedTrails); if (searchCircle) map.removeLayer(searchCircle); if (searchMarker) map.removeLayer(searchMarker); searchCircle = null; searchMarker = null; $("searchStatus").textContent = allPublishedTrails.length ? `Visualizzati tutti i percorsi: ${allPublishedTrails.length}.` : "Carica i percorsi pubblicati, poi cerca per nome o per comune."; }

function renderTrailList(trails) { const list = $("trailList"); $("resultCount").textContent = `(${trails.length})`; if (!trails.length) { list.classList.add("muted"); list.textContent = "Nessun percorso trovato."; return; } list.classList.remove("muted"); list.innerHTML = ""; trails.forEach((trail, index) => { const km = ((trail.distance_m || 0) / 1000); const difficulty = km > 14 ? "hard" : km > 8 ? "medium" : "easy"; const difficultyText = difficulty === "hard" ? "Difficile" : difficulty === "medium" ? "Media" : "Facile"; const card = document.createElement("article"); card.className = "trail-card"; card.innerHTML = `<div class="trail-thumb ${difficulty}"></div><div><h3>${escapeHtml(trail.title || "Percorso")}</h3><p>${escapeHtml(trail.area || "Zona non indicata")}</p><p class="trail-meta">${km.toFixed(1)} km · ${estimateElevationText(trail, index)}</p><span class="badge ${difficulty}">${difficultyText}</span><div class="card-actions"><button data-action="view" type="button">Vedi mappa</button><button data-action="download" type="button">Scarica</button></div></div>`; card.querySelector('[data-action="view"]').addEventListener("click", () => drawPublishedRoute(trail)); card.querySelector('[data-action="download"]').addEventListener("click", () => downloadText(`${safeFileName(trail.title)}.${trail.source_format || "gpx"}`, trail.gpx_xml || "")); list.appendChild(card); }); }
function estimateElevationText(trail, index) { if (trail.elevation_gain) return `${Math.round(trail.elevation_gain)} m disl.`; const fallback = [550, 950, 320, 430, 610, 780, 260, 890]; return `${fallback[index % fallback.length]} m disl.`; }
function downloadCurrentRoute() { const title = $("trailTitle").value.trim() || "percorso"; downloadText(`${safeFileName(title)}.${current.sourceFormat || "gpx"}`, current.sourceText); }
function downloadText(filename, text) { const blob = new Blob([text || ""], { type: "application/octet-stream" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url); }
function clearCurrent() { if (current.layer) map.removeLayer(current.layer); current = { sourceText: null, sourceFormat: "gpx", geojson: null, layer: null, distanceM: 0, points: [], centroid: null }; $("gpxFile").value = ""; $("trailTitle").value = ""; $("trailArea").value = ""; $("trailDescription").value = ""; $("stats").textContent = "Nessuna traccia caricata."; $("btnPublish").disabled = true; $("btnDownload").disabled = true; }
function setActiveNav(id) { ["btnExplore", "btnMyTrails"].forEach(btn => $(btn)?.classList.toggle("active", btn === id)); }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[c])); }
function safeFileName(value) { return String(value).toLowerCase().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "") || "percorso"; }
