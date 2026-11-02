const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const moduleSource=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail.js'),'utf8');
const block=html.match(/<script id="austa-final-full-listing-js">([\s\S]*?)<\/script>/)[1];
const flush=async()=>{for(let i=0;i<8;i++)await new Promise(r=>setImmediate(r));};
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function fixture(options={}){
 const state={user:null,token:'token',rows:{},media:{},ops:[],listeners:[],signed:[],rendered:[],alerts:[],deleted:[],edited:[],promoted:[],profile:null};
 let document;
 class Element{
  constructor(tag='div'){this.tagName=tag;this.style={};this.dataset={};this.events={};this.children=[];this.nodes=new Map();this.isConnected=false;this.classList={add(){},remove(){},toggle(){}};this.attrs={};this.textContent='';}
  set innerHTML(v){this.markup=v;for(const e of this.nodes.values())e.isConnected=false;this.nodes.clear();}get innerHTML(){return this.markup||'';}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}
  appendChild(e){this.children.push(e);e.parentElement=this;e.isConnected=this.isConnected;return e;}
  remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(e=>e!==this);}
  focus(){document.activeElement=this;}
  addEventListener(k,fn){(this.events[k]??=[]).push(fn);}removeEventListener(){}
  async emit(k,event={}){for(const fn of this.events[k]||[])await fn({target:this,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){},...event});}
  closest(selector){return selector.split(',').some(s=>this.matches(s.trim()))?this:null;}
  matches(selector){if(selector==='video')return this.tagName==='video';const key=selector.match(/^\[([^=\]]+)/)?.[1];return key?Object.hasOwn(this.attrs,key):false;}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
  querySelectorAll(selector){
   if(selector.includes(','))return selector.split(',').flatMap(x=>this.querySelectorAll(x.trim()));
   if(this.nodes.has(selector))return this.nodes.get(selector).isConnected===false?[]:[this.nodes.get(selector)];
   const key=selector.match(/^\[([^=\]]+)/)?.[1];
   const wanted=selector.match(/="([^"]*)"/);
   const found=key?this.innerHTML.match(new RegExp('<[a-z]+\\b[^>]*\\b'+key+(wanted?'="('+wanted[1]+')"':'(?:="([^"]*)")?')+'[^>]*>','i')):selector==='video'?this.innerHTML.match(/<video\b[^>]*>/i):null;
   if(!found)return [];
   const e=new Element(selector==='video'?'video':'div');e.parentElement=this;e.isConnected=this.isConnected;
   for(const m of found[0].matchAll(/(data-[\w-]+)(?:="([^"]*)")?/g)){e.attrs[m[1]]=m[2]||'';e.dataset[m[1].slice(5).replace(/-([a-z])/g,(_,v)=>v.toUpperCase())]=m[2]||'';}
   e.pause=()=>{e.paused=true;};e.play=()=>Promise.resolve();e.hidden=/\bhidden\b/.test(found[0]);this.nodes.set(selector,e);return [e];
  }
 }
 const body=new Element('body');body.isConnected=true;
 document={body,activeElement:null,readyState:'loading',events:{},createElement:t=>new Element(t),addEventListener(k,fn){(this.events[k]??=[]).push(fn);},querySelector(){return null;},querySelectorAll(){return [];},getElementById(id){return body.children.find(e=>e.id===id&&e.isConnected)||null;}};
 const location={href:'https://a-usta.test/',hash:'',pathname:'/',search:''};
 const history={replaceState(_a,_b,url){const u=new URL(url,location.href);Object.assign(location,{href:u.href,hash:u.hash,pathname:u.pathname,search:u.search});}};
 const sb={auth:{async getSession(){return {data:{session:state.user?{user:{id:state.user},access_token:state.token}:null},error:null};},async getUser(){return {data:{user:state.user?{id:state.user}:null},error:null};},onAuthStateChange(fn){state.listeners.push(fn);return {data:{subscription:{unsubscribe(){state.listeners=state.listeners.filter(f=>f!==fn);}}}};}},
  from(table){const filters=[];let single=false;const q={delete(){state.ops.push({operation:'DIRECT_PARENT_DELETE',table});return q;},select(){return q;},eq(k,v){filters.push([k,v]);return q;},order(){return q;},maybeSingle(){single=true;return q;},then(ok,bad){const op={table,filters:filters.slice(),single};state.ops.push(op);return Promise.resolve().then(async()=>{
   if(state.beforeRead)await state.beforeRead(op);
   const data=(state.rows[table]||state.media[table]||[]).filter(r=>filters.every(([k,v])=>r[k]===v));
   return {data:single?(data[0]?{...data[0]}:null):data.map(r=>({...r})),error:null};}).then(ok,bad);}};return q;},
  storage:{from(bucket){return {async createSignedUrl(p){state.signed.push([bucket,p]);if(state.beforeSign)await state.beforeSign(p);return {data:{signedUrl:'https://signed.test/'+p},error:null};}};}}};
 const window={location,AUSTA_SUPABASE:sb,events:{},addEventListener(k,fn){(this.events[k]??=[]).push(fn);},dispatchEvent(){},AUSTA_V153:{mediaConfig(type){return type==='dealer'?{table:'auto_dealer_media',bucket:'auto-dealer-media'}:['service','usta'].includes(type)?{table:'service_provider_media',bucket:'provider-media'}:{table:'marketplace_listing_media',bucket:'marketplace-media'};},effectivePromotion(){return 'standard';}},
  AUSTA_MY_LISTINGS_V156:{async edit(item){state.edited.push(item);},async delete(item){state.deleted.push(item);return window.AUSTA_LISTING_MEDIA.deleteOwnedListing(item);}},
  AUSTA_LISTING_MEDIA:{async deleteOwnedListing(item){state.ops.push({operation:'storage-aware-delete',item});}},
  AUSTA_PROMOTION_V157:{async open(item,type){state.ops.push({operation:'promotion-authority'});try{await window.AUSTA_MY_LIFECYCLE.authorizePromotion(item);state.promoted.push(type);}catch{}}},
  AUSTA_SELLER_IDENTITY:{async resolveFresh(id){state.ops.push({operation:'seller',id});if(state.beforeSeller)await state.beforeSeller();return state.profile;},getForListing(){return state.profile;},label(p){return p.business_type;},isOfficial(p){return p.official_status==='approved';}},
  AUSTA_SELLER_PAGE:{open(id){state.sellerPage=id;}}};
 const c=vm.createContext({window,document,location,history,URL,URLSearchParams,navigator:{clipboard:{async writeText(v){state.shared=v;}}},console:{warn(){},error(){},log(){}},setTimeout(){},clearTimeout(){},setInterval(){},clearInterval(){},localStorage:{getItem(){return null;}},alert:v=>state.alerts.push(v),CSS:{escape:v=>v}});
 for(const file of ['assets/vehicle/technical.js','assets/vehicle/vin.js','assets/marketplace/seller-intent.js','assets/marketplace/listing-lifecycle.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c);
 vm.runInContext(options.moduleSource||moduleSource,c);
 // Execute the actual final detail IIFE, exporting helpers only for focused assertions.
 vm.runInContext((options.block||block).replace(/\}\)\(\);\s*$/,"window.__detail={specsFor,sellerOf,businessOf,priceOf,mediaGallery,hydrateSupabaseListingMedia};})();"),c);
 const config={vehicle:['vehicle_listings','listing_media'],marketplace:['marketplace_listings','marketplace_listing_media'],service_provider:['service_provider_listings','service_provider_media'],auto_dealer:['auto_dealer_listings','auto_dealer_media']};
 const api=window.AUSTA_LISTING_DETAIL;
 return {c,window,document,state,api,sb,location,Element,async open(source='vehicle',extra={}){const [table]=config[source];const row={id:'listing',owner_id:'owner',status:'active',...(source==='vehicle'?{listing_type:'sale'}:source==='marketplace'?{category:'parts'}:source==='service_provider'?{provider_type:'service'}:{}),title:'Listing',...extra};state.rows[table]=[row];return api.open(row.id,source);},row(source,extra={}){const [table]=config[source];const row={id:'listing',owner_id:'owner',status:'active',...(source==='vehicle'?{listing_type:'sale'}:source==='marketplace'?{category:'parts'}:source==='service_provider'?{provider_type:'service'}:{}),title:'Listing',...extra};(state.rows[table]??=[]).push(row);return row;},async auth(user){state.user=user;const session=user?{user:{id:user},access_token:state.token}:null;for(const fn of [...state.listeners])fn('SIGNED_IN',session);await flush();},page(){return document.getElementById('austaFinalListingPage');},async click(selector){const page=this.page(),target=page.querySelector(selector);if(!target)throw new Error('Missing '+selector);await page.emit('click',{target});},markup(){return this.page()?.innerHTML||'';}};
}
module.exports={fixture,flush,deferred,moduleSource,block,html};
