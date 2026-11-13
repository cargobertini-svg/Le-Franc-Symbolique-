import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '@/lib/catalog';
import { toast } from 'sonner';
export const FREQUENCIES = [60, 230, 910, 3600, 14000];
export function useAudio(current: Track | null, playing: boolean, setPlaying: (v: boolean) => void, next: () => void, repeat: boolean, crossfade: boolean, volume: number, onEarn: () => void) {
 const players = useRef<HTMLAudioElement[]>([]); const active=useRef(0); const fading=useRef(false); const transition=useRef<ReturnType<typeof setInterval> | null>(null);
 const context=useRef<AudioContext | null>(null); const filters=useRef<BiquadFilterNode[]>([]); const bassNode=useRef<BiquadFilterNode | null>(null); const sources=useRef<MediaElementAudioSourceNode[]>([]);
 const [progress,setProgress]=useState(0);const [duration,setDuration]=useState(0); const [bands,setBands]=useState([0,0,0,0,0]);const [bass,setBass]=useState(false); const [eqEnabled,setEqEnabled]=useState(false);
 const live=useRef({next,repeat,crossfade,onEarn,playing,volume});live.current={next,repeat,crossfade,onEarn,playing,volume};
 useEffect(()=>{
  const a=new Audio();const b=new Audio(); a.preload='metadata';b.preload='metadata';a.crossOrigin='anonymous';b.crossOrigin='anonymous';players.current=[a,b];
  const handlers=players.current.map((p,index)=>{
   const time=()=>{if(index!==active.current)return;setProgress(p.currentTime);if(live.current.crossfade && !live.current.repeat && !fading.current && p.duration>6 && p.duration-p.currentTime<=3 && !p.paused){fading.current=true;live.current.next();}};
   const metadata=()=>{if(index===active.current)setDuration(Number.isFinite(p.duration)?p.duration:0);};
   const end=()=>{if(index!==active.current)return;if(live.current.repeat){p.currentTime=0;void p.play();}else live.current.next();};
   const error=()=>{if(index===active.current){setPlaying(false);toast.error('Lecture indisponible pour ce titre. Essayez le suivant.');}};
   p.addEventListener('timeupdate',time);p.addEventListener('loadedmetadata',metadata);p.addEventListener('ended',end);p.addEventListener('error',error);
   return()=>{p.removeEventListener('timeupdate',time);p.removeEventListener('loadedmetadata',metadata);p.removeEventListener('ended',end);p.removeEventListener('error',error);p.pause();p.src='';};
  });
  let lastTime=0;let lastPlayer:HTMLAudioElement|undefined;
  const timer=setInterval(()=>{const p=players.current[active.current];if(!p)return; const delta=p.currentTime-lastTime;if(p===lastPlayer && live.current.playing && !p.paused && p.readyState>=2 && delta>0 && delta<=1.6)live.current.onEarn();lastTime=p.currentTime;lastPlayer=p;},1000);
  return()=>{handlers.forEach(h=>h());clearInterval(timer);if(transition.current)clearInterval(transition.current);void context.current?.close();};
 },[]);
 useEffect(()=>{
  if(!current)return;let p=players.current[active.current];if(!p)return;
  if(p.dataset["id"]!==current.id){
    if(fading.current){const old=p;active.current=1-active.current;p=players.current[active.current];if(!p)return;const incoming=p; incoming.volume=0;const start=performance.now();if(transition.current)clearInterval(transition.current);transition.current=setInterval(()=>{const r=Math.min(1,(performance.now()-start)/3000);old.volume=live.current.volume*(1-r);incoming.volume=live.current.volume*r;if(r===1){old.pause();fading.current=false;if(transition.current)clearInterval(transition.current);transition.current=null;}},50);
   }else{players.current.forEach(x=>{if(x!==p)x.pause();});p.volume=volume;}
   p.dataset["id"]=current.id;p.src=current.url;setProgress(0);setDuration(current.duration);
  }
   if(playing){void context.current?.resume();const requested=p;const id=current.id;void p.play().catch(error=>{if(requested!==players.current[active.current]||requested.dataset['id']!==id||error?.name==='AbortError')return;setPlaying(false);toast.info('Appuyez sur Lecture pour démarrer le son.');});}else{players.current.forEach(x=>x.pause());if(transition.current){clearInterval(transition.current);transition.current=null;fading.current=false;p.volume=volume;}}
 },[current,playing]);
 useEffect(()=>{if(!fading.current)players.current.forEach(p=>p.volume=volume);},[volume]);
 const seek=useCallback((ratio:number)=>{const p=players.current[active.current];if(p && Number.isFinite(p.duration)){p.currentTime=Math.min(1,Math.max(0,ratio))*p.duration;setProgress(p.currentTime);}},[]);
 const enableEq=async()=>{
  try{if(!context.current){const ctx=new AudioContext();context.current=ctx;const nodes=FREQUENCIES.map((frequency,i)=>{const n=ctx.createBiquadFilter();n.type=i===0?'lowshelf':i===4?'highshelf':'peaking';n.frequency.value=frequency;n.Q.value=1;n.gain.value=bands[i]??0;return n;});filters.current=nodes;const boost=ctx.createBiquadFilter();boost.type='lowshelf';boost.frequency.value=100;boost.gain.value=bass?6:0;bassNode.current=boost;
   sources.current=players.current.map(p=>{const s=ctx.createMediaElementSource(p);const first=nodes[0];if(first)s.connect(first);return s;});nodes.forEach((n,i)=>n.connect(nodes[i+1]??boost));boost.connect(ctx.destination);
  }await context.current.resume();setEqEnabled(true);}catch{toast.error('Égaliseur indisponible dans ce navigateur.');}
 };
 const adjustBand=(i:number,value:number)=>{setBands(v=>v.map((x,j)=>j===i?value:x));const node=filters.current[i];if(node)node.gain.value=value;};
 const boostBass=(value:boolean)=>{setBass(value);if(bassNode.current)bassNode.current.gain.value=value?6:0;};
  useEffect(()=>{if(!current || !('mediaSession' in navigator) || typeof MediaMetadata==='undefined')return;navigator.mediaSession.metadata=new MediaMetadata({title:current.title,artist:current.artist,album:'Le Franc Symbolique'});navigator.mediaSession.setActionHandler('play',()=>setPlaying(true));navigator.mediaSession.setActionHandler('pause',()=>setPlaying(false));navigator.mediaSession.setActionHandler('nexttrack',()=>live.current.next());},[current]);
 return {progress,duration,seek,bands,bass,eqEnabled,enableEq,adjustBand,boostBass};
}