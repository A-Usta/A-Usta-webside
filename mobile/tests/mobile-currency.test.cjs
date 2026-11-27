const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');

const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'src/lib/currency.ts'),'utf8');
const currencyModule={exports:{}};
const js=ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
vm.runInNewContext(`(function(exports,module){${js}\n})(module.exports,module)`,{module:currencyModule,Intl,Date,Number,String,RegExp});
const {parseCbarRates,formatListingPrice,convertPriceThreshold,cbarDailyUrl,setCurrencySnapshot,getCurrencySnapshot}=currencyModule.exports;

test('CBAR XML rates require USD and EUR nominal-value pairs and retain the publication date',()=>{
  const rates=parseCbarRates('<ValCurs Date="26.11.2026"><Valute Code="USD"><Nominal>1</Nominal><Value>1.7000</Value></Valute><Valute Code="EUR"><Nominal>1</Nominal><Value>1.9700</Value></Valute></ValCurs>');
  assert.deepEqual(JSON.parse(JSON.stringify(rates)),{date:'26.11.2026',aznPerUnit:{AZN:1,USD:1.7,EUR:1.97}});
  assert.equal(parseCbarRates('<ValCurs Date="26.11.2026"><Valute Code="USD"><Nominal>1</Nominal><Value>1.7</Value></Valute></ValCurs>'),null);
});

test('listing display converts without mutating source amount and falls back to original currency without rates',()=>{
  const rates={date:'26.11.2026',aznPerUnit:{AZN:1,USD:1.7,EUR:1.97}};
  setCurrencySnapshot('EUR',rates);
  assert.equal(formatListingPrice(1700,'AZN',rates,'EUR'),'862,94 €');
  assert.equal(formatListingPrice(100,'USD',null,'EUR'),'100 $');
  assert.ok(Math.abs(convertPriceThreshold(100,'EUR','USD',rates)-115.88235294117646)<1e-10);
});

test('AZN to USD to EUR and back to AZN updates every rendered price snapshot without mutating source values',()=>{
  const rates={date:'26.11.2026',aznPerUnit:{AZN:1,USD:1.7,EUR:1.97}};
  const listing={amount:1970,currency:'AZN'};
  const displayed=[];
  for(const currency of ['AZN','USD','EUR','AZN']){
    setCurrencySnapshot(currency,rates);
    displayed.push(formatListingPrice(listing.amount,listing.currency,getCurrencySnapshot().rates,getCurrencySnapshot().currency));
    assert.equal(getCurrencySnapshot().currency,currency);
  }
  assert.equal(displayed[0],'1.970 ₼');
  assert.equal(displayed[1],'1.158,82 $');
  assert.equal(displayed[2],'1.000 €');
  assert.equal(displayed[3],displayed[0]);
  assert.deepEqual(JSON.parse(JSON.stringify(listing)),{amount:1970,currency:'AZN'});
});

test('CBAR feed URL is pinned to the official HTTPS currency XML endpoint',()=>{
  assert.equal(cbarDailyUrl(new Date('2026-11-26T12:00:00Z')),'https://cbar.az/currencies/26.11.2026.xml');
});
