'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'assets/marketplace/listing-cards.js'),'utf8');
const css=fs.readFileSync(path.join(root,'assets/marketplace/listing-cards.css'),'utf8');
function api(){
 const window={AUSTA_VEHICLE_TECHNICAL:{engineLabel(item){return {text:item.engine||'',fuelIncluded:false};}},AUSTA_MARKETPLACE_CARD_DATA:{heart:()=>''},AUSTA_VEHICLE_VIN:{valid:()=>false}};
 vm.runInNewContext(source,{window,document:{readyState:'loading',addEventListener(){}}});
 return window.AUSTA_LISTING_CARDS;
}
const examples=[
 ['cars','cars',{listing_type:'sale',brand:'Mercedes-Benz',model:'E-Class',year:2023,engine:'2.0 L',mileage:45000,price:35000,region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['2023','2.0 L','45 000 km']],
 ['rent','rent',{listing_type:'rent',brand:'Toyota',model:'Camry',year:2022,engine:'2.5 L',mileage:50000,daily_price:80,rental_type:'Günlük',deposit:300,region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['2022','Günlük','300 AZN depozit','50 000 km']],
 ['parts','parts',{title:'Ön fara',price:150,condition:'used',details:{part_name:'Ön fara',compatibility:'Toyota Camry 2020–2023',oem:'81150-06A30',stock:'Anbarda'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['Toyota Camry 2020–2023','OEM 81150-06A30','İşlənmiş','Anbarda']],
 ['accessories','accessories',{title:'Döşəmə örtüyü',price:70,brand:'Toyota',model:'Camry',condition:'new',details:{stock:'Anbarda'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['Toyota Camry','Yeni','Anbarda']],
 ['moto','moto',{title:'Yamaha NMAX',year:2024,price:7000,condition:'used',details:{moto_type:'Skuter',mileage:8000},region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['Skuter','2024','8000','İşlənmiş']],
 ['special','special',{title:'Mini ekskavator',year:2021,price:25000,details:{special_type:'Ekskavator',work_hours:1200,sale_rent:'Satış'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['Ekskavator','2021','1200','Satış']],
 ['bus','bus',{title:'Yol avtobusu',year:2020,price:90000,details:{capacity:45,sale_rent:'Satış'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['2020','45','Satış']],
 ['water','water',{title:'Motorlu qayıq',year:2022,price:18000,condition:'used',details:{water_type:'Qayıq',engine:'90 hp'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['Qayıq','2022','90 hp','İşlənmiş']],
 ['caravan','caravan',{title:'Səyahət karavanı',year:2023,price:22000,details:{caravan_type:'Karavan',beds:4,sale_rent:'Satış'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['Karavan','2023','4','Satış']],
 ['trailer','trailer',{title:'Yük qoşqusu',year:2021,price:6000,condition:'used',details:{trailer_type:'Qoşqu',load_capacity:1500},region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['Qoşqu','2021','1500','İşlənmiş']],
 ['plate','plate',{title:'10-AA-100',price:12000,details:{plate_number:'10-AA-100',plate_series:'10 AA',document_status:'Sənədlər qaydasında'},region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['10 AA','Sənədlər qaydasında']],
 ['service','service',{name:'Servis Mərkəzi',specialty:'Mühərrik təmiri',experience:'12 il',working_hours:'09:00–18:00',price:50,region:'Bakı',created_at:'2026-11-19T02:42:00Z',details:{price_policy:'Diaqnostika 50 AZN'}},['Mühərrik təmiri','12 il','09:00–18:00']],
 ['usta','usta',{name:'Usta Rauf',specialty:'Avtoelektrik',experience:'8 il',working_hours:'09:00–18:00',region:'Gəncə',created_at:'2026-11-19T02:42:00Z'},['Avtoelektrik','8 il','09:00–18:00']],
 ['dealer','dealer',{dealer_name:'A-USTA Avtosalon',details:{brands:'Toyota / Lexus',working_hours:'10:00–19:00',vehicle_condition:'Yeni və işlənmiş',credit_available:true},region:'Bakı',created_at:'2026-11-19T02:42:00Z'},['Toyota / Lexus','10:00–19:00','Yeni və işlənmiş','Kredit']]
];
for(const [name,type,item,expected] of examples){
 test(`${name}: canonical card content renders its real category fields`,()=>{
  const card=api().content(type,item);
  assert.equal(card.title,name==='cars'?'Mercedes-Benz E-Class':card.title);
  for(const value of expected)assert(card.summary.includes(value),`${name} missing ${value}: ${card.summary.join(' | ')}`);
  assert(card.price||['usta','dealer'].includes(name),'real price or price-policy data is present');
  assert.doesNotMatch(JSON.stringify(card),/undefined|null|\[object Object\]/i);
 });
 test(`${name}: card markup follows price, title, summary, location and time`,()=>{
  const markup=api().render(name,item),price=markup.indexOf('austa-card-price'),title=markup.indexOf('austa-card-title'),summary=markup.indexOf('austa-card-summary'),location=markup.indexOf('austa-card-location-time');
  if(item.price||item.daily_price||item.details?.price_policy)assert(price>=0&&price<title,`${name} price must precede title`);
  assert(title>=0&&title<summary&&summary<location,`${name} order: ${price}, ${title}, ${summary}, ${location}`);
  assert(markup.includes('austa-card-location-separator'),'city and post time share one left-aligned row');
 });
}
test('mechanic legacy type uses the canonical usta card contract',()=>{
 const rendered=api().render('mechanic',{name:'Mexanik',specialty:'Asqı sistemi',experience:'10 il',region:'Şəki'});
 assert(rendered.includes('Asqı sistemi'));assert(rendered.includes('10 il'));assert(rendered.includes('Şəki'));
});
test('card typography stays left-aligned, summary stays one line, mobile columns remain safe',()=>{
 assert.match(css,/\.austa-card-title\{[^}]*text-align:left/);
 assert.match(css,/\.austa-card-summary\{[^}]*white-space:nowrap/);
 assert.match(css,/\.austa-card-location-time\{[^}]*text-align:left/);
 assert.match(css,/@media\(max-width:480px\)/);
 assert.doesNotMatch(css,/card-content-business \.austa-card-price/);
});
test('missing optional data never fabricates a price, feature or posted timestamp',()=>{
 const card=api().content('parts',{title:'Filtr',details:{}});
 assert.equal(card.price,'');assert.deepEqual(Array.from(card.summary),[]);
 assert.equal(api().locationRow({region:'Bakı'}).includes('austa-card-posted'),false);
 assert.equal(api().locationRow({created_at:'2026-11-19T02:42:00Z'}).includes('austa-card-city'),false);
});
