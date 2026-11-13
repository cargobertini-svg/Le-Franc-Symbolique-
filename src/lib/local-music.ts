import type { Track } from './catalog';
type Saved = { track: Track; blob: Blob; cover?: Blob };
function openDb(): Promise<IDBDatabase> { return new Promise((resolve,reject) => { const r=indexedDB.open('lfs-offline',1); r.onupgradeneeded=()=>r.result.createObjectStore('tracks',{keyPath:'track.id'}); r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); }); }
export async function saveAudio(track: Track, blob?: Blob) {
  const response = blob ? null : await fetch(track.url);
  if(response && !response.ok) throw new Error('Téléchargement refusé par le catalogue');
  const audio=blob ?? await response?.blob(); if(!audio?.size) throw new Error('Audio indisponible');
  let cover: Blob | undefined; try { if(track.cover) { const r=await fetch(track.cover); if(r.ok) cover=await r.blob(); } } catch { /* fallback cover */ }
  const db=await openDb(); await new Promise<void>((resolve,reject)=> {const tx=db.transaction('tracks','readwrite'); tx.objectStore('tracks').put({track,blob:audio,cover}); tx.oncomplete=()=>resolve(); tx.onerror=()=>reject(tx.error);}); db.close();
}
export async function loadAudio(): Promise<Track[]> { const db=await openDb(); const rows=await new Promise<Saved[]>((resolve,reject)=>{const r=db.transaction('tracks').objectStore('tracks').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return rows.map(r=>({...r.track,url:URL.createObjectURL(r.blob),cover:r.cover?URL.createObjectURL(r.cover):''})); }
export async function deleteAudio(id: string) { const db=await openDb(); await new Promise<void>((resolve,reject)=>{ const tx=db.transaction('tracks','readwrite');tx.objectStore('tracks').delete(id);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error); });db.close(); }