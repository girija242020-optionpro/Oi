import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import http from 'node:http';

const app=express();app.use(express.json({limit:'2mb'}));app.use(cors({origin:process.env.CORS_ORIGIN||'*'}));
const server=http.createServer(app);const wss=new WebSocketServer({server,path:'/ws'});let latest=null;let lastUpdated=0;const clients=new Set();
const num=v=>v!==null&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
function normalize(body){const spot=num(body?.spot?.price??body?.spotPrice??body?.spot);const chain=body?.optionChain??body?.chain??body?.strikes;if(spot===null||!Array.isArray(chain))throw new Error('Expected spot/spotPrice and optionChain[]');const optionChain=chain.map(x=>({strike:num(x.strike),ce:{oi:num(x.ce?.oi??x.call?.oi),ltp:num(x.ce?.ltp??x.ce?.premium??x.call?.ltp),volume:num(x.ce?.volume??x.call?.volume),bidQty:num(x.ce?.bidQty??x.call?.bidQty),askQty:num(x.ce?.askQty??x.call?.askQty)},pe:{oi:num(x.pe?.oi??x.put?.oi),ltp:num(x.pe?.ltp??x.pe?.premium??x.put?.ltp),volume:num(x.pe?.volume??x.put?.volume),bidQty:num(x.pe?.bidQty??x.put?.bidQty),askQty:num(x.pe?.askQty??x.put?.askQty)}})).filter(x=>x.strike!==null).sort((a,b)=>a.strike-b.strike);if(!optionChain.length)throw new Error('optionChain has no valid strikes');return{spot:{price:spot,timestamp:num(body?.spot?.timestamp??body?.timestamp)??Date.now()},timestamp:num(body?.timestamp)??Date.now(),optionChain,source:body?.source??'external-ingest'};}
function broadcast(){if(!latest)return;const msg=JSON.stringify({type:'state',state:latest});for(const c of clients){if(c.readyState===1)c.send(msg)}}
app.get('/api/health',(_req,res)=>res.json({ok:true,service:'nifty-oi-direction-backend',hasData:!!latest,lastUpdated: lastUpdated||null,ageMs:lastUpdated?Date.now()-lastUpdated:null,demoMode:process.env.DEMO_MODE==='true'}));
app.get('/api/status',(_req,res)=>res.json({ok:true,hasData:!!latest,lastUpdated:lastUpdated||null,ageMs:lastUpdated?Date.now()-lastUpdated:null,clients:clients.size}));
app.get('/api/state',(_req,res)=>{if(!latest)return res.status(503).json({error:'No option-chain snapshot received yet. Connect a live-data provider or POST a snapshot to /api/ingest.'});res.json({...latest,ageMs:Date.now()-lastUpdated,stale:Date.now()-lastUpdated>30000});});
app.get('/api/option-chain',(_req,res)=>{if(!latest)return res.status(503).json({error:'No option-chain data available'});res.json({spot:latest.spot,optionChain:latest.optionChain,timestamp:latest.timestamp,ageMs:Date.now()-lastUpdated});});
app.post('/api/ingest',(req,res)=>{const token=process.env.INGEST_TOKEN;if(token&&req.get('x-ingest-token')!==token)return res.status(401).json({error:'Invalid ingest token'});try{latest=normalize(req.body);lastUpdated=Date.now();broadcast();res.json({ok:true,receivedStrikes:latest.optionChain.length,timestamp:latest.timestamp});}catch(e){res.status(400).json({error:e.message});}});
app.get('/',(_req,res)=>res.json({service:'NIFTY OI Direction Engine API',health:'/api/health',state:'/api/state',ingest:'POST /api/ingest'}));
wss.on('connection',ws=>{clients.add(ws);if(latest)ws.send(JSON.stringify({type:'state',state:latest}));ws.on('close',()=>clients.delete(ws));ws.on('error',()=>clients.delete(ws));});
const port=Number(process.env.PORT||10000);server.listen(port,process.env.HOST||'0.0.0.0',()=>console.log(`NIFTY OI backend listening on ${port}`));
