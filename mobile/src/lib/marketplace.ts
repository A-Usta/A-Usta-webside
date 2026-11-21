import type { SupabaseClient } from '@supabase/supabase-js';

export type CategoryKey = 'cars' | 'dealer' | 'service' | 'rent' | 'parts' | 'accessories' | 'moto' | 'special' | 'bus' | 'trailer' | 'water' | 'caravan' | 'plate' | 'usta' | 'insurance' | 'sober_driver' | 'leasing';
export type ListingSource = 'vehicle' | 'marketplace' | 'service_provider' | 'auto_dealer';
export type Category = { key: CategoryKey; title: string; icon: string; source: ListingSource; table: string; mediaTable: string; bucket: string; status: string; sourceValue?: string };
export type Listing = Record<string, any> & { id: string; _category: CategoryKey; _source: ListingSource; _media?: Media[] };
export type Media = { id: string; media_type: 'image' | 'video'; storage_path: string; sort_order: number; is_cover: boolean; url?: string };

export const CATEGORIES: Category[] = [
  {key:'cars',title:'Avtomobillər',icon:'truck',source:'vehicle',table:'vehicle_listings',mediaTable:'listing_media',bucket:'listing-media',status:'active',sourceValue:'sale'},
  {key:'dealer',title:'Avtosalonlar',icon:'home',source:'auto_dealer',table:'auto_dealer_listings',mediaTable:'auto_dealer_media',bucket:'auto-dealer-media',status:'active'},
  {key:'service',title:'Avtoservislər',icon:'tool',source:'service_provider',table:'public_service_provider_listings',mediaTable:'service_provider_media',bucket:'provider-media',status:'active',sourceValue:'service'},
  {key:'rent',title:'Rent a Car',icon:'key',source:'vehicle',table:'vehicle_listings',mediaTable:'listing_media',bucket:'listing-media',status:'active',sourceValue:'rent'},
  ...(['parts','accessories','moto','special','bus','trailer','water','caravan','plate'] as const).map((key)=>({key,title:({parts:'Ehtiyat hissələri',accessories:'Aksesuarlar',moto:'Moto / Skuter',special:'Xüsusi texnika',bus:'Avtobuslar',trailer:'Qoşqular',water:'Su nəqliyyatı',caravan:'Karavanlar',plate:'Dövlət nömrələri'} as const)[key],icon:'tag',source:'marketplace' as const,table:'marketplace_listings',mediaTable:'marketplace_listing_media',bucket:'marketplace-media',status:'active',sourceValue:key})),
  {key:'usta',title:'Ustalar',icon:'tool',source:'service_provider',table:'public_service_provider_listings',mediaTable:'service_provider_media',bucket:'provider-media',status:'active',sourceValue:'usta'},
  ...(['insurance','sober_driver','leasing'] as const).map((key)=>({key,title:({insurance:'Sığorta şirkətləri',sober_driver:'Ayıq sürücü',leasing:'Lizinq şirkətləri'} as const)[key],icon:'briefcase',source:'service_provider' as const,table:'public_service_provider_listings',mediaTable:'service_provider_media',bucket:'provider-media',status:'active',sourceValue:key})),
];

export const FAVORITE_SOURCE: Record<ListingSource,string> = {vehicle:'vehicle',marketplace:'marketplace',service_provider:'service_provider',auto_dealer:'auto_dealer'};
const FAVORITE_FK: Record<ListingSource,string> = {vehicle:'vehicle_listing_id',marketplace:'marketplace_listing_id',service_provider:'service_provider_listing_id',auto_dealer:'auto_dealer_listing_id'};
const now = () => Date.now();
export function promotionRank(row: Listing): number {
  if (!row.promotion_until || new Date(row.promotion_until).getTime() <= now()) return 0;
  return row.promotion_type === 'premium' ? 3 : row.promotion_type === 'vip' ? 2 : row.promotion_type === 'top' || row.last_boosted_at ? 1 : 0;
}
export function sortListings(rows: Listing[]): Listing[] {
  const timestamp=(value:unknown)=>{const result=Date.parse(String(value||''));return Number.isFinite(result)?result:0;};
  return [...rows].sort((a,b) => promotionRank(b)-promotionRank(a) || timestamp(b.last_boosted_at||b.created_at)-timestamp(a.last_boosted_at||a.created_at) || String(b.id).localeCompare(String(a.id)));
}

export function categoryConfig(key: string): Category | undefined { return CATEGORIES.find(item => item.key === key); }
export function detailSource(category: CategoryKey): ListingSource { return categoryConfig(category)!.source; }

