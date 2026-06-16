const SUPABASE_URL = "https://uvkboeiognxsmkufmzgs.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6InV2a2JvZWlvZ254c21rdWZtemdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk0NDY0MjMsImV4cCI6MjA5NTAyMjQyM30.XRefx4ztMwKU4O8Q6BS-KHZLuNGrBR-En35f1vLgEW8Q6BS-KHZLuNGrBR-En35f1vLgEW8";
// Se la key sopra è stata copiata male, sostituiscila con quella del portale.
let sb = null;
try { sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); } catch(e) { console.warn(e); }

const map = L.map('map', { zoomControl: true }).setView([40.1, 9.0], 8);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
  maxZoom: 19,
  attribution: 'Tiles © Esri'
}).addTo(map);

const els = id => document.getElementById(id);
const state = {
  tracking:false, watchId:null, timerId:null, elapsedId:null, startTime:null,
  lastAcceptedAt:0, points:[], currentMarker:null, line:null, wakeLock:null, lastBlob:null
};

function setMessage(t){ els('message').textContent = t; }
function setGps(t){ els('gpsStatus').textContent = t; }
function updateNet(){ const online=navigator.onLine; els('netBadge').textContent=online?'Online':'Offline'; els('netBadge').classList.toggle('offline',!online); }
window.addEventListener('online', updateNet); window.addEventListener('offline', updateNet); updateNet();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(console.warn);

async function requestWakeLock(){
  try { if ('wakeLock' in navigator) state.wakeLock = await navigator.wakeLock.request('screen'); } catch(e) { console.warn('WakeLock non disponibile', e); }
}
async function releaseWakeLock(){ try { await state.wakeLock?.release(); } catch(e){} state.wakeLock=null; }
document.addEventListener('visibilitychange', () => { if (state.tracking && document.visibilityState === 'visible') requestWakeLock(); });

