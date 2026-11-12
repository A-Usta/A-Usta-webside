/* Date-only Asia/Baku calendar comparisons; never estimate mileage or intervals. */
(function(){
'use strict';
const categories=Object.freeze({oil_filters:'Mühərrik yağı və filtrlər',tires_wheels:'Təkərlər və disklər',brakes:'Əyləc sistemi',engine:'Mühərrik',transmission:'Sürətlər qutusu',battery_electrical:'Akkumulyator və elektrik sistemi',suspension:'Asqı sistemi',cooling:'Soyutma sistemi',inspection:'Texniki baxış',other:'Digər təmir və qulluq işləri'});
function calendarDate(now=new Date()){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Baku',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
function validDate(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const d=new Date(value+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value;}
function status(record,mileage,today=calendarDate()){
 if(!validDate(today))throw new Error('Invalid calendar date');
 const date=validDate(record.next_service_date)?record.next_service_date:null;
 const km=Number.isInteger(record.next_service_mileage_km)&&record.next_service_mileage_km>=0?record.next_service_mileage_km:null;
 if(!date&&km===null)return null;
 const current=Number.isInteger(mileage)&&mileage>=0?mileage:null;
 const overdue=Boolean(date&&date<today)||(km!==null&&current!==null&&current>km);
 const due=Boolean(date&&date===today)||(km!==null&&current!==null&&current===km);
 return {state:overdue?'overdue':due?'due':(!date&&current===null)?'unknown':'upcoming',date,mileage:km,mileageUnknown:km!==null&&current===null};
}
window.AUSTA_MAINTENANCE=Object.freeze({categories,calendarDate,validDate,status});
})();
