'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20261119120000_v36_vehicle_listing_details.sql'),'utf8');
const page=fs.readFileSync(path.join(root,'index.html'),'utf8');
const form=fs.readFileSync(path.join(root,'assets/marketplace/listing-detail-v36.js'),'utf8');

test('vehicle details migration adds only owner-row JSON and keeps RLS policies untouched',()=>{
 assert.match(migration,/ALTER TABLE public\.vehicle_listings\s+ADD COLUMN IF NOT EXISTS details jsonb NOT NULL DEFAULT '\{\}'::jsonb/i);
 assert.match(migration,/CHECK \(jsonb_typeof\(details\) = 'object'\)/i);
 assert.doesNotMatch(migration,/ENABLE ROW LEVEL SECURITY|CREATE POLICY|DISABLE ROW LEVEL SECURITY/i);
});

test('all 14 active categories have separate equipment catalogs and UI consumes the category key',()=>{
 const api=form.match(/window\.AUSTA_LISTING_EQUIPMENT_V36 = Object\.freeze\(\{[\s\S]*?\}\);/);
 assert.ok(api,'equipment API missing');
 for(const type of ['cars','rent','parts','accessories','moto','special','bus','water','caravan','trailer','plate','service','usta','dealer']){
  assert.match(form,new RegExp('^\\s*'+type+': \\[','m'));
 }
 assert.match(page,/AUSTA_LISTING_EQUIPMENT_V36\?\.mount\(container,type\)/);
 assert.match(page,/AUSTA_LISTING_EQUIPMENT_V36\?\.restore\(document\.getElementById\('austaV153CFields'\),details\.equipment\)/);
 assert.match(page,/function validateEquipment\(type,value\)/);
 assert.match(page,/function vehicleOnlyDetails\(type,input\)/);
 assert.match(page,/preserveDetails\(type, listingId, user, input\)/);
});

test('public detail omits legacy location and internal information sections',()=>{
 const renderer=page.slice(page.indexOf('async function renderResolvedListing('),page.indexOf('window.AUSTA_LISTING_DETAIL.install'));
 assert.doesNotMatch(renderer,/YERLƏŞMƏ|\$\{detailInformation\(item\)\}/);
 assert.match(renderer,/\$\{equipmentSection\(item\)\}/);
 assert.match(form,/gallery\.insertAdjacentElement\('afterend',box\)/);
});
