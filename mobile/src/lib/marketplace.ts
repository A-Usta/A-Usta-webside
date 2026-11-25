import type { SupabaseClient } from '@supabase/supabase-js';

export type CategoryKey = 'cars' | 'dealer' | 'service' | 'rent' | 'parts' | 'accessories' | 'moto' | 'special' | 'bus' | 'trailer' | 'water' | 'caravan' | 'plate' | 'usta' | 'insurance' | 'sober_driver' | 'leasing';
export type ListingSource = 'vehicle' | 'marketplace' | 'service_provider' | 'auto_dealer';
export type Category = { key: CategoryKey; title: string; icon: string; source: ListingSource; table: string; mediaTable: string; bucket: string; status: string; sourceValue?: string };
export type Listing = Record<string, any> & { id: string; _category: CategoryKey; _source: ListingSource; _media?: Media[] };
export type Media = { id: string; media_type: 'image' | 'video'; storage_path: string; poster_path?: string | null; sort_order: number; is_cover: boolean; created_at?: string; url?: string; poster_url?: string };
export type CategoryFilter = { key: string; label: string; column: string; kind?: 'text' | 'number'; operator?: 'gte' | 'lte' };

// Mirrors the canonical web V157 promotion catalog. Mobile displays these
// tariffs only; client values never activate a promotion or authorize payment.
export const PROMOTION_CATALOG = {
  boost: { name: 'İrəli çək', icon: '↑', badge: 'Sürətli görünürlük', description: 'Elanınızı müəyyən intervallarla siyahıda yenidən yuxarı qaldırın.', plans: [
    { code: 'boost_3', label: '3 dəfə', detail: '8 saat intervalı ilə', price: 0.99 },
    { code: 'boost_9', label: '9 dəfə', detail: '8 saat intervalı ilə', price: 1.49, popular: true },
    { code: 'boost_15', label: '15 dəfə', detail: '8 saat intervalı ilə', price: 1.99 },
    { code: 'boost_30', label: '30 dəfə', detail: '8 saat intervalı ilə', price: 2.99 },
  ] },
  vip: { name: 'VIP', icon: '★', badge: 'Daha çox diqqət', description: 'Elanınıza VIP görünüş verin və daha çox istifadəçinin diqqətini cəlb edin.', plans: [
    { code: 'vip_1d', label: '1 gün', detail: 'VIP görünürlük', price: 1.49 },
    { code: 'vip_5d', label: '5 gün', detail: 'VIP görünürlük', price: 3.99, popular: true },
    { code: 'vip_15d', label: '15 gün', detail: 'VIP görünürlük', price: 7.99 },
    { code: 'vip_30d', label: '30 gün', detail: 'VIP görünürlük', price: 12.99 },
  ] },
  premium: { name: 'Premium', icon: '◆', badge: 'Maksimum görünürlük', description: 'VIP üstünlükləri və əlavə önə çıxarma imkanları ilə maksimum görünürlük.', plans: [
    { code: 'premium_1d', label: '1 gün', detail: 'Premium görünürlük', price: 2.49 },
    { code: 'premium_5d', label: '5 gün', detail: 'Premium görünürlük', price: 6.99 },
    { code: 'premium_15d', label: '15 gün', detail: 'Premium görünürlük', price: 14.99, popular: true },
    { code: 'premium_30d', label: '30 gün', detail: 'Premium görünürlük', price: 24.99 },
  ] },
} as const;
export type PromotionType = keyof typeof PROMOTION_CATALOG;

