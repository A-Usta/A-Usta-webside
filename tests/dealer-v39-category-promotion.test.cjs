'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const html=read('index.html');

test('Header navigation puts existing Avtoservislər between Avtosalon and Rent a Car exactly once',()=>{
 const source=html.slice(html.indexOf('const categories = ['),html.indexOf('function openCategory(key)'));
 const keys=[...source.matchAll(/key:"([^"]+)"/g)].map(match=>match[1]);
 assert.equal(keys.filter(key=>key==='service').length,1);
 const nav=read('assets/homepage/header-search-polish.js');
 assert.match(nav,/categoryOrder=\['cars','dealer','service','rent'\]/);
 assert.match(read('assets/homepage/header-ads.js'),/\['cars','dealer','service','rent'/);
 const final=html.slice(html.indexOf('const finalCategories = ['),html.indexOf('function findExistingImage('));
 const finalKeys=[...final.matchAll(/key:"([^"]+)"/g)].map(match=>match[1]);
 assert.equal(finalKeys.filter(key=>key==='service').length,1);
});

test('category dropdown keeps Bus in “Digər kateqoriyalar” while preserving the existing route',()=>{
 const nav=read('assets/homepage/header-search-polish.js');
 assert.match(nav,/prioritized=entries\.filter\(b=>!\['water','bus'\]\.includes\(b\.dataset\.v351Category\)\)/);
 assert.match(nav,/waterAndBus\.forEach\(b=>menu\.append\(b\)\)/);
});

test('listing picker inserts Dealer immediately before Rent and de-duplicates it',()=>{
 const helper=html.slice(html.indexOf('function ensureDealerOption(){'),html.indexOf('function yesNo(value){'));
 assert.match(helper,/dealerOptions[\s\S]*?\.slice\(1\)/);
 assert.match(helper,/insertBefore\(existing,rent\)/);
 assert.match(helper,/insertBefore\(option,rent\)/);
});

test('Dealer edit hydrates the stored order type and retains the additive JSON field allowlist',()=>{
 const start=html.indexOf('async function editDealer(item){');
 const edit=html.slice(start,html.indexOf('window.AUSTA_EDIT_DEALER_V156',start));
 assert.match(edit,/order_type:[\s\S]{0,180}item\.details\?\.order_type/);
 assert.match(html,/dealer: \['order_type','contact_name'/);
});

test('Home Premium reads active, unexpired Dealer Premium rows and uses Dealer media/cards',()=>{
 const loader=html.slice(html.indexOf('async function loadNextHomeBatch(){'),html.indexOf('function checkHomeScroll(){'));
 assert.match(loader,/from\("auto_dealer_listings"\)/);
 assert.match(loader,/\.eq\("status", "active"\)[\s\S]*?\.ilike\("promotion_type", "premium"\)[\s\S]*?\.lte\("promotion_started_at", requestTime\)[\s\S]*?\.gt\("promotion_until", requestTime\)/);
 assert.match(loader,/attachImages\(supabase, eligible\.filter\(item => item\._austaHomeType === "dealer"\), "dealer"\)/);
 assert.match(loader,/range\(homeDealerOffset, homeDealerOffset \+ HOME_BATCH_SIZE\)/);
 assert.match(loader,/homeDealerOffset \+= consumedDealers\.length/);
 assert.match(loader,/range\(homeDealerOffset, homeDealerOffset \+ HOME_BATCH_SIZE\)/);
 assert.match(loader,/homeDealerOffset \+= consumedDealers\.length/);
 assert.match(html,/item\._austaHomeType === "dealer" \? "dealer" : "cars"/);
 assert.match(html,/item\._austaHomeType !== "dealer" && item\.listing_type !== "sale"/);
});