export async function listHome(client: SupabaseClient, search = ''): Promise<Listing[]> {
  const term=escapeLike(search.trim());
  const vehicleTypes=['sale','rent'];
  const marketplaceTypes=CATEGORIES.filter(item=>item.source==='marketplace').map(item=>item.key);
  const read=(table:string,configure:(query:any)=>any)=>configure(client.from(table).select('*').eq('status','active'));
  const recentQueries=[
    read('vehicle_listings',query=>{let q=query.in('listing_type',vehicleTypes);if(term)q=q.or(`brand.ilike.%${term}%,model.ilike.%${term}%,description.ilike.%${term}%`);return q.order('created_at',{ascending:false}).limit(40);}),
    read('marketplace_listings',query=>{let q=query.in('category',marketplaceTypes);if(term)q=q.or(`title.ilike.%${term}%,brand.ilike.%${term}%,model.ilike.%${term}%,description.ilike.%${term}%`);return q.order('created_at',{ascending:false}).limit(40);}),
    read('public_service_provider_listings',query=>{let q=query.in('provider_type',['service','usta']);if(term)q=q.or(`title.ilike.%${term}%,name.ilike.%${term}%,specialty.ilike.%${term}%,services.ilike.%${term}%`);return q.order('created_at',{ascending:false}).limit(40);}),
    read('auto_dealer_listings',query=>{let q=query;if(term)q=q.or(`dealer_name.ilike.%${term}%,brands.ilike.%${term}%,about.ilike.%${term}%`);return q.order('created_at',{ascending:false}).limit(40);}),
  ];
  const promotionQueries=['vehicle_listings','marketplace_listings','public_service_provider_listings','auto_dealer_listings'].map(table=>
    client.from(table).select('*').eq('status','active').in('promotion_type',['premium','vip','top']).gt('promotion_until',new Date().toISOString()).order('promotion_until',{ascending:false}).limit(24)
  );
  const results=await Promise.all([...recentQueries,...promotionQueries]);
  for(const result of results) if(result.error) throw result.error;
  const rows:Listing[]=[];
  const add=(items:any[],source:ListingSource)=>items.forEach(row=>{
    let key:CategoryKey;
    if(source==='vehicle')key=row.listing_type==='rent'?'rent':'cars';
    else if(source==='marketplace')key=row.category;
    else if(source==='auto_dealer')key='dealer';
    else key=row.provider_type==='usta'?'usta':['leasing','insurance','sober_driver'].includes(row.details?.service_category)?row.details.service_category:'service';
    if(categoryConfig(key)) rows.push({...row,_category:key,_source:source});
  });
  add(results[0].data||[],'vehicle');add(results[1].data||[],'marketplace');add(results[2].data||[],'service_provider');add(results[3].data||[],'auto_dealer');
  add(results[4].data||[],'vehicle');add(results[5].data||[],'marketplace');add(results[6].data||[],'service_provider');add(results[7].data||[],'auto_dealer');
  const unique=[...new Map(rows.map(row=>[`${row._source}:${row.id}`,row])).values()];
  return sortListings(unique);
}

export async function listCategory(client: SupabaseClient, category: Category, options: {from?:number;to?:number;search?:string;brand?:string;model?:string;region?:string;minPrice?:string;maxPrice?:string;yearMin?:string;yearMax?:string;promotionsOnly?:boolean} = {}) {
  const {from=0,to=19,search='',brand='',model='',region='',minPrice='',maxPrice='',yearMin='',yearMax='',promotionsOnly=false}=options;
  let query:any=client.from(category.table).select('*').eq('status','active');
  if(category.source==='vehicle') query=query.eq('listing_type',category.sourceValue);
  else if(category.source==='marketplace') query=query.eq('category',category.sourceValue);
  else if(category.source==='auto_dealer') { /* dedicated dealer source */ }
  else if(category.source==='service_provider') {
    query=query.eq('provider_type', category.sourceValue==='usta'?'usta':'service');
    if(category.sourceValue==='service') query=query.or('details->>service_category.is.null,details->>service_category.not.in.(insurance,leasing,sober_driver)');
    if(['insurance','sober_driver','leasing'].includes(category.sourceValue||'')) query=query.contains('details',{service_category:category.sourceValue});
  }
  if(promotionsOnly) query=query.in('promotion_type',['premium','vip','top']).gt('promotion_until',new Date().toISOString());
  if(brand && ['vehicle','marketplace'].includes(category.source)) query=query.ilike('brand',`%${escapeLike(brand)}%`);
  if(model && ['vehicle','marketplace'].includes(category.source)) query=query.ilike('model',`%${escapeLike(model)}%`);
  if(region && category.source!=='service_provider') query=query.ilike('region',`%${escapeLike(region)}%`);
  const priceField=category.key==='rent'?'daily_price':'price';
  if(minPrice && ['vehicle','marketplace'].includes(category.source)) query=query.gte(priceField,Number(minPrice));
  if(maxPrice && ['vehicle','marketplace'].includes(category.source)) query=query.lte(priceField,Number(maxPrice));
  if(yearMin && category.source==='vehicle') query=query.gte('year',Number(yearMin));
  if(yearMax && category.source==='vehicle') query=query.lte('year',Number(yearMax));
  if(search.trim()) {
    const term=escapeLike(search.trim());
    if(category.source==='vehicle') query=query.or(`brand.ilike.%${term}%,model.ilike.%${term}%,description.ilike.%${term}%`);
    else if(category.source==='marketplace') query=query.or(`title.ilike.%${term}%,brand.ilike.%${term}%,model.ilike.%${term}%,description.ilike.%${term}%`);
    else if(category.source==='auto_dealer') query=query.or(`dealer_name.ilike.%${term}%,brands.ilike.%${term}%,about.ilike.%${term}%`);
    else query=query.or(`title.ilike.%${term}%,name.ilike.%${term}%,specialty.ilike.%${term}%,services.ilike.%${term}%`);
  }
  query=query.order(promotionsOnly?'promotion_until':'created_at',{ascending:false}).order('last_boosted_at',{ascending:false,nullsFirst:false}).order('id',{ascending:false}).range(from,to);
  const {data,error}=await query;
  if(error) throw error;
  return (data||[]).map((row:Record<string,any>)=>({...row,_category:category.key,_source:category.source} as Listing));
}