// Only columns exposed by the public listing DTOs and the documented JSON details
// are used. JSON detail fields are text searched so no unsafe numeric casts occur.
const f=(key:string,label:string,column=key,kind:'text'|'number'='text'):CategoryFilter=>({key,label,column,kind});
export const CATEGORY_FILTERS:Record<CategoryKey,CategoryFilter[]>={
  cars:[f('brand','Marka'),f('model','Model'),f('year','İl','year','number'),f('price','Qiymət min.','price','number'),{...f('price_max','Qiymət maks.','price','number'),operator:'lte'},f('mileage','Yürüş min.','mileage','number')],
  dealer:[f('dealer_name','Avtosalon'),f('brands','Marka','brands'),f('region','Şəhər')],
  service:[f('specialty','Xidmət növü','specialty'),f('region','Şəhər'),f('services','Xidmət')],
  rent:[f('brand','Marka'),f('model','Model'),f('daily_price','Günlük qiymət min.','daily_price','number'),{...f('daily_price_max','Günlük qiymət maks.','daily_price','number'),operator:'lte'},f('rental_type','İcarə müddəti','details->>rental_type'),f('region','Şəhər')],
  parts:[f('title','Hissə növü','title'),f('brand','Marka'),f('model','Model'),f('price','Qiymət min.','price','number'),f('oem','OEM / kod','details->>oem')],
  accessories:[f('title','Aksessuar növü','title'),f('brand','Marka'),f('model','Model'),f('price','Qiymət min.','price','number')],
  moto:[f('moto_type','Nəqliyyat növü','details->>moto_type'),f('brand','Marka'),f('model','Model'),f('year','İl','year','number'),f('price','Qiymət min.','price','number')],
  special:[f('special_type','Texnika növü','details->>special_type'),f('brand','Marka'),f('model','Model'),f('year','İl','year','number'),f('price','Qiymət min.','price','number')],
  bus:[f('brand','Marka'),f('model','Model'),f('year','İl','year','number'),f('sale_rent','Satış / icarə','details->>sale_rent'),f('price','Qiymət min.','price','number')],
  trailer:[f('trailer_type','Qoşqu növü','details->>trailer_type'),f('brand','Marka'),f('model','Model'),f('price','Qiymət min.','price','number'),f('region','Şəhər')],
  water:[f('water_type','Su nəqliyyatı növü','details->>water_type'),f('brand','Marka'),f('model','Model'),f('year','İl','year','number'),f('price','Qiymət min.','price','number')],
  caravan:[f('caravan_type','Karavan növü','details->>caravan_type'),f('brand','Marka'),f('model','Model'),f('year','İl','year','number'),f('price','Qiymət min.','price','number')],
  plate:[f('plate_number','Nömrə','details->>plate_number'),f('plate_series','Seriya','details->>plate_series'),f('price','Qiymət min.','price','number'),f('region','Şəhər')],
  usta:[f('specialty','İxtisas','specialty'),f('region','Xidmət ərazisi','region'),f('services','Xidmət','services')],
  insurance:[f('company_name','Şirkət','details->>company_name'),f('city','Şəhər','details->>city'),f('insurance_types','Sığorta növü','details->>insurance_types')],
  sober_driver:[f('city','Şəhər','details->>city'),f('service_area','Xidmət ərazisi','details->>service_area'),f('service_24_7','24/7 xidmət','details->>service_24_7')],
  leasing:[f('company_name','Şirkət','details->>company_name'),f('city','Şəhər','details->>city'),f('vehicle_condition','Avtomobil vəziyyəti','details->>vehicle_condition'),f('customer_types','Müştəri növü','details->>customer_types')],
};

export function categoryFilterValues(key:CategoryKey,values:Record<string,string>):Record<string,string>{
  const allowed=new Set((CATEGORY_FILTERS[key]||[]).map(item=>item.key));
  return Object.fromEntries(Object.entries(values).filter(([name,value])=>allowed.has(name)&&String(value).trim()!==''));
}
export function categoryFilterError(key:CategoryKey,values:Record<string,string>):string|null{
  for(const field of CATEGORY_FILTERS[key]||[]){const raw=String(values[field.key]||'').trim();if(!raw)continue;if(field.kind==='number'&&(!Number.isFinite(Number(raw))||Number(raw)<0))return `${field.label}: sıfır və ya müsbət rəqəm daxil edin.`;}
  for(const [minKey,maxKey,label] of [['price','price_max','Qiymət'],['daily_price','daily_price_max','Günlük qiymət']] as const){const min=values[minKey],max=values[maxKey];if(min&&max&&Number(min)>Number(max))return `${label}: minimum maksimumdan böyük ola bilməz.`;}
  return null;
}

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
  const current=now(), starts=Date.parse(String(row.promotion_started_at||'')), ends=Date.parse(String(row.promotion_until||''));
  if (!Number.isFinite(starts) || !Number.isFinite(ends) || starts>current || ends<=current) return 0;
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
    client.from(table).select('*').eq('status','active').in('promotion_type',['premium','vip','top']).lte('promotion_started_at',new Date().toISOString()).gt('promotion_until',new Date().toISOString()).order('promotion_until',{ascending:false}).limit(24)
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

