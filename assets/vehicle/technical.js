/* V169B — shared Vehicle/Rent technical form, payload and presentation contract. */
(function(){
'use strict';
const choices={
  drivetrain:{fwd:'Ön',rwd:'Arxa',awd_4wd:'Tam'},
  vehicle_condition:{new:'Yeni',used:'Sürülmüş'},
  market:{official_dealer:'Azərbaycan / Rəsmi diler',europe:'Avropa',usa:'ABŞ',canada:'Kanada',korea:'Koreya',japan:'Yaponiya',china:'Çin',gulf:'Körfəz ölkələri',russia_cis:'Rusiya / MDB',other:'Digər'},
  accident:{no_accident:'Vuruğu yoxdur',accident:'Vuruğu var',unknown:'Məlum deyil'},
  paint:{original_paint:'Rənglənməyib',repainted:'Rənglənib',partially_repainted:'Qismən rənglənib',unknown:'Məlum deyil'},
  repair:{no_repair_needed:'Təmir tələb etmir',repair_needed:'Təmir tələb edir',unknown:'Məlum deyil'}
};
const select=(key,label,options)=>[key,label,'select',Object.entries(options)];
const fields=[
  ['mileage','Yürüş (km)','number'],['body_type','Ban növü','text'],
  ['engine','Mühərrik haqqında məlumat','text'],
  ['engine_volume','Mühərrik həcmi (L)','number'],['horsepower','Mühərrik gücü (a.g.)','number'],
  ['fuel_type','Yanacaq','select',['Benzin','Dizel','Hibrid','Elektrik','Qaz','Digər']],
  ['transmission','Sürətlər qutusu','select',['Avtomat','Mexaniki','Robot','Variator']],
  select('drivetrain','Ötürücü',choices.drivetrain),select('vehicle_condition','Yeni / Sürülmüş',choices.vehicle_condition),
  ['seats','Yerlərin sayı','number'],
  select('damage_accident','Qəza vəziyyəti',choices.accident),select('damage_paint','Rənglənmə',choices.paint),
  select('damage_repair','Təmir vəziyyəti',choices.repair),select('market','Hansı bazar üçün yığılıb',choices.market),
  ['color','Rəng','text']
];
const keys=['mileage','body_type','engine','engine_volume','horsepower','fuel_type','transmission','drivetrain','vehicle_condition','seats','damage_condition','market','color'];
const own=(object,key)=>Object.prototype.hasOwnProperty.call(object,key);
const blank=value=>value===null || value===undefined || (typeof value==='string' && !value.trim());
const snapshots=new WeakMap();
function positive(value,label,integer,max=Infinity){
  if(blank(value))return null;
  if((typeof value!=='number' && typeof value!=='string') || !Number.isFinite(Number(value)) || Number(value)<=0 || (integer && !Number.isInteger(Number(value))) || Number(value)>max){
    throw new Error(label+': '+(integer?'müsbət tam ədəd daxil edin.':'sıfırdan böyük rəqəm daxil edin.'));
  }
  return Number(value);
}
function payload(input){
  const result={};
  keys.forEach(key=>{if(own(input,key) && input[key]!==undefined)result[key]=input[key];});
  for(const [key,label,integer,max] of [['engine_volume','Mühərrik həcmi',false,Infinity],['horsepower','Mühərrik gücü',true,2147483647],['seats','Yerlərin sayı',true,32767]]){
    if(own(result,key))result[key]=positive(result[key],label,integer,max);
  }
  for(const key of ['drivetrain','vehicle_condition','market']){
    if(!own(result,key))continue;
    if(blank(result[key]))result[key]=null;
    else if(!own(choices[key],result[key]))throw new Error('Texniki seçim düzgün deyil: '+fields.find(field=>field[0]===key)[1]);
  }
  if(own(result,'damage_condition')){
    const value=result.damage_condition;
    if(blank(value))result.damage_condition=null;
    else if(typeof value!=='object' || Array.isArray(value))throw new Error('Vəziyyət məlumatı düzgün formatda deyil.');
  }
  if(own(result,'mileage')){
    const value=result.mileage;
    if(blank(value))result.mileage=null;
    else if((typeof value!=='number' && typeof value!=='string') || !Number.isInteger(Number(value)) || Number(value)<0){
      throw new Error('Yürüş: 0 və ya müsbət tam ədəd daxil edin.');
    }else result.mileage=Number(value);
  }
  for(const key of ['body_type','engine','fuel_type','transmission','color'])if(own(result,key))result[key]=blank(result[key])?null:String(result[key]).trim();
  return result;
}
function remember(container,item){
  const damage=item.damage_condition;
  const values={};
  container.querySelectorAll('[data-v153c-key]').forEach(input=>{
    const key=input.dataset.v153cKey;
    if(keys.includes(key) || key.startsWith('damage_')){
      if(key.startsWith('damage_'))input.value=damage && typeof damage==='object' ? damage[key.slice(7)] ?? '' : '';
      else input.value=item[key] ?? '';
      // Preserve unknown legacy select values rather than silently choosing blank.
      if(input.tagName==='SELECT'){
        const raw=key.startsWith('damage_')?damage?.[key.slice(7)]:item[key];
        if(!blank(raw) && ![...input.options].some(option=>option.value===String(raw))){
          input.add(new Option('Əvvəlki dəyər: '+String(raw),String(raw)));input.value=String(raw);
        }
      }
      values[key]=input.value;
    }
  });
  snapshots.set(container,{values,damage});
}
function read(container,data,editing){
  const snapshot=editing?snapshots.get(container):null;
  const damageKeys=['accident','paint','repair'];
  const changed=damageKeys.filter(key=>!snapshot || data['damage_'+key]!==snapshot.values['damage_'+key]);
  if(changed.length){
    if(snapshot?.damage!=null && (typeof snapshot.damage!=='object' || Array.isArray(snapshot.damage)))throw new Error('Əvvəlki vəziyyət məlumatı tanınmır; onu avtomatik dəyişmək mümkün deyil.');
    const damage={...(snapshot?.damage || {})};
    changed.forEach(key=>{
      const value=data['damage_'+key];
      if(blank(value))delete damage[key];
      else if(!own(choices[key],value))throw new Error('Vəziyyət üçün düzgün seçim edin.');
      else damage[key]=value;
    });
    data.damage_condition=Object.keys(damage).length?damage:null;
  }
  damageKeys.forEach(key=>delete data['damage_'+key]);
  if(snapshot)keys.forEach(key=>{
    if(key!=='damage_condition' && data[key]===snapshot.values[key])delete data[key];
  });
  return data;
}
function pruneUpdate(row,input,type){
  const aliases={body_type:['body_type','bodyType'],fuel_type:['fuel_type','fuelType'],daily_price:type==='rent'?['daily_price','dailyPrice','price']:['daily_price','dailyPrice'],has_video:['has_video','hasVideo']};
  Object.keys(row).forEach(key=>{
    if(!(aliases[key] || [key]).some(source=>own(input,source) && input[source]!==undefined))delete row[key];
  });
  return Object.assign(row,payload(input));
}
function engineLabel(item,fuel){
  const volume=Number(item.engine_volume),power=Number(item.horsepower);
  const hasVolume=!blank(item.engine_volume) && Number.isFinite(volume) && volume>0;
  const hasPower=!blank(item.horsepower) && Number.isInteger(power) && power>0;
  if(!hasVolume && !hasPower)return {text:typeof item.engine==='string'?item.engine.trim():'',fuelIncluded:false};
  return {text:[hasVolume?(Number.isInteger(volume)?volume.toFixed(1):String(volume))+' L':'',hasPower?power+' a.g.':'',fuel].filter(Boolean).join(' / '),fuelIncluded:Boolean(fuel)};
}
function label(kind,value){
  return choices[kind] && own(choices[kind],value) ? choices[kind][value] : '';
}
function damageLabel(value){
  if(!value || typeof value!=='object' || Array.isArray(value))return '';
  return ['accident','paint','repair'].map(key=>label(key,value[key])).filter(Boolean).join(', ');
}
window.AUSTA_VEHICLE_TECHNICAL=Object.freeze({fields,keys,choices,payload,remember,read,pruneUpdate,engineLabel,damageLabel,label});
})();