function haversine(a,b){
  const R=6371000, toRad=d=>d*Math.PI/180;
  const dLat=toRad(b.lat-a.lat), dLon=toRad(b.lon-a.lon);
  const lat1=toRad(a.lat), lat2=toRad(b.lat);
  const x=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));
}
function totalDistance(){ let m=0; for(let i=1;i<state.points.length;i++) m+=haversine(state.points[i-1],state.points[i]); return m; }
function fmtTime(ms){ const s=Math.floor(ms/1000), h=String(Math.floor(s/3600)).padStart(2,'0'), m=String(Math.floor((s%3600)/60)).padStart(2,'0'), ss=String(s%60).padStart(2,'0'); return `${h}:${m}:${ss}`; }
function refreshStats(){ els('pointCount').textContent=state.points.length; els('distanceKm').textContent=(totalDistance()/1000).toFixed(2); if(state.startTime) els('elapsedTime').textContent=fmtTime(Date.now()-state.startTime); }
function drawPoint(p){
  if(!state.currentMarker){ state.currentMarker=L.marker([p.lat,p.lon],{icon:L.divIcon({className:'',html:'<div class="current-marker"></div>',iconSize:[18,18],iconAnchor:[9,9]})}).addTo(map); }
  state.currentMarker.setLatLng([p.lat,p.lon]);
  if(!state.line) state.line=L.polyline([], {color:'#0f5f2f',weight:5,opacity:.95}).addTo(map);
  state.line.setLatLngs(state.points.map(x=>[x.lat,x.lon]));
}
function acceptPosition(pos){
  if(!state.tracking) return;
  const now=Date.now(); const interval=Number(els('intervalSec').value)*1000; if(now-state.lastAcceptedAt < interval) return;
  const c=pos.coords; const minAcc=Number(els('minAccuracy').value);
  if(c.accuracy && c.accuracy > minAcc){ setGps(`Segnale scartato: precisione ${Math.round(c.accuracy)} m`); return; }
  const p={lat:c.latitude, lon:c.longitude, ele:c.altitude, acc:c.accuracy, time:new Date(pos.timestamp || now).toISOString()};
  state.points.push(p); state.lastAcceptedAt=now; drawPoint(p); refreshStats();
  setGps(`GPS: ${p.lat.toFixed(6)}, ${p.lon.toFixed(6)} · ±${Math.round(c.accuracy||0)} m`);
  localStorage.setItem('trailgis_current_track', JSON.stringify({name:els('trailName').value, area:els('trailArea').value, points:state.points}));
}
function startTracking(){
  if(!navigator.geolocation){ setMessage('GPS non disponibile su questo dispositivo.'); return; }
  state.tracking=true; state.points=[]; state.startTime=Date.now(); state.lastAcceptedAt=0; state.lastBlob=null;
  if(state.line) state.line.remove(); state.line=null;
  els('btnStart').disabled=true; els('btnStop').disabled=false; els('btnSaveGpx').disabled=true; els('btnUpload').disabled=true;
  requestWakeLock();
  state.watchId=navigator.geolocation.watchPosition(acceptPosition, err=>setGps('Errore GPS: '+err.message), {enableHighAccuracy:true, maximumAge:0, timeout:20000});
  state.elapsedId=setInterval(refreshStats,1000); setMessage('Tracciamento avviato. Su Android/Capacitor abiliteremo il background tracking reale.');
}
function stopTracking(){
  state.tracking=false; if(state.watchId!==null) navigator.geolocation.clearWatch(state.watchId); clearInterval(state.elapsedId); releaseWakeLock();
  els('btnStart').disabled=false; els('btnStop').disabled=true; els('btnSaveGpx').disabled=state.points.length<2; els('btnUpload').disabled=state.points.length<2;
  localStorage.removeItem('trailgis_current_track'); setMessage(`Traccia terminata: ${state.points.length} punti.`);
}
function escapeXml(s){ return String(s||'').replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c])); }
function buildGpx(){
  const name=escapeXml(els('trailName').value || 'Traccia TrailGIS');
  const area=escapeXml(els('trailArea').value || '');
  const trkpts=state.points.map(p=>`    <trkpt lat="${p.lat}" lon="${p.lon}">${p.ele!=null?`<ele>${p.ele}</ele>`:''}<time>${p.time}</time></trkpt>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="TrailGIS Tracker" xmlns="http://www.topografix.com/GPX/1/1">\n  <metadata><name>${name}</name><desc>${area}</desc><time>${new Date().toISOString()}</time></metadata>\n  <trk><name>${name}</name><desc>${area}</desc><trkseg>\n${trkpts}\n  </trkseg></trk>\n</gpx>`;
}
function saveGpx(){
  const gpx=buildGpx(); const blob=new Blob([gpx],{type:'application/gpx+xml'}); state.lastBlob=blob;
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=(els('trailName').value||'trailgis_track').replace(/[^a-z0-9_-]+/gi,'_')+'.gpx'; a.click(); URL.revokeObjectURL(a.href);
}
function queueTrack(){
  const q=JSON.parse(localStorage.getItem('trailgis_upload_queue')||'[]');
  q.push({id:crypto.randomUUID(), name:els('trailName').value||'Traccia senza nome', area:els('trailArea').value||'', gpx:buildGpx(), points:state.points, created_at:new Date().toISOString()});
  localStorage.setItem('trailgis_upload_queue', JSON.stringify(q)); updateQueue(); setMessage('Traccia messa in coda per upload/sincronizzazione.');
}
function updateQueue(){ els('queueCount').textContent = JSON.parse(localStorage.getItem('trailgis_upload_queue')||'[]').length; }
async function uploadTrack(){
  // Prima versione: coda locale. Integrazione Supabase trail/upload identica al portale nella fase successiva.
  queueTrack();
}
async function syncQueue(){
  const q=JSON.parse(localStorage.getItem('trailgis_upload_queue')||'[]');
  if(!q.length){ setMessage('Nessuna traccia in coda.'); return; }
  if(!navigator.onLine){ setMessage('Sei offline: sincronizzazione rimandata.'); return; }
  setMessage('Coda pronta. Nel prossimo step colleghiamo questo tasto alle tabelle del portale.');
}

els('btnStart').onclick=startTracking; els('btnStop').onclick=stopTracking; els('btnSaveGpx').onclick=saveGpx; els('btnUpload').onclick=uploadTrack; els('btnSync').onclick=syncQueue;
els('btnCenter').onclick=()=>{ if(state.currentMarker) map.setView(state.currentMarker.getLatLng(), 17); else navigator.geolocation?.getCurrentPosition(p=>map.setView([p.coords.latitude,p.coords.longitude],16)); };
updateQueue(); refreshStats();