/** Public video feed, sourced only from active listings and their already-published video media. */
export async function listHomeVideos(client: SupabaseClient, limit=24): Promise<Listing[]> {
  // The public video feed is intentionally limited at query-source level to
  // cars/rent and dealer listings. Other category videos remain attached to
  // their own listing details and are never deleted or moved.
  const sources=[
    {source:'vehicle' as const,mediaTable:'listing_media',table:'vehicle_listings',bucket:'listing-media'},
    {source:'auto_dealer' as const,mediaTable:'auto_dealer_media',table:'auto_dealer_listings',bucket:'auto-dealer-media'},
  ];
  const perSourceTarget=Math.max(4,Math.ceil(limit/sources.length));
  const result=await Promise.all(sources.map(async source=>{
    const found=new Map<string,Listing>();
    // Page media before filtering parent listings so old public videos are not
    // hidden behind recent uploads that belong to drafts or inactive listings.
    for(let page=0;page<16&&found.size<perSourceTarget;page++){
      const offset=page*80;
      const mediaResult=await client.from(source.mediaTable).select('id,listing_id,storage_path,poster_path,media_type,sort_order,is_cover,created_at').eq('media_type','video').order('created_at',{ascending:false}).range(offset,offset+79);
      if(mediaResult.error)throw mediaResult.error;
      const media=(mediaResult.data||[]).filter((row:Record<string,any>)=>typeof row.listing_id==='string'&&typeof row.storage_path==='string');
      if(!media.length)break;
      let query:any=client.from(source.table).select('*').eq('status','active').in('id',[...new Set(media.map((row:Record<string,any>)=>row.listing_id))]);
      if(source.source==='vehicle')query=query.in('listing_type',['sale','rent']);
      const parentResult=await query;
      if(parentResult.error)throw parentResult.error;
      const parents=new Map((parentResult.data||[]).map((row:Record<string,any>)=>[String(row.id),row]));
      const grouped=new Map<string,Media[]>();
      await Promise.all(media.filter((row:Record<string,any>)=>parents.has(String(row.listing_id))).map(async(row:Record<string,any>)=>{
        const signed=await client.storage.from(source.bucket).createSignedUrl(row.storage_path,3600);
        if(signed.error||!signed.data?.signedUrl)return;
        let poster_url:string|undefined;
        if(typeof row.poster_path==='string'){
          const poster=await client.storage.from(source.bucket).createSignedUrl(row.poster_path,3600);
          if(!poster.error&&poster.data?.signedUrl)poster_url=poster.data.signedUrl;
        }
        const list=grouped.get(String(row.listing_id))||[];list.push({...row,url:signed.data.signedUrl,poster_url} as Media);grouped.set(String(row.listing_id),list);
      }));
      for(const row of parentResult.data||[]){
        const videos=grouped.get(String(row.id));if(!videos?.length)continue;
        let key:CategoryKey;
        if(source.source==='vehicle')key=row.listing_type==='rent'?'rent':'cars';
        else key='dealer';
        if(categoryConfig(key))found.set(String(row.id),{...row,_category:key,_source:source.source,_media:videos} as Listing);
      }
      if(media.length<80)break;
    }
    return [...found.values()];
  }));
  return result.flat().sort((a,b)=>Date.parse(String(b._media?.[0]?.created_at||b.created_at||''))-Date.parse(String(a._media?.[0]?.created_at||a.created_at||''))).slice(0,limit);
}

