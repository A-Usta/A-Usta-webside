const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/lib/owned-listings.ts'), 'utf8');
const js = ts.transpile(source, { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 });
const categories = [
  { key: 'cars', title: 'Avtomobillər', source: 'vehicle', table: 'vehicle_listings', sourceValue: 'sale' },
  { key: 'dealer', title: 'Avtosalonlar', source: 'auto_dealer', table: 'auto_dealer_listings' },
  { key: 'service', title: 'Avtoservislər', source: 'service_provider', table: 'public_service_provider_listings', sourceValue: 'service' },
  { key: 'rent', title: 'Rent a Car', source: 'vehicle', table: 'vehicle_listings', sourceValue: 'rent' },
  ...['parts','accessories','moto','special','bus','trailer','water','caravan','plate'].map(key => ({ key, title: key, source: 'marketplace', table: 'marketplace_listings', sourceValue: key })),
  { key: 'usta', title: 'Ustalar', source: 'service_provider', table: 'public_service_provider_listings', sourceValue: 'usta' },
  ...['insurance','sober_driver','leasing'].map(key => ({ key, title: key, source: 'service_provider', table: 'public_service_provider_listings', sourceValue: key })),
];
const mod = { exports: {} };
vm.runInNewContext(`(function(exports,module,require){${js}\n})(module.exports,module,require)`, {
  module: mod,
  require: name => name === './marketplace' ? { CATEGORIES: categories } : require(name),
  Map, Set, Promise, String, Number, Object, Array, JSON,
});
const { loadOwnedListings, ownedListingDirectPrice, ownedListingServiceDetails } = mod.exports;

function mockedClient({ failCategory, includeOtherOwner = false, serviceProviderStatuses = null } = {}) {
  const calls = [];
  return {
    calls,
    from(table) {
      const filters = [];
      const query = {
        select(columns) { this.columns = columns; return this; },
        eq(column, value) { filters.push([column, value]); return this; },
        or(value) { filters.push(['or', value]); return this; },
        contains(column, value) { filters.push([column, value]); return this; },
        order() { return this; },
        limit() { return this; },
        then(resolve) {
          calls.push({ table, columns: this.columns, filters: [...filters] });
          const category = filters.find(([column]) => column === 'category')?.[1]
            || (filters.some(([column, value]) => column === 'listing_type' && value === 'rent') ? 'rent' : null)
            || (filters.some(([column, value]) => column === 'listing_type' && value === 'sale') ? 'cars' : null)
            || (filters.find(([column]) => column === 'details')?.[1]?.service_category)
            || (filters.find(([column]) => column === 'provider_type')?.[1] === 'usta' ? 'usta' : null)
            || (filters.some(([column]) => column === 'or') ? 'service' : null)
            || (table === 'auto_dealer_listings' ? 'dealer' : null);
          if (failCategory === category) return resolve({ data: null, error: { code: 'TEST_FAIL' } });
          const base = { id: `id-${category}`, owner_id: 'owner-a', status: 'active', _category: category };
          const row = category === 'rent' ? { ...base, daily_price: 75, currency: 'EUR' }
            : category === 'service' ? { ...base, specialty: 'Əyləc', details: { price_policy: 'Razılaşma ilə' } }
            : { ...base, price: 1200, currency: 'AZN' };
          const data = category === 'service' && serviceProviderStatuses
            ? serviceProviderStatuses.map((status, index) => ({ ...row, id: `service-${index}`, status }))
            : [row, ...(includeOtherOwner ? [{ ...row, id: `foreign-${category}`, owner_id: 'owner-b' }] : [])];
          return resolve({ data, error: null });
        },
      };
      return query;
    },
  };
}

test('owned listing reads cover all 17 categories using owner-scoped fields and no nonexistent provider price', async () => {
  const client = mockedClient();
  const result = await loadOwnedListings(client, 'owner-a');
  assert.equal(categories.length, 17);
  assert.equal(client.calls.length, 17);
  assert.equal(result.errors.length, 0);
  assert.equal(new Set(result.rows.map(row => row._category)).size, 17);
  assert.ok(client.calls.every(call => call.filters.some(([column, value]) => column === 'owner_id' && value === 'owner-a')));
  const providers = client.calls.filter(call => call.table === 'public_service_provider_listings');
  assert.equal(providers.length, 5);
  assert.ok(providers.every(call => !call.columns.split(',').includes('price')));
  assert.ok(providers.every(call => !call.filters.some(([column]) => column === 'category')));
});

test('a category failure is isolated and rows returned for a different owner are discarded', async () => {
  const client = mockedClient({ failCategory: 'service', includeOtherOwner: true });
  const result = await loadOwnedListings(client, 'owner-a');
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].key, 'service');
  assert.ok(result.rows.length > 0);
  assert.ok(result.rows.every(row => row.owner_id === 'owner-a'));
  assert.ok(!result.rows.some(row => row._category === 'service'));
});

test('owner view queries retain every TEST-supported service listing status without a status filter', async () => {
  const statuses = ['active', 'draft', 'inactive', 'archived'];
  const client = mockedClient({ serviceProviderStatuses: statuses });
  const result = await loadOwnedListings(client, 'owner-a');
  const serviceRows = result.rows.filter(row => row._category === 'service');
  const serviceQuery = client.calls.find(call => call.table === 'public_service_provider_listings' && call.filters.some(([column]) => column === 'or'));
  assert.deepEqual(Array.from(serviceRows, row => row.status), statuses);
  assert.ok(serviceQuery.filters.some(([column, value]) => column === 'owner_id' && value === 'owner-a'));
  assert.ok(!serviceQuery.filters.some(([column]) => column === 'status'));
  assert.equal(result.errors.length, 0);
});

test('rent shows its daily price and provider details come from the real details object', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(ownedListingDirectPrice({ _category: 'rent', daily_price: 70, price: 9000, currency: 'EUR' }))), { amount: 70, currency: 'EUR', perDay: true });
  assert.equal(ownedListingDirectPrice({ _category: 'service', price: 999 }), null);
  assert.deepEqual(JSON.parse(JSON.stringify(ownedListingServiceDetails({ _category: 'service', specialty: 'Əyləc', details: { price_policy: 'Razılaşma ilə' } }))), ['Əyləc', 'Razılaşma ilə']);
});
