const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require(path.resolve(__dirname, '../node_modules/typescript'));

const errorPath = path.resolve(__dirname, '../src/lib/listing-publish-error.ts');
const compiled = ts.transpile(fs.readFileSync(errorPath, 'utf8'), { module: ts.ModuleKind.CommonJS });
const errorModule = new Module(errorPath, module);
errorModule.filename = errorPath;
errorModule.paths = Module._nodeModulePaths(path.dirname(errorPath));
errorModule._compile(compiled, errorPath);
const { listingPublishError, listingPublishField } = errorModule.exports;
const screen = fs.readFileSync(path.resolve(__dirname, '../src/components/MarketplaceScreens.tsx'), 'utf8');

test('maps PostgREST plain-object constraint errors to safe Azerbaijani guidance', () => {
  assert.equal(
    listingPublishError({ code: '23514', message: 'new row violates check constraint "vehicle_listings_price_by_type"' }, 'draft'),
    'Satış elanı üçün qiyməti, icarə elanı üçün günlük qiyməti düzgün daxil edin.',
  );
  assert.match(listingPublishError({ code: '42501', message: 'new row violates row-level security policy' }, 'media-upload'), /icazəsi təsdiqlənmədi/);
});

test('reports the actual failed publication stage in Azerbaijani', () => {
  assert.match(listingPublishError({ message: 'network request failed' }, 'media-upload'), /serverə yüklənmədi.*İnternet bağlantısını yoxlayın/i);
  assert.match(listingPublishError({ message: 'HTTP 400' }, 'draft'), /Elan qaralaması yaradılmadı/);
  assert.match(listingPublishError({ message: 'server error' }, 'activation'), /aktivləşdirilmədi.*Qaralamanız saxlanılıb/);
});

test('network timeouts tell the user to retry the same draft', () => {
  assert.match(listingPublishError({ code: 'LISTING_TIMEOUT' }, 'draft'), /Eyni qaralama üzərindən yenidən cəhd edin/);
});

test('publication maps vehicle detail fields and cleans a failed new staged listing', () => {
  assert.match(screen, /body_type:values\.body_type\|\|null/);
  assert.match(screen, /vin:values\.vin\?\.trim\(\)\.toUpperCase\(\)\|\|null/);
  assert.match(screen, /replace\(',',\s*'\.'\)/);
  assert.match(screen, /phase='draft'/);
  assert.match(screen, /phase='media-upload'/);
  assert.match(screen, /phase='media-link'/);
  assert.match(screen, /phase='activation'/);
  assert.match(screen, /createdThisAttempt&&currentListingId/);
  assert.match(screen, /\.delete\(\)\.eq\('id',currentListingId\).*\.eq\('status',conf\.staging\)/);
  assert.match(screen, /setError\(listingPublishError\(e,phase\)\)/);
});

test('a timed-out draft insert keeps its UUID and reconciles duplicate-key retries by owner', () => {
  assert.match(screen, /id=newUuid\(\);currentListingId=id;setDraftId\(id\)/);
  assert.match(screen, /async function insertListingDraft[\s\S]*insert\(\{id,\.\.\.payload\}\)[\s\S]*code==='23505'[\s\S]*eq\('id',id\)\.eq\('owner_id',owner\)/);
  assert.match(screen, /abortSignal\(signal\).*timeoutMs:20_000/);
});

test('maps server constraint failures to an editable field', () => {
  assert.equal(listingPublishField({ code: '23514', constraint: 'vehicle_listings_price_by_type' }), 'price');
  assert.equal(listingPublishField({ code: '23514', constraint: 'vehicle_listings_year_check' }), 'year');
  assert.equal(listingPublishField({ code: '23514', constraint: 'vehicle_listings_vin_format_check' }), 'vin');
  assert.equal(listingPublishField({ code: '23514', constraint: 'vehicle_listings_mileage_check' }), 'mileage');
});

test('validation returns to and focuses the affected field; media follows the web no-count-limit behavior', () => {
  assert.match(screen, /jumpToField\(field\)/);
  assert.match(screen, /formScroll\.current\?\.scrollTo/);
  assert.match(screen, /fieldInputs\.current\[field\]\?\.focus/);
  assert.match(screen, /selectionLimit:0/);
  assert.doesNotMatch(screen, /slice\(0,10\)/);
  assert.doesNotMatch(screen, /assets\.length>=10/);
});