export async function listCategory(client: SupabaseClient, category: Category, options: {from?:number;to?:number;search?:string;brand?:string;model?:string;region?:string;minPrice?:string;maxPrice?:string;yearMin?:string;yearMax?:string;promotionsOnly?:boolean;filters?:Record<string,string>} = {}) {
  const {from=0,to=19,search='',brand='',model='',region='',minPrice='',maxPrice='',yearMin='',yearMax='',promotionsOnly=false,filters={}}=options;
  let query:any=client.from(category.table).select('*').eq('status','active');
  if(category.source==='vehicle') query=query.eq('listing_type',category.sourceValue);
  else if(category.source==='marketplace') query=query.eq('category',category.sourceValue);
  else if(category.source==='auto_dealer') { /* dedicated dealer source */ }
  else if(category.source==='service_provider') {
    query=query.eq('provider_type', category.sourceValue==='usta'?'usta':'service');
    if(category.sourceValue==='service') query=query.or('details->>service_category.is.null,details->>service_category.not.in.(insurance,leasing,sober_driver)');
    if(['insurance','sober_driver','leasing'].includes(category.sourceValue||'')) query=query.contains('details',{service_category:category.sourceValue});
  }
  if(promotionsOnly) query=query.in('promotion_type',['premium','vip','top']).lte('promotion_started_at',new Date().toISOString()).gt('promotion_until',new Date().toISOString());
  if(brand && ['vehicle','marketplace'].includes(category.source)) query=query.ilike('brand',`%${escapeLike(brand)}%`);
  if(model && ['vehicle','marketplace'].includes(category.source)) query=query.ilike('model',`%${escapeLike(model)}%`);
  if(region && category.source!=='service_provider') query=query.ilike('region',`%${escapeLike(region)}%`);
  const priceField=category.key==='rent'?'daily_price':'price';
  if(minPrice && ['vehicle','marketplace'].includes(category.source)) query=query.gte(priceField,Number(minPrice));
  if(maxPrice && ['vehicle','marketplace'].includes(category.source)) query=query.lte(priceField,Number(maxPrice));
  if(yearMin && category.source==='vehicle') query=query.gte('year',Number(yearMin));
  if(yearMax && category.source==='vehicle') query=query.lte('year',Number(yearMax));
  for(const field of CATEGORY_FILTERS[category.key]||[]){
    const value=String(filters[field.key]||'').trim();if(!value)continue;
    if(field.kind==='number'){
      const amount=Number(value);if(Number.isFinite(amount)&&amount>=0)query=field.operator==='lte'?query.lte(field.column,amount):query.gte(field.column,amount);
    }else query=query.ilike(field.column,`%${escapeLike(value)}%`);
  }
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
  const {data,error}=await client.from(category.mediaTable).select('id,listing_id,storage_path,poster_path,media_type,sort_order,is_cover,created_at').eq('listing_id',listing.id).order('sort_order',{ascending:true}).order('created_at',{ascending:true});
  if(error) throw error;
  const rows=(data||[]).filter((item:Record<string,any>)=>item.listing_id===listing.id&&typeof item.storage_path==='string'&&['image','video'].includes(item.media_type));
  const media=await Promise.all(rows.map(async (item:Record<string,any>)=>{
    const {data:signed,error:signedError}=await client.storage.from(category.bucket).createSignedUrl(item.storage_path,3600);
    if(signedError||!signed?.signedUrl) return null;
    let poster_url:string|undefined;
    if(item.media_type==='video'&&typeof item.poster_path==='string'){
      const poster=await client.storage.from(category.bucket).createSignedUrl(item.poster_path,3600);
      if(!poster.error&&poster.data?.signedUrl)poster_url=poster.data.signedUrl;
    }
    return {...item,url:signed.signedUrl,poster_url} as Media;
  }));
  return {...listing,_media:media.filter(Boolean) as Media[]};
}

