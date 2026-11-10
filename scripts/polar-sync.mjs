// Polar AccessLink -> encrypted data/polar.enc  (run by GitHub Actions)
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {pbkdf2Sync,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
const {POLAR_CLIENT_ID:CID,POLAR_CLIENT_SECRET:SEC,DATA_KEY:KEY,CODE:CODE,REDIRECT_URI:REDIR}=process.env;
if(!CID||!SEC||!KEY){console.error('Missing POLAR_CLIENT_ID / POLAR_CLIENT_SECRET / DATA_KEY secrets');process.exit(1)}
const API='https://www.polaraccesslink.com/v3';
const TOKEN_FILE='data/polar-token.enc',DATA_FILE='data/polar.enc';
mkdirSync('data',{recursive:true});
const b64=b=>Buffer.from(b).toString('base64'),ub=s=>Buffer.from(s,'base64');
const key=salt=>pbkdf2Sync(KEY,salt,200000,32,'sha256');
function enc(obj){const salt=randomBytes(16),iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key(salt),iv);
  const ct=Buffer.concat([c.update(JSON.stringify(obj),'utf8'),c.final(),c.getAuthTag()]);
  return JSON.stringify({v:1,salt:b64(salt),iv:b64(iv),ct:b64(ct)})}
function dec(txt){const j=JSON.parse(txt),salt=ub(j.salt),ct=ub(j.ct),tag=ct.subarray(ct.length-16),body=ct.subarray(0,ct.length-16);
  const d=createDecipheriv('aes-256-gcm',key(salt),ub(j.iv));d.setAuthTag(tag);return JSON.parse(Buffer.concat([d.update(body),d.final()]).toString('utf8'))}
const basic='Basic '+b64(`${CID}:${SEC}`);
async function link(code){
  const body=new URLSearchParams({grant_type:'authorization_code',code});if(REDIR)body.set('redirect_uri',REDIR);
  const r=await fetch('https://polarremote.com/v2/oauth2/token',{method:'POST',headers:{Authorization:basic,'Content-Type':'application/x-www-form-urlencoded',Accept:'application/json;charset=UTF-8'},body});
  const t=await r.json();if(!r.ok||!t.access_token){console.error('Token exchange failed',r.status,JSON.stringify(t).replace(/"access_token":"[^"]+"/,'"access_token":"…"'));process.exit(1)}
  const u=await fetch(`${API}/users`,{method:'POST',headers:{Authorization:'Bearer '+t.access_token,'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({'member-id':'einherjar'})});
  if(![200,201,409].includes(u.status)){console.error('User registration failed',u.status,await u.text());process.exit(1)}
  writeFileSync(TOKEN_FILE,enc({token:t.access_token,userId:t.x_user_id}));console.log('Linked Polar account. Registration status',u.status);
}
if(CODE&&!existsSync(TOKEN_FILE))await link(CODE.trim());else if(CODE)console.log('Already linked; ignoring the code.');
if(!existsSync(TOKEN_FILE)){console.error('Not linked yet. Run this workflow with the authorization code.');process.exit(1)}
const {token}=dec(readFileSync(TOKEN_FILE,'utf8'));
const get=async p=>{const r=await fetch(API+p,{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
  if(r.status===204||r.status===404)return null;if(!r.ok){console.error('GET',p,r.status,(await r.text()).slice(0,200));return null}return r.json()};
const [sleep,rech,acts]=await Promise.all([get('/users/sleep'),get('/users/nightly-recharge'),get('/users/activities')]);
const days={};const D=d=>days[d]||(days[d]={date:d});
const list=(x,...ks)=>{if(!x)return[];if(Array.isArray(x))return x;for(const k of ks)if(Array.isArray(x[k]))return x[k];return[]};
for(const n of list(sleep,'nights')){const d=D((n.sleep_end_time||'').slice(0,10)||n.date);
  if(n.sleep_score!=null)d.sleepScore=n.sleep_score;
  const secs=(n.light_sleep||0)+(n.deep_sleep||0)+(n.rem_sleep||0);if(secs)d.sleepHours=Math.round(secs/36)/100}
for(const r of list(rech,'recharges')){const d=D(r.date);
  if(r.heart_rate_variability_avg!=null)d.hrv=Math.round(r.heart_rate_variability_avg);
  if(r.heart_rate_avg!=null)d.restingHr=Math.round(r.heart_rate_avg)}
for(const a of list(acts)){const day=(a.start_time||'').slice(0,10);if(!day)continue;
  const steps=a.steps??(a.samples&&a.samples.steps&&a.samples.steps.total_steps);if(steps!=null)D(day).steps=steps}
let old={nights:[]};try{old=dec(readFileSync(DATA_FILE,'utf8'));if(old.schema!==2)old={nights:[]}}catch(e){}
const merged={};for(const n of old.nights||[])merged[n.date]=n;
for(const d of Object.values(days))merged[d.date]={...(merged[d.date]||{}),...d};
const nights=Object.values(merged).sort((a,b)=>a.date<b.date?-1:1).slice(-400);
writeFileSync(DATA_FILE,enc({schema:2,updatedAt:new Date().toISOString().slice(0,16).replace('T',' ')+' UTC',nights}));
console.log('Saved',nights.length,'days; newest',nights.at(-1)?.date);