export async function attachMedia(client: SupabaseClient, category: Category, listing: Listing): Promise<Listing> {
  const {data,error}=await client.from(category.mediaTable).select('id,listing_id,storage_path,media_type,sort_order,is_cover,created_at').eq('listing_id',listing.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
  if(error) throw error;
  const rows=(data||[]).filter((item:Record<string,any>)=>item.listing_id===listing.id&&typeof item.storage_path==='string'&&['image','video'].includes(item.media_type));
  const media=await Promise.all(rows.map(async (item:Record<string,any>)=>{
    const {data:signed,error:signedError}=await client.storage.from(category.bucket).createSignedUrl(item.storage_path,3600);
    if(signedError||!signed?.signedUrl) return null;
    return {...item,url:signed.signedUrl} as Media;
  }));
  return {...listing,_media:media.filter(Boolean) as Media[]};
}

export async function getListing(client: SupabaseClient, category: Category, id: string) {
  const {data,error}=await client.from(category.table).select('*').eq('id',id).maybeSingle();
  if(error) throw error;
  if(!data || (data.status!=='active' && data.owner_id!== (await client.auth.getUser()).data.user?.id)) return null;
  return attachMedia(client,category,{...data,_category:category.key,_source:category.source} as Listing);
}

export async function getFavorites(client: SupabaseClient) {
  const {data:auth}=await client.auth.getUser();
  if(!auth.user) return {signedOut:true,listings:[] as Listing[]};
  const {data,error}=await client.from('listing_favorites').select('listing_source,listing_id').eq('user_id',auth.user.id);
  if(error) throw error;
  const items:Listing[]=[];
  for(const row of data||[]) {
    const candidates=CATEGORIES.filter(c=>c.source===row.listing_source);
    for(const category of candidates) {
      let query:any=client.from(category.table).select('*').eq('id',row.listing_id).eq('status','active');
      if(category.source==='vehicle')query=query.eq('listing_type',category.sourceValue);
      else if(category.source==='marketplace')query=query.eq('category',category.sourceValue);
      else if(category.source==='service_provider') {
        query=query.eq('provider_type',category.sourceValue==='usta'?'usta':'service');
        if(['leasing','insurance','sober_driver'].includes(category.sourceValue||''))query=query.contains('details',{service_category:category.sourceValue});
      }
      const {data:listing}=await query.maybeSingle();
      if(listing && category.source==='service_provider') {
        const subtype=listing.details?.service_category;
        if(category.sourceValue==='service' && ['leasing','insurance','sober_driver'].includes(subtype)) continue;
        if(['leasing','insurance','sober_driver'].includes(category.sourceValue||'') && subtype!==category.sourceValue) continue;
      }
      if(listing) { items.push(await attachMedia(client,category,{...listing,_category:category.key,_source:category.source} as Listing)); break; }
    }
  }
  return {signedOut:false,listings:items};
}

export async function toggleFavorite(client:SupabaseClient, listing:Listing) {
  const {data:auth,error:authError}=await client.auth.getUser();
  if(authError||!auth.user) throw new Error('Seçilmişlər üçün əvvəlcə hesabınıza daxil olun.');
  const source=listing._source, fk=FAVORITE_FK[source];
  const {data:existing,error}=await client.from('listing_favorites').select('listing_id').eq('user_id',auth.user.id).eq('listing_source',source).eq('listing_id',listing.id).maybeSingle();
  if(error) throw error;
  if(existing) { const result=await client.from('listing_favorites').delete().eq('user_id',auth.user.id).eq('listing_source',source).eq('listing_id',listing.id); if(result.error) throw result.error; return false; }
  const result=await client.from('listing_favorites').insert({user_id:auth.user.id,[fk]:listing.id});
  if(result.error) throw result.error;
  return true;
}

function escapeLike(value:string) { return value.replace(/[\\%_,()]/g, '\\$&'); }