/** Delete a listing and its media using the same owner/path checks as the web lifecycle. */
export async function deleteOwnedListing(client: SupabaseClient, category: Category, listing: Listing): Promise<void> {
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError) throw authError;
  const ownerId = auth.user?.id;
  if (!ownerId || listing.owner_id !== ownerId) throw new Error('Elanı silmək üçün sahiblik təsdiqlənməlidir.');
  const sourceConfig: Record<ListingSource, { table: string; mediaTable: string; bucket: string }> = {
    vehicle: { table: 'vehicle_listings', mediaTable: 'listing_media', bucket: 'listing-media' },
    marketplace: { table: 'marketplace_listings', mediaTable: 'marketplace_listing_media', bucket: 'marketplace-media' },
    service_provider: { table: 'service_provider_listings', mediaTable: 'service_provider_media', bucket: 'provider-media' },
    auto_dealer: { table: 'auto_dealer_listings', mediaTable: 'auto_dealer_media', bucket: 'auto-dealer-media' },
  };
  const config = sourceConfig[category.source];
  const parent = await client.from(config.table).select('id,owner_id').eq('id', listing.id).eq('owner_id', ownerId).maybeSingle();
  if (parent.error) throw parent.error;
  if (!parent.data || parent.data.owner_id !== ownerId) throw new Error('Elan tapılmadı və ya artıq silinib.');
  const media = await client.from(config.mediaTable).select('id,storage_path,poster_path').eq('listing_id', listing.id).eq('owner_id', ownerId);
  if (media.error) throw media.error;
  const rows = media.data || [];
  const paths = [...new Set(rows.flatMap((row: Record<string, any>) => [row.storage_path,row.poster_path].filter((path):path is string=>typeof path==='string'&&path.length>0)))];
  if (paths.some(path => typeof path !== 'string' || !path.startsWith(`${ownerId}/${listing.id}/`) || path.split('/').length !== 3 || !path.split('/')[2])) {
    throw new Error('Elan mediasının sahibliyi təsdiqlənmədi; elan silinmədi.');
  }
  for (let offset = 0; offset < paths.length; offset += 100) {
    const batch = paths.slice(offset, offset + 100);
    const removed = await client.storage.from(config.bucket).remove(batch);
    if (removed.error || !Array.isArray(removed.data) || batch.some(path => !removed.data.some((file: Record<string, any>) => file.name === path))) {
      throw new Error('Elan mediası tam silinmədi. Elan dəyişdirilmədi; yenidən yoxlayın.');
    }
  }
  if (rows.length) {
    const deletedMedia = await client.from(config.mediaTable).delete().eq('listing_id', listing.id).eq('owner_id', ownerId).select('id');
    if (deletedMedia.error || !Array.isArray(deletedMedia.data) || deletedMedia.data.length !== rows.length) {
      throw new Error('Elan mediasının qeydləri təmizlənmədi. Elan silinmədi; yenidən yoxlayın.');
    }
  }
  const deleted = await client.from(config.table).delete().eq('id', listing.id).eq('owner_id', ownerId).select('id');
  if (deleted.error || !Array.isArray(deleted.data) || deleted.data.length !== 1 || deleted.data[0].id !== listing.id) {
    throw new Error('Elan silinmədi. Sahiblik və statusu yeniləyib yoxlayın.');
  }
}

/** Create only a server-priced, idempotent pending intent. It never charges or activates. */
export async function createPromotionPaymentIntent(client: SupabaseClient, listing: Listing, planCode: string, requestId: string) {
  const { data, error } = await client.rpc('austa_create_promotion_payment_intent', {
    p_source: listing._source, p_listing_id: listing.id, p_plan_code: planCode, p_request_id: requestId,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || row.status !== 'pending' || row.currency !== 'AZN' || !Number.isInteger(Number(row.amount_minor)) || Number(row.amount_minor) < 1) {
    throw new Error('Ödəniş sorğusunun təhlükəsiz statusu təsdiqlənmədi.');
  }
  return { id: String(row.intent_id), amountMinor: Number(row.amount_minor), currency: row.currency as 'AZN', status: 'pending' as const };
}

export async function getListing(client: SupabaseClient, category: Category, id: string) {
  const {data,error}=await client.from(category.table).select('*').eq('id',id).maybeSingle();
  if(error) throw error;
  if(!data || (data.status!=='active' && data.owner_id!== (await client.auth.getUser()).data.user?.id)) return null;
  return attachMedia(client,category,{...data,_category:category.key,_source:category.source} as Listing);
}

/** Public, verified seller profile listings only; respects each category's existing read policy. */
export async function listSellerProfileListings(client: SupabaseClient, sellerProfileId: string): Promise<Listing[]> {
  const results = await Promise.all(CATEGORIES.map(async category => {
    let query: any = client.from(category.table).select('*').eq('seller_profile_id', sellerProfileId).eq('status', 'active');
    if (category.source === 'vehicle') query = query.eq('listing_type', category.sourceValue);
    else if (category.source === 'marketplace') query = query.eq('category', category.sourceValue);
    else if (category.source === 'service_provider') {
      query = query.eq('provider_type', category.sourceValue === 'usta' ? 'usta' : 'service');
      if (['leasing', 'insurance', 'sober_driver'].includes(category.sourceValue || '')) query = query.contains('details', { service_category: category.sourceValue });
    }
    const { data, error } = await query.order('created_at', { ascending: false }).limit(12);
    if (error) return [] as Listing[];
    const rows = (data || []).filter((row: Listing) => category.source !== 'service_provider' || category.sourceValue !== 'service' || !['leasing', 'insurance', 'sober_driver'].includes(String(row.details?.service_category || '')));
    return Promise.all(rows.map((row: Listing) => attachMedia(client, category, {
      ...row, _category: category.key, _source: category.source,
    })));
  }));
  return results.flat().sort((a, b) => Date.parse(String(b.published_at || b.created_at || '')) - Date.parse(String(a.published_at || a.created_at || '')));
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

/** Fetch the authenticated user's compact favorite key set for consistent card hearts. */
export async function getFavoriteKeys(client: SupabaseClient): Promise<Set<string>> {
  const {data:auth,error:authError}=await client.auth.getUser();
  if(authError)throw authError;
  if(!auth.user)return new Set();
  const {data,error}=await client.from('listing_favorites').select('listing_source,listing_id').eq('user_id',auth.user.id);
  if(error)throw error;
  return new Set((data||[]).map((row:any)=>`${row.listing_source}:${row.listing_id}`));
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

export type VideoEngagement={view_count:number;like_count:number;comment_count:number;viewer_liked:boolean};
export type VideoComment={comment_id:string;body:string;created_at:string;is_mine:boolean};
export async function getVideoEngagement(client:SupabaseClient,listing:Listing):Promise<VideoEngagement>{
  const {data,error}=await client.rpc('austa_get_video_engagement',{p_source:listing._source,p_listing_id:listing.id});
  if(error)throw error;const row=Array.isArray(data)?data[0]:data;
  if(!row)throw new Error('Video statistikası hazırda əlçatan deyil.');
  return {view_count:Number(row.view_count)||0,like_count:Number(row.like_count)||0,comment_count:Number(row.comment_count)||0,viewer_liked:Boolean(row.viewer_liked)};
}
export async function recordVideoView(client:SupabaseClient,listing:Listing,visitorId:string):Promise<number>{
  const {data,error}=await client.rpc('austa_record_video_view',{p_source:listing._source,p_listing_id:listing.id,p_visitor_id:visitorId});
  if(error)throw error;return Number(data)||0;
}
export async function toggleVideoLike(client:SupabaseClient,listing:Listing):Promise<boolean>{
  const {data,error}=await client.rpc('austa_toggle_video_like',{p_source:listing._source,p_listing_id:listing.id});
  if(error)throw error;return Boolean(data);
}
export async function listVideoComments(client:SupabaseClient,listing:Listing):Promise<VideoComment[]>{
  const {data,error}=await client.rpc('austa_list_video_comments',{p_source:listing._source,p_listing_id:listing.id});
  if(error)throw error;return Array.isArray(data)?data as VideoComment[]:[];
}
export async function addVideoComment(client:SupabaseClient,listing:Listing,body:string):Promise<VideoComment>{
  const {data,error}=await client.rpc('austa_add_video_comment',{p_source:listing._source,p_listing_id:listing.id,p_body:body});
  if(error)throw error;const row=Array.isArray(data)?data[0]:data;if(!row)throw new Error('Şərh göndərilmədi. Yenidən cəhd edin.');return row as VideoComment;
}
export async function deleteVideoComment(client:SupabaseClient,commentId:string):Promise<boolean>{
  const {data,error}=await client.rpc('austa_delete_video_comment',{p_comment_id:commentId});if(error)throw error;return Boolean(data);
}

function escapeLike(value:string) { return value.replace(/[\\%_,()]/g, '\\$&'); }
