// P2.A immutable reviewed evidence: 745d6ee87813a83003731ee2026e9814bd510e57,
// pre-P1.6 b79d65485cad6ad27b5bbfb62536e0d728907936 and
// historical P0.3.1/P1.1G 19c91a76502dad439811fa86d95af0fac922c88a.
// Static literal deltas only. No runtime diff, regex swallowing or region restore.
// Left/right anchors are NEVER replaced. Unknown intervening bytes survive.
const assert=require('node:assert/strict');
const recipes={
 "detail": [
  {
   "left": "ets/marketplace/listing-lifecycle.js\"></script>\n",
   "from": "\n",
   "to": "",
   "right": "<link rel=\"stylesheet\" href=\"assets/marketplace/"
  },
  {
   "left": "---- */\n\nasync function austaMyView(item) {\n  if",
   "from": "",
   "to": " ",
   "right": "(!item?.id)return;\n  return window.AUSTA_LISTING"
  },
  {
   "left": "/\n\nasync function austaMyView(item) {\n  if(!item",
   "from": "?.id",
   "to": "",
   "right": ")return;\n  return window.AUSTA_LISTING_DETAIL?.o"
  },
  {
   "left": "ync function austaMyView(item) {\n  if(!item?.id)",
   "from": "",
   "to": " ",
   "right": "return;\n  return window.AUSTA_LISTING_DETAIL?.op"
  },
  {
   "left": "tion austaMyView(item) {\n  if(!item?.id)return;\n",
   "from": "",
   "to": "\n",
   "right": "  return window.AUSTA_LISTING_DETAIL?.open(item."
  },
  {
   "left": "on austaMyView(item) {\n  if(!item?.id)return;\n  ",
   "from": "",
   "to": "/*\n   * P",
   "right": "return window.AUSTA_LISTING_DETAIL?.open(item.id"
  },
  {
   "left": " austaMyView(item) {\n  if(!item?.id)return;\n  re",
   "from": "",
   "to": "fer ",
   "right": "turn window.AUSTA_LISTING_DETAIL?.open(item.id,i"
  },
  {
   "left": "austaMyView(item) {\n  if(!item?.id)return;\n  ret",
   "from": "",
   "to": "he existing ",
   "right": "urn window.AUSTA_LISTING_DETAIL?.open(item.id,it"
  },
  {
   "left": "ustaMyView(item) {\n  if(!item?.id)return;\n  retu",
   "from": "",
   "to": "nified listing APIs.\n   * We do not c",
   "right": "rn window.AUSTA_LISTING_DETAIL?.open(item.id,ite"
  },
  {
   "left": "staMyView(item) {\n  if(!item?.id)return;\n  retur",
   "from": "",
   "to": "eate a seco",
   "right": "n window.AUSTA_LISTING_DETAIL?.open(item.id,item"
  },
  {
   "left": "taMyView(item) {\n  if(!item?.id)return;\n  return",
   "from": "",
   "to": "d listing detail system.\n   */\n\n  if (\n   ",
   "right": " window.AUSTA_LISTING_DETAIL?.open(item.id,item."
  },
  {
   "left": "!item?.id)return;\n  return window.AUSTA_LISTING_",
   "from": "DETAIL",
   "to": "V153",
   "right": "?.open(item.id,item.__austa_source);\n}\n\n/* -----"
  },
  {
   "left": "turn;\n  return window.AUSTA_LISTING_DETAIL?.open",
   "from": "",
   "to": "\n  ) {\n    try {\n      await window.AUSTA_LISTING_V153.open",
   "right": "(item.id,item.__austa_source);\n}\n\n/* -----------"
  },
  {
   "left": "urn;\n  return window.AUSTA_LISTING_DETAIL?.open(",
   "from": "",
   "to": "\n        ",
   "right": "item.id,item.__austa_source);\n}\n\n/* ------------"
  },
  {
   "left": "eturn window.AUSTA_LISTING_DETAIL?.open(item.id,",
   "from": "",
   "to": "\n        ",
   "right": "item.__austa_source);\n}\n\n/* --------------------"
  },
  {
   "left": "LISTING_DETAIL?.open(item.id,item.__austa_source",
   "from": "",
   "to": "\n      );\n\n      return;\n    } catch (e) {\n      console.warn(\n        '[A-USTA V156-B] V153 open:',\n        e\n      );\n    }\n  }\n\n const publicCard = document.querySelector(\n  '[data-v146-listing-id=\"' +\n  CSS.escape(String(item.id)) +\n  '\"]'\n);\n\nif (publicCard) {\n  publicCard.click();\n  return;\n}\n\n  /*\n   * Existing cards/details can also react\n   * to this event without coupling this\n   * account module to their implementation.\n   */\n\n  window.dispatchEvent(\n    new CustomEvent(\n      'austa:v156:view-listing',\n      {\n        detail: {\n          id: item.id,\n          table: item.__austa_table,\n          source: item.__austa_source\n        }\n      }\n    )\n  ",
   "right": ");\n}\n\n/* ---------------------------------------"
  },
  {
   "left": "NG_DETAIL?.open(item.id,item.__austa_source);\n}\n",
   "from": "",
   "to": "\n",
   "right": "\n/* --------------------------------------------"
  },
  {
   "left": "overflow=\"\";\n}\n\nfunction openListingDetail(id){\n",
   "from": "  return window.AUSTA_LISTING_DETAIL?.open(id,'vehicle') || false;\n",
   "to": "",
   "right": "\n  const item=findListing(id);\n\n  if(!item){\n   "
  },
  {
   "left": "OMOTION=function(\n  listingId,\n  packageType\n){\n",
   "from": "  return window.AUSTA_LISTING_DETAIL?.promote(listingId,'vehicle',packageType);\n\n",
   "to": "",
   "right": "\n  const allowed=[\n    'boost',\n    'vip',\n    '"
  },
  {
   "left": "=============== */\n\nfunction openHashListing(){\n",
   "from": "  return window.AUSTA_LISTING_DETAIL?.openLink();\n",
   "to": "",
   "right": "\n  const match=\n    String(window.location.hash "
  },
  {
   "left": "ont-size:14px;\n  line-height:1.65;\n}\n\n</style>\n\n",
   "from": "\n",
   "to": "",
   "right": "<script id=\"austa-final-full-listing-js\">\n(funct"
  },
  {
   "left": "return '';\n  }\n\n  return String(value).trim()+' ",
   "from": "'+(['cars','rent'].includes(categoryOf(item))?'",
   "to": "",
   "right": "AZN':vehicleText(item.currency)||'AZN');\n}\n\n\nfun"
  },
  {
   "left": "['cars','rent'].includes(categoryOf(item))?'AZN'",
   "from": ":vehicleText(item.currency)||'AZN')",
   "to": "",
   "right": ";\n}\n\n\nfunction phoneOf(item){\n\n  return String(\n"
  },
  {
   "left": "act_name ?? '').trim() || 'Elan sahibi';\n  }\n\n  ",
   "from": "const category=categoryOf(item);\n  if(category==='dealer')",
   "to": "",
   "right": "return vehicleText(item.contact_name) || 'Elan s"
  },
  {
   "left": "tegoryOf(item);\n  if(category==='dealer')return ",
   "from": "veh",
   "to": "Str",
   "right": "icleText(item.contact_name) || 'Elan sahibi';\n  "
  },
  {
   "left": "ryOf(item);\n  if(category==='dealer')return vehi",
   "from": "cleText",
   "to": "ng",
   "right": "(item.contact_name) || 'Elan sahibi';\n  if(categ"
  },
  {
   "left": "m);\n  if(category==='dealer')return vehicleText(",
   "from": "",
   "to": "\n    ",
   "right": "item.contact_name) || 'Elan sahibi';\n  if(catego"
  },
  {
   "left": "  if(category==='dealer')return vehicleText(item",
   "from": "",
   "to": "?",
   "right": ".contact_name) || 'Elan sahibi';\n  if(category=="
  },
  {
   "left": " if(category==='dealer')return vehicleText(item.",
   "from": "c",
   "to": "['Ad / s",
   "right": "ontact_name) || 'Elan sahibi';\n  if(category==='"
  },
  {
   "left": "f(category==='dealer')return vehicleText(item.co",
   "from": "n",
   "to": "yad'] ||\n    i",
   "right": "tact_name) || 'Elan sahibi';\n  if(category==='se"
  },
  {
   "left": "category==='dealer')return vehicleText(item.cont",
   "from": "act_",
   "to": "em?.",
   "right": "name) || 'Elan sahibi';\n  if(category==='service"
  },
  {
   "left": "==='dealer')return vehicleText(item.contact_name",
   "from": ")",
   "to": "",
   "right": " || 'Elan sahibi';\n  if(category==='service')ret"
  },
  {
   "left": "dealer')return vehicleText(item.contact_name) ||",
   "from": "",
   "to": "\n   ",
   "right": " 'Elan sahibi';\n  if(category==='service')return"
  },
  {
   "left": " vehicleText(item.contact_name) || 'Elan sahibi'",
   "from": ";",
   "to": "",
   "right": "\n  if(category==='service')return vehicleText(it"
  },
  {
   "left": "icleText(item.contact_name) || 'Elan sahibi';\n  ",
   "from": "if(ca",
   "to": ").",
   "right": "tegory==='service')return vehicleText(item.detai"
  },
  {
   "left": "xt(item.contact_name) || 'Elan sahibi';\n  if(cat",
   "from": "egory==='service')return vehicleText(item.details?.owner_name) || 'Əlaqələndi",
   "to": "",
   "right": "rici';\n  return vehicleText(item.name) || 'Elan "
  },
  {
   "left": "eText(item.details?.owner_name) || 'Əlaqələndiri",
   "from": "ci'",
   "to": "m()",
   "right": ";\n  return vehicleText(item.name) || 'Elan sahib"
  },
  {
   "left": "(item.details?.owner_name) || 'Əlaqələndirici';\n",
   "from": "  return vehicleText(item.name) || 'Elan sahibi';\n",
   "to": "",
   "right": "}\n\n\nfunction locationOf(item){\n\n  return String("
  },
  {
   "left": "| !item._austaSupabase || !item.id)return item;\n",
   "from": "  item={...item,image_paths:[],cover_image_path:'',video_path:''};\n",
   "to": "",
   "right": "  const sb=window.AUSTA_SUPABASE;\n  item._austaM"
  },
  {
   "left": "=='rent' ? vehicleText(item.rental_type) : ''],\n",
   "from": "    ['Depozit',item.listing_type==='rent' && item.deposit!=null && vehicleText(item.deposit)!=='' ? vehicleText(item.deposit)+' AZN' : ''],\n",
   "to": "",
   "right": "    ['Buraxılış ili',value('year','Buraxılış ili"
  },
  {
   "left": "alue('color','Rəng'),'color')],\n    ['Mühərrik',",
   "from": "vehicleText(",
   "to": "",
   "right": "engine.text) || value('engine','Mühərrik həcmi')"
  },
  {
   "left": "olor')],\n    ['Mühərrik',vehicleText(engine.text",
   "from": ")",
   "to": "",
   "right": " || value('engine','Mühərrik həcmi')],\n    ['Yan"
  },
  {
   "left": "['district','Rayon']].map(([key,label])=>[label,",
   "from": "key==='condition'?(item[key]==='new'?'Yeni':item[key]==='used'?'İşlənmiş':text(item[key])):",
   "to": "",
   "right": "text(item[key])]),\n    ...fields[category].map(("
  },
  {
   "left": "arketplaceSpecs});\nfunction genericSpecs(item){\n",
   "from": "  // P1.6 explicit provider/dealer presentation: never enumerate a DB row.",
   "to": "",
   "right": "\n  const type=categoryOf(item);\n  const fields=t"
  },
  {
   "left": "presentation: never enumerate a DB row.\n  const ",
   "from": "",
   "to": "ignored=new Se",
   "right": "type=categoryOf(item);\n  const fields=type==='de"
  },
  {
   "left": "resentation: never enumerate a DB row.\n  const t",
   "from": "y",
   "to": "([\n    'id',\n    'owner_id',\n    'seller_",
   "right": "pe=categoryOf(item);\n  const fields=type==='deal"
  },
  {
   "left": "sentation: never enumerate a DB row.\n  const typ",
   "from": "",
   "to": "rofil",
   "right": "e=categoryOf(item);\n  const fields=type==='deale"
  },
  {
   "left": "entation: never enumerate a DB row.\n  const type",
   "from": "=",
   "to": "_id',\n    '__austa_table',\n    '__austa_source',\n    '_austaSupabase',\n    '",
   "right": "categoryOf(item);\n  const fields=type==='dealer'"
  },
  {
   "left": " never enumerate a DB row.\n  const type=category",
   "from": "",
   "to": "',\n    'createdAt',\n    'created_at',\n    'cover_image_path',\n    'image_paths',\n    'video_path',\n    'vip',\n    'premium',\n    'promoted',\n    'promotedAt',\n    'promotedUntil'\n  ]);\n\n  return ",
   "right": "Of(item);\n  const fields=type==='dealer'?[['bran"
  },
  {
   "left": "never enumerate a DB row.\n  const type=categoryO",
   "from": "f",
   "to": "bject.entries",
   "right": "(item);\n  const fields=type==='dealer'?[['brands"
  },
  {
   "left": "enumerate a DB row.\n  const type=categoryOf(item",
   "from": "",
   "to": " || {}",
   "right": ");\n  const fields=type==='dealer'?[['brands','Ma"
  },
  {
   "left": "numerate a DB row.\n  const type=categoryOf(item)",
   "from": "",
   "to": "\n    .filter(([key,value])=>{\n\n      if(ignored.has(key)){\n        return false",
   "right": ";\n  const fields=type==='dealer'?[['brands','Mar"
  },
  {
   "left": "merate a DB row.\n  const type=categoryOf(item);\n",
   "from": "",
   "to": "      }\n\n      if(\n        value===null ||\n        value===undefined ||\n        value==='' ||\n        typeof value==='object'\n      ){\n        return false;\n      }\n\n    ",
   "right": "  const fields=type==='dealer'?[['brands','Marka"
  },
  {
   "left": " DB row.\n  const type=categoryOf(item);\n  const ",
   "from": "fields",
   "to": "k",
   "right": "=type==='dealer'?[['brands','Markalar'],['workin"
  },
  {
   "left": ".\n  const type=categoryOf(item);\n  const fields=",
   "from": "type==='de",
   "to": "norm",
   "right": "aler'?[['brands','Markalar'],['working_hours','İ"
  },
  {
   "left": "pe=categoryOf(item);\n  const fields=type==='deal",
   "from": "",
   "to": "iz",
   "right": "er'?[['brands','Markalar'],['working_hours','İş "
  },
  {
   "left": "e=categoryOf(item);\n  const fields=type==='deale",
   "from": "r'?[['brands','Mar",
   "to": "(",
   "right": "kalar'],['working_hours','İş saatları'],['vehicl"
  },
  {
   "left": "\n  const fields=type==='dealer'?[['brands','Mark",
   "from": "alar'],['working_hours','İş saatları'],['v",
   "to": "",
   "right": "ehicle_condition','Avtomobillərin vəziyyəti']]\n "
  },
  {
   "left": "'Markalar'],['working_hours','İş saatları'],['ve",
   "from": "hicle_condition','Avtomobillərin vəzi",
   "to": "",
   "right": "yyəti']]\n    :['service','usta'].includes(type)?"
  },
  {
   "left": "arı'],['vehicle_condition','Avtomobillərin vəziy",
   "from": "yəti']]",
   "to": ");\n",
   "right": "\n    :['service','usta'].includes(type)?[['speci"
  },
  {
   "left": "cle_condition','Avtomobillərin vəziyyəti']]\n    ",
   "from": ":['serv",
   "to": "  ",
   "right": "ice','usta'].includes(type)?[['specialty','İxtis"
  },
  {
   "left": "ition','Avtomobillərin vəziyyəti']]\n    :['servi",
   "from": "ce','usta']",
   "to": "f(\n        k",
   "right": ".includes(type)?[['specialty','İxtisas'],['servi"
  },
  {
   "left": "n vəziyyəti']]\n    :['service','usta'].includes(",
   "from": "type)?[['specialty','İxtisas'],[",
   "to": "",
   "right": "'services','Xidmətlər'],['experience','İş təcrüb"
  },
  {
   "left": "a'].includes(type)?[['specialty','İxtisas'],['se",
   "from": "rvices','Xidmətlər'],['experience','İş təcrübəsi'],['wor",
   "to": "",
   "right": "king_hours','İş saatları']]:[];\n  const rows=fie"
  },
  {
   "left": "idmətlər'],['experience','İş təcrübəsi'],['worki",
   "from": "ng_hours",
   "to": "l",
   "right": "','İş saatları']]:[];\n  const rows=fields.map((["
  },
  {
   "left": "],['experience','İş təcrübəsi'],['working_hours'",
   "from": ",'İş",
   "to": ")",
   "right": " saatları']]:[];\n  const rows=fields.map(([key,l"
  },
  {
   "left": "xperience','İş təcrübəsi'],['working_hours','İş ",
   "from": "saatları']]:[];",
   "to": "||",
   "right": "\n  const rows=fields.map(([key,label])=>[label,v"
  },
  {
   "left": "rübəsi'],['working_hours','İş saatları']]:[];\n  ",
   "from": "co",
   "to": "      k.i",
   "right": "nst rows=fields.map(([key,label])=>[label,vehicl"
  },
  {
   "left": "əsi'],['working_hours','İş saatları']]:[];\n  con",
   "from": "st rows=fields.map(([key,label])=>[label,vehi",
   "to": "",
   "right": "cleText(item[key])]).filter(([,value])=>value!=="
  },
  {
   "left": "nst rows=fields.map(([key,label])=>[label,vehicl",
   "from": "",
   "to": "ud",
   "right": "eText(item[key])]).filter(([,value])=>value!==''"
  },
  {
   "left": "st rows=fields.map(([key,label])=>[label,vehicle",
   "from": "T",
   "to": "s('vid",
   "right": "ext(item[key])]).filter(([,value])=>value!=='');"
  },
  {
   "left": " rows=fields.map(([key,label])=>[label,vehicleTe",
   "from": "xt(item[key])]).filter(([,value])=>value!=='",
   "to": "o",
   "right": "');\n  if(type==='service')for(const [key,label] "
  },
  {
   "left": "Text(item[key])]).filter(([,value])=>value!=='')",
   "from": ";",
   "to": " ||",
   "right": "\n  if(type==='service')for(const [key,label] of "
  },
  {
   "left": "(item[key])]).filter(([,value])=>value!=='');\n  ",
   "from": "",
   "to": "      k.",
   "right": "if(type==='service')for(const [key,label] of [['"
  },
  {
   "left": "item[key])]).filter(([,value])=>value!=='');\n  i",
   "from": "",
   "to": "ncludes('",
   "right": "f(type==='service')for(const [key,label] of [['b"
  },
  {
   "left": "tem[key])]).filter(([,value])=>value!=='');\n  if",
   "from": "(",
   "to": "o",
   "right": "type==='service')for(const [key,label] of [['bra"
  },
  {
   "left": "m[key])]).filter(([,value])=>value!=='');\n  if(t",
   "from": "ype==='service",
   "to": "o",
   "right": "')for(const [key,label] of [['brands','Xidmət gö"
  },
  {
   "left": "(([,value])=>value!=='');\n  if(type==='service')",
   "from": "for",
   "to": " ||\n        k.includes",
   "right": "(const [key,label] of [['brands','Xidmət göstəri"
  },
  {
   "left": "value])=>value!=='');\n  if(type==='service')for(",
   "from": "",
   "to": "'media') ||\n        k.in",
   "right": "const [key,label] of [['brands','Xidmət göstəril"
  },
  {
   "left": "alue])=>value!=='');\n  if(type==='service')for(c",
   "from": "on",
   "to": "lude",
   "right": "st [key,label] of [['brands','Xidmət göstərilən "
  },
  {
   "left": "e])=>value!=='');\n  if(type==='service')for(cons",
   "from": "t [k",
   "to": "('",
   "right": "ey,label] of [['brands','Xidmət göstərilən marka"
  },
  {
   "left": "value!=='');\n  if(type==='service')for(const [ke",
   "from": "y,",
   "to": "",
   "right": "label] of [['brands','Xidmət göstərilən markalar"
  },
  {
   "left": "e!=='');\n  if(type==='service')for(const [key,la",
   "from": "b",
   "to": "ve m",
   "right": "el] of [['brands','Xidmət göstərilən markalar'],"
  },
  {
   "left": "='');\n  if(type==='service')for(const [key,label",
   "from": "]",
   "to": "umat')",
   "right": " of [['brands','Xidmət göstərilən markalar'],['p"
  },
  {
   "left": "');\n  if(type==='service')for(const [key,label] ",
   "from": "of",
   "to": "||\n",
   "right": " [['brands','Xidmət göstərilən markalar'],['pric"
  },
  {
   "left": "\n  if(type==='service')for(const [key,label] of ",
   "from": "[[",
   "to": "       k.includes(",
   "right": "'brands','Xidmət göstərilən markalar'],['price_p"
  },
  {
   "left": "if(type==='service')for(const [key,label] of [['",
   "from": "br",
   "to": "h",
   "right": "ands','Xidmət göstərilən markalar'],['price_poli"
  },
  {
   "left": "type==='service')for(const [key,label] of [['bra",
   "from": "",
   "to": "qqi",
   "right": "nds','Xidmət göstərilən markalar'],['price_polic"
  },
  {
   "left": "pe==='service')for(const [key,label] of [['brand",
   "from": "s",
   "to": "a",
   "right": "','Xidmət göstərilən markalar'],['price_policy',"
  },
  {
   "left": "==='service')for(const [key,label] of [['brands'",
   "from": ",'Xidmət",
   "to": ")\n",
   "right": " göstərilən markalar'],['price_policy','Qiymət q"
  },
  {
   "left": "ce')for(const [key,label] of [['brands','Xidmət ",
   "from": "göstərilən",
   "to": "",
   "right": " markalar'],['price_policy','Qiymət qaydası']]){"
  },
  {
   "left": "st [key,label] of [['brands','Xidmət göstərilən ",
   "from": "markalar'],['price_policy','Qiymət",
   "to": "",
   "right": " qaydası']]){\n    const value=vehicleText(item.d"
  },
  {
   "left": "t göstərilən markalar'],['price_policy','Qiymət ",
   "from": "qaydası']]",
   "to": "   ",
   "right": "){\n    const value=vehicleText(item.details?.[ke"
  },
  {
   "left": "alar'],['price_policy','Qiymət qaydası']]){\n    ",
   "from": "const value=vehicleText(item.details?.[key]);if(value)rows.push([label,value]);\n",
   "to": "",
   "right": "  }\n  if(type==='dealer')for(const [key,label] o"
  },
  {
   "left": "ls?.[key]);if(value)rows.push([label,value]);\n  ",
   "from": "}\n  if(type==='dealer')for(const [key,label] of [['credit_available','Kredit'],['leasing_available','Lizinq'],['barter_available','Barter'],['delivery_available','Çatdırılma']]){\n    if(typeof item[key]==='boolean')rows.push([label,item[key]?'Mövcuddur':'Mövcud deyil']);\n  }\n",
   "to": "",
   "right": "  return rows;\n}\n\n\nfunction specsFor(item){\n\n  i"
  },
  {
   "left": "key]?'Mövcuddur':'Mövcud deyil']);\n  }\n  return ",
   "from": "row",
   "to": "fal",
   "right": "s;\n}\n\n\nfunction specsFor(item){\n\n  if(['cars','r"
  },
  {
   "left": "?'Mövcuddur':'Mövcud deyil']);\n  }\n  return rows",
   "from": "",
   "to": "e",
   "right": ";\n}\n\n\nfunction specsFor(item){\n\n  if(['cars','re"
  },
  {
   "left": "Mövcuddur':'Mövcud deyil']);\n  }\n  return rows;\n",
   "from": "",
   "to": "      }\n\n      return true;\n    })\n    .slice(0,30);\n",
   "right": "}\n\n\nfunction specsFor(item){\n\n  if(['cars','rent"
  },
  {
   "left": "ListingPage'\n    )\n    ?.remove();\n}\n\n\nfunction ",
   "from": "t",
   "to": "clos",
   "right": "eardownDetail(event){\n\n  if(event){\n\n    event.p"
  },
  {
   "left": "stingPage'\n    )\n    ?.remove();\n}\n\n\nfunction te",
   "from": "",
   "to": "P",
   "right": "ardownDetail(event){\n\n  if(event){\n\n    event.pr"
  },
  {
   "left": "tingPage'\n    )\n    ?.remove();\n}\n\n\nfunction tea",
   "from": "rdownD",
   "to": "g",
   "right": "etail(event){\n\n  if(event){\n\n    event.preventDe"
  },
  {
   "left": "e'\n    )\n    ?.remove();\n}\n\n\nfunction teardownDe",
   "from": "tail",
   "to": "",
   "right": "(event){\n\n  if(event){\n\n    event.preventDefault"
  },
  {
   "left": "name+\n      window.location.search\n    );\n  }\n}\n",
   "from": "\n",
   "to": "",
   "right": "\n\nasync function mediaGallery(item,page){\n\n  con"
  },
  {
   "left": "azy\">';\n  }\n}\n\n\nfunction similarListings(item){\n",
   "from": "  if(item?._austaSupabase)return [];\n",
   "to": "",
   "right": "\n  const all=listings();\n  const category=catego"
  },
  {
   "left": "   </div>\n  `;\n}\n\n\nasync function ownerControls(",
   "from": "",
   "to": "\n  ",
   "right": "item,page,context){\n  const box=page.querySelect"
  },
  {
   "left": "div>\n  `;\n}\n\n\nasync function ownerControls(item,",
   "from": "",
   "to": "\n  ",
   "right": "page,context){\n  const box=page.querySelector('["
  },
  {
   "left": "\n  `;\n}\n\n\nasync function ownerControls(item,page",
   "from": ",context",
   "to": "\n",
   "right": "){\n  const box=page.querySelector('[data-austa-f"
  },
  {
   "left": "async function ownerControls(item,page,context){",
   "from": "",
   "to": "\n",
   "right": "\n  const box=page.querySelector('[data-austa-fin"
  },
  {
   "left": "n ownerControls(item,page,context){\n  const box=",
   "from": "",
   "to": "\n    ",
   "right": "page.querySelector('[data-austa-final-owner]');\n"
  },
  {
   "left": "m,page,context){\n  const box=page.querySelector(",
   "from": "",
   "to": "\n      ",
   "right": "'[data-austa-final-owner]');\n  if(!box)return;\n "
  },
  {
   "left": "ox=page.querySelector('[data-austa-final-owner]'",
   "from": "",
   "to": "\n    ",
   "right": ");\n  if(!box)return;\n  if(!context.owner || !con"
  },
  {
   "left": "=page.querySelector('[data-austa-final-owner]');",
   "from": "",
   "to": "\n",
   "right": "\n  if(!box)return;\n  if(!context.owner || !conte"
  },
  {
   "left": "Selector('[data-austa-final-owner]');\n  if(!box)",
   "from": "",
   "to": "{\n    ",
   "right": "return;\n  if(!context.owner || !context.isCurren"
  },
  {
   "left": "[data-austa-final-owner]');\n  if(!box)return;\n  ",
   "from": "",
   "to": "}\n\n  try{\n\n    const sb=\n      window.AUSTA_SUPABASE;\n\n    ",
   "right": "if(!context.owner || !context.isCurrent()){box.r"
  },
  {
   "left": "a-austa-final-owner]');\n  if(!box)return;\n  if(!",
   "from": "con",
   "to": "sb || !i",
   "right": "text.owner || !context.isCurrent()){box.remove()"
  },
  {
   "left": "ta-final-owner]');\n  if(!box)return;\n  if(!conte",
   "from": "xt",
   "to": "m",
   "right": ".owner || !context.isCurrent()){box.remove();ret"
  },
  {
   "left": "-owner]');\n  if(!box)return;\n  if(!context.owner",
   "from": " || !context.",
   "to": "_",
   "right": "isCurrent()){box.remove();return;}\n  box.hidden="
  },
  {
   "left": "f(!box)return;\n  if(!context.owner || !context.i",
   "from": "sCurrent()",
   "to": "d",
   "right": "){box.remove();return;}\n  box.hidden=false;\n}\n\n\n"
  },
  {
   "left": "n;\n  if(!context.owner || !context.isCurrent()){",
   "from": "",
   "to": "\n      ",
   "right": "box.remove();return;}\n  box.hidden=false;\n}\n\n\n/*"
  },
  {
   "left": "ext.owner || !context.isCurrent()){box.remove();",
   "from": "",
   "to": "\n      ",
   "right": "return;}\n  box.hidden=false;\n}\n\n\n/* V166: reuse "
  },
  {
   "left": "er || !context.isCurrent()){box.remove();return;",
   "from": "",
   "to": "\n    ",
   "right": "}\n  box.hidden=false;\n}\n\n\n/* V166: reuse V156 ma"
  },
  {
   "left": " || !context.isCurrent()){box.remove();return;}\n",
   "from": "",
   "to": "\n    const {\n      data\n    }=await sb.auth.getSession();\n\n    const user=\n      data?.session?.user;\n\n    if(\n      !user ||\n      user.id!==item.owner_id\n    ){\n      box.remove();\n      return;\n    }\n\n  ",
   "right": "  box.hidden=false;\n}\n\n\n/* V166: reuse V156 mana"
  },
  {
   "left": "nt()){box.remove();return;}\n  box.hidden=false;\n",
   "from": "",
   "to": "\n  }catch(error){\n\n    box.remove();\n  }\n",
   "right": "}\n\n\n/* V166: reuse V156 management rows without "
  },
  {
   "left": "be open. */\nfunction ownerManagementItem(item){\n",
   "from": "",
   "to": "  const table=item.__austa_table ||\n    (item._austaSupabase ? 'vehicle_listings' : '');\n  const cached=(window.AUSTA_MY_LISTINGS_V156?.getAll?.() || []).find(listing=>\n    String(listing?.id || '')===String(item.id) &&\n    (!table || listing.__austa_table===table)\n  );\n  if(cached)return cached;\n  const sources={vehicle_listings:'vehicle',marketplace_listings:'marketplace',service_provider_listings:'provider',auto_dealer_listings:'dealer'};\n",
   "right": "  if(!item?._austaSupabase || !['vehicle','marke"
  },
  {
   "left": "/\nfunction ownerManagementItem(item){\n  if(!item",
   "from": "?",
   "to": "",
   "right": "._austaSupabase || !['vehicle','marketplace','se"
  },
  {
   "left": "ementItem(item){\n  if(!item?._austaSupabase || !",
   "from": "['v",
   "to": "Obj",
   "right": "ehicle','marketplace','service_provider','auto_d"
  },
  {
   "left": "tItem(item){\n  if(!item?._austaSupabase || !['ve",
   "from": "hi",
   "to": "",
   "right": "cle','marketplace','service_provider','auto_deal"
  },
  {
   "left": "em(item){\n  if(!item?._austaSupabase || !['vehic",
   "from": "le','marke",
   "to": "",
   "right": "tplace','service_provider','auto_dealer'].includ"
  },
  {
   "left": " if(!item?._austaSupabase || !['vehicle','market",
   "from": "place','service_",
   "to": ".",
   "right": "provider','auto_dealer'].includes(item.__austa_s"
  },
  {
   "left": "pabase || !['vehicle','marketplace','service_pro",
   "from": "vid",
   "to": "totype.hasOwnProp",
   "right": "er','auto_dealer'].includes(item.__austa_source)"
  },
  {
   "left": "e || !['vehicle','marketplace','service_provider",
   "from": "','au",
   "to": "",
   "right": "to_dealer'].includes(item.__austa_source))return"
  },
  {
   "left": "['vehicle','marketplace','service_provider','aut",
   "from": "o_de",
   "to": "y.c",
   "right": "aler'].includes(item.__austa_source))return null"
  },
  {
   "left": "cle','marketplace','service_provider','auto_deal",
   "from": "er'].inc",
   "to": "",
   "right": "ludes(item.__austa_source))return null;\n  return"
  },
  {
   "left": "ketplace','service_provider','auto_dealer'].incl",
   "from": "udes",
   "to": "",
   "right": "(item.__austa_source))return null;\n  return {..."
  },
  {
   "left": "ace','service_provider','auto_dealer'].includes(",
   "from": "item.__austa_",
   "to": "",
   "right": "source))return null;\n  return {...item,__austa_t"
  },
  {
   "left": "ider','auto_dealer'].includes(item.__austa_sourc",
   "from": "",
   "to": "es,tabl",
   "right": "e))return null;\n  return {...item,__austa_title:"
  },
  {
   "left": "des(item.__austa_source))return null;\n  return {",
   "from": "",
   "to": "\n    ",
   "right": "...item,__austa_title:titleOf(item),__austa_pric"
  },
  {
   "left": ".__austa_source))return null;\n  return {...item,",
   "from": "",
   "to": "\n    __austa_table:table,\n    __austa_source:sources[table],\n    __austa_label:table==='vehicle_listings'?'Avtomobil':categoryTitle(categoryOf(item)),\n    ",
   "right": "__austa_title:titleOf(item),__austa_price:priceO"
  },
  {
   "left": ";\n  return {...item,__austa_title:titleOf(item),",
   "from": "",
   "to": "\n    ",
   "right": "__austa_price:priceOf(item)};\n}\n\n\nasync function"
  },
  {
   "left": "_title:titleOf(item),__austa_price:priceOf(item)",
   "from": "",
   "to": "\n  ",
   "right": "};\n}\n\n\nasync function renderResolvedListing(item"
  },
  {
   "left": "_austa_price:priceOf(item)};\n}\n\n\nasync function ",
   "from": "r",
   "to": "op",
   "right": "enderResolvedListing(item,detailContext){\n  if(!"
  },
  {
   "left": "sta_price:priceOf(item)};\n}\n\n\nasync function ren",
   "from": "derReso",
   "to": "Fu",
   "right": "lvedListing(item,detailContext){\n  if(!detailCon"
  },
  {
   "left": "e:priceOf(item)};\n}\n\n\nasync function renderResol",
   "from": "ved",
   "to": "l",
   "right": "Listing(item,detailContext){\n  if(!detailContext"
  },
  {
   "left": "em)};\n}\n\n\nasync function renderResolvedListing(i",
   "from": "",
   "to": "d,source,expectedCategory){\n\n  let i",
   "right": "tem,detailContext){\n  if(!detailContext.isCurren"
  },
  {
   "left": "};\n}\n\n\nasync function renderResolvedListing(item",
   "from": ",detailContext){",
   "to": ";",
   "right": "\n  if(!detailContext.isCurrent())return false;\n "
  },
  {
   "left": "renderResolvedListing(item,detailContext){\n  if(",
   "from": "",
   "to": "source){\n    if(",
   "right": "!detailContext.isCurrent())return false;\n  item="
  },
  {
   "left": "enderResolvedListing(item,detailContext){\n  if(!",
   "from": "",
   "to": "['vehicle_listings','marketplace_listings','service_provi",
   "right": "detailContext.isCurrent())return false;\n  item=m"
  },
  {
   "left": "derResolvedListing(item,detailContext){\n  if(!de",
   "from": "",
   "to": "r_lis",
   "right": "tailContext.isCurrent())return false;\n  item=map"
  },
  {
   "left": "erResolvedListing(item,detailContext){\n  if(!det",
   "from": "",
   "to": "ings','",
   "right": "ailContext.isCurrent())return false;\n  item=mapS"
  },
  {
   "left": "rResolvedListing(item,detailContext){\n  if(!deta",
   "from": "",
   "to": "uto_dealer_l",
   "right": "ilContext.isCurrent())return false;\n  item=mapSu"
  },
  {
   "left": "ResolvedListing(item,detailContext){\n  if(!detai",
   "from": "lCo",
   "to": "sti",
   "right": "ntext.isCurrent())return false;\n  item=mapSupaba"
  },
  {
   "left": "lvedListing(item,detailContext){\n  if(!detailCon",
   "from": "text",
   "to": "gs']",
   "right": ".isCurrent())return false;\n  item=mapSupabaseLis"
  },
  {
   "left": "sting(item,detailContext){\n  if(!detailContext.i",
   "from": "",
   "to": "nclude",
   "right": "sCurrent())return false;\n  item=mapSupabaseListi"
  },
  {
   "left": "ting(item,detailContext){\n  if(!detailContext.is",
   "from": "C",
   "to": "(so",
   "right": "urrent())return false;\n  item=mapSupabaseListing"
  },
  {
   "left": "g(item,detailContext){\n  if(!detailContext.isCur",
   "from": "r",
   "to": "c",
   "right": "ent())return false;\n  item=mapSupabaseListing(it"
  },
  {
   "left": "item,detailContext){\n  if(!detailContext.isCurre",
   "from": "nt(",
   "to": "",
   "right": "))return false;\n  item=mapSupabaseListing(item);"
  },
  {
   "left": "{\n  if(!detailContext.isCurrent())return false;\n",
   "from": "",
   "to": "    try{\n      const sb=window.AUSTA_SUPABASE;\n      if(!sb)return false;\n      const {data,error}=await sb.from(source).select('*').eq('id',id).maybeSingle();\n      if(error || !data || String(data.id)!==String(id))return false;\n    ",
   "right": "  item=mapSupabaseListing(item);\n  removeOldList"
  },
  {
   "left": "rrent())return false;\n  item=mapSupabaseListing(",
   "from": "",
   "to": "{...data,__austa_table:source});\n      if(expectedCategory && categoryOf(",
   "right": "item);\n  removeOldListingOverlays();\n  \n  const "
  },
  {
   "left": "())return false;\n  item=mapSupabaseListing(item)",
   "from": "",
   "to": "!==expectedCategory)return false",
   "right": ";\n  removeOldListingOverlays();\n  \n  const categ"
  },
  {
   "left": ")return false;\n  item=mapSupabaseListing(item);\n",
   "from": "",
   "to": "    }catch(error){console.warn('A-USTA category detail:',error);return false;}\n  }else{\n    item=findListing(id);\n  }\n\n  // P0.3.1: Vehicle staging is private even for direct/cached detail opens.\n  if(item?.status==='draft' && (item.__austa_table==='vehicle_listings' ||\n      item.listing_type==='sale' || item.listing_type==='rent'))return false;\n\n  if(!item){\n    return false;\n  }\n\n\n  /*\n   * Real Supabase elanıdırsa,\n   * onun şəkil və videosunu listing_media-dan gətir.\n   */\n\n  if(item._austaSupabase){\n\n    item=\n      await hydrateSupabaseListingMedia(\n        item\n      );\n  }\n\n\n  const sellerIdentityReady=Promise.resolve(window.AUSTA_SELLER_IDENTITY?.hydrate([item]));\n\n",
   "right": "  removeOldListingOverlays();\n  \n  const categor"
  },
  {
   "left": "cation=isVehicle ? vehicleExtraLocation(item) : ",
   "from": "['parts','access",
   "to": "l",
   "right": "ories','special','moto','plate','bus','water','c"
  },
  {
   "left": "? vehicleExtraLocation(item) : ['parts','accesso",
   "from": "ries','special','moto','plate','bus','water','caravan','trailer'].includes(",
   "to": "",
   "right": "category)?vehicleText(item.address):[item.region"
  },
  {
   "left": ",'bus','water','caravan','trailer'].includes(cat",
   "from": "eg",
   "to": "i",
   "right": "ory)?vehicleText(item.address):[item.region,item"
  },
  {
   "left": "us','water','caravan','trailer'].includes(catego",
   "from": "ry)?vehicleText",
   "to": "nOf",
   "right": "(item.address):[item.region,item.district,item.a"
  },
  {
   "left": "','trailer'].includes(category)?vehicleText(item",
   "from": ".address):[item.region,item.district,item.address].map(vehicleText).filter(Boolean).filter((value,index,all)=>all.indexOf(value)===index).join(', '",
   "to": "",
   "right": ");\n\n  const phone=\n    phoneOf(item);\n\n  const v"
  },
  {
   "left": "item)\n            )}\n          </h1>\n\n          ",
   "from": "<",
   "to": "${i",
   "right": "span class=\"austa-p16-status\">${escapeHtml(windo"
  },
  {
   "left": "em)\n            )}\n          </h1>\n\n          <s",
   "from": "pan ",
   "to": "Vehi",
   "right": "class=\"austa-p16-status\">${escapeHtml(window.AUS"
  },
  {
   "left": "          )}\n          </h1>\n\n          <span cl",
   "from": "ass=\"aus",
   "to": "e ? vehicleMe",
   "right": "ta-p16-status\">${escapeHtml(window.AUSTA_MY_LIFE"
  },
  {
   "left": ")}\n          </h1>\n\n          <span class=\"austa",
   "from": "-p16-s",
   "to": "da",
   "right": "tatus\">${escapeHtml(window.AUSTA_MY_LIFECYCLE?.s"
  },
  {
   "left": "     </h1>\n\n          <span class=\"austa-p16-sta",
   "from": "tus\">${escapeHtml(window.AUSTA_MY_LIFECYCLE?.statusLabel",
   "to": "",
   "right": "(item.status)||'Status əlçatan deyil')}</span>\n\n"
  },
  {
   "left": "Html(window.AUSTA_MY_LIFECYCLE?.statusLabel(item",
   "from": ".status",
   "to": "",
   "right": ")||'Status əlçatan deyil')}</span>\n\n          <s"
  },
  {
   "left": "dow.AUSTA_MY_LIFECYCLE?.statusLabel(item.status)",
   "from": "||",
   "to": " : ",
   "right": "'Status əlçatan deyil')}</span>\n\n          <sect"
  },
  {
   "left": ".AUSTA_MY_LIFECYCLE?.statusLabel(item.status)||'",
   "from": "Status əlçatan deyil",
   "to": "",
   "right": "')}</span>\n\n          <section class=\"austa-fina"
  },
  {
   "left": "statusLabel(item.status)||'Status əlçatan deyil'",
   "from": ")",
   "to": "",
   "right": "}</span>\n\n          <section class=\"austa-final-"
  },
  {
   "left": "atusLabel(item.status)||'Status əlçatan deyil')}",
   "from": "</span>",
   "to": "",
   "right": "\n\n          <section class=\"austa-final-gallery\""
  },
  {
   "left": "     \n\n          ${isVehicle ? vehicleSection('A",
   "from": "VTOMOBİL",
   "to": "vtomobil",
   "right": " HAQQINDA',specs) : `\n          <section class=\""
  },
  {
   "left": "        ${isVehicle ? vehicleSection('AVTOMOBİL ",
   "from": "HAQQINDA",
   "to": "haqqında",
   "right": "',specs) : `\n          <section class=\"austa-fin"
  },
  {
   "left": "      description\n              ? (isVehicle ? `",
   "from": "<section class=\"austa-final-info-section\"><h3 class=\"austa-final-section-title\">TƏSVİR</h3>",
   "to": "",
   "right": "<div class=\"austa-compact-description\">${escapeH"
  },
  {
   "left": "ct-description\">${escapeHtml(description)}</div>",
   "from": "</section>",
   "to": "",
   "right": "` : `\n                <section class=\"austa-fina"
  },
  {
   "left": "             `)\n              : ''\n          }\n\n",
   "from": "          ${detailLocation?`<section class=\"austa-final-info-section\"><h3 class=\"austa-final-section-title\">YERLƏŞMƏ</h3><p>${escapeHtml(detailLocation)}</p></section>`:''}\n          ${detailInformation(item)}\n",
   "to": "",
   "right": "          ${similarHtml(item)}\n\n        </main>\n"
  },
  {
   "left": "      `\n                  : ''\n              }\n\n",
   "from": "              <h2 class=\"austa-final-section-title\">Satıcı və əlaqə</h2>\n              ${businessOf(item)?`<div class=\"austa-p16-business\">${escapeHtml(businessOf(item))}</div>`:''}\n",
   "to": "",
   "right": "              <div data-professional-seller></di"
  },
  {
   "left": "f(item)\n                )}\n              </div>\n",
   "from": "",
   "to": "\n              ${\n                detailLocation\n                  ? `\n                    <div class=\"austa-final-location\">\n                      📍 ${escapeHtml(\n                        detailLocation\n                      )}\n                    </div>\n                  `\n                  : ''\n              }\n\n              ${\n                !isVehicle && createdTime(item)\n                  ? `\n                    <div class=\"austa-final-time\">\n                      🕒 Elan yerləşdirildi:\n                      ${escapeHtml(\n                        createdTime(item)\n                      )}\n                    </div>\n                  `\n                  : ''\n              }\n",
   "right": "\n              ${\n                phone\n        "
  },
  {
   "left": "     : ''\n              }\n\n              <button",
   "from": "",
   "to": "\n               ",
   "right": " type=\"button\" class=\"austa-final-message\" data-"
  },
  {
   "left": "          }\n\n              <button type=\"button\"",
   "from": "",
   "to": "\n               ",
   "right": " class=\"austa-final-message\" data-austa-detail-s"
  },
  {
   "left": "button type=\"button\" class=\"austa-final-message\"",
   "from": "",
   "to": "\n               ",
   "right": " data-austa-detail-share>Paylaş</button>\n\n      "
  },
  {
   "left": "\"button\" class=\"austa-final-message\" data-austa-",
   "from": "d",
   "to": "m",
   "right": "etail-share>Paylaş</button>\n\n            </div>\n"
  },
  {
   "left": "utton\" class=\"austa-final-message\" data-austa-de",
   "from": "t",
   "to": "ss",
   "right": "ail-share>Paylaş</button>\n\n            </div>\n\n\n"
  },
  {
   "left": "ton\" class=\"austa-final-message\" data-austa-deta",
   "from": "il-",
   "to": "ge\n              >\n                💬 Me",
   "right": "share>Paylaş</button>\n\n            </div>\n\n\n    "
  },
  {
   "left": " class=\"austa-final-message\" data-austa-detail-s",
   "from": "h",
   "to": "",
   "right": "are>Paylaş</button>\n\n            </div>\n\n\n      "
  },
  {
   "left": "lass=\"austa-final-message\" data-austa-detail-sha",
   "from": "re>P",
   "to": "j y",
   "right": "aylaş</button>\n\n            </div>\n\n\n           "
  },
  {
   "left": "\"austa-final-message\" data-austa-detail-share>Pa",
   "from": "ylaş",
   "to": "z\n              ",
   "right": "</button>\n\n            </div>\n\n\n            <div"
  },
  {
   "left": "anı idarə et\n              </div>\n\n            \n",
   "from": "\n",
   "to": "",
   "right": "              <div class=\"austa-final-owner-acti"
  },
  {
   "left": "158-promo austa-v158-boost\"\n    data-owner-boost",
   "from": " ${item.status==='active'?'':'hidden'}",
   "to": "",
   "right": "\n  >\n    <span class=\"austa-v158-promo-icon\">\n  "
  },
  {
   "left": "ta-v158-promo austa-v158-vip\"\n    data-owner-vip",
   "from": " ${item.status==='active'?'':'hidden'}",
   "to": "",
   "right": "\n  >\n    <span class=\"austa-v158-promo-icon\">\n  "
  },
  {
   "left": "promo austa-v158-premium\"\n    data-owner-premium",
   "from": " ${item.status==='active'?'':'hidden'}",
   "to": "",
   "right": "\n  >\n    <span class=\"austa-v158-promo-icon\">\n  "
  },
  {
   "left": "      </aside>\n\n      </div>\n    </div>\n  `;\n\n  ",
   "from": "if(!",
   "to": "",
   "right": "detailContext.isCurrent())return false;\n  detail"
  },
  {
   "left": " </aside>\n\n      </div>\n    </div>\n  `;\n\n  if(!d",
   "from": "etailC",
   "to": "",
   "right": "ontext.isCurrent())return false;\n  detailContext"
  },
  {
   "left": "e>\n\n      </div>\n    </div>\n  `;\n\n  if(!detailCo",
   "from": "ntext.isC",
   "to": "c",
   "right": "urrent())return false;\n  detailContext.mount(pag"
  },
  {
   "left": "</div>\n    </div>\n  `;\n\n  if(!detailContext.isCu",
   "from": "rr",
   "to": "m",
   "right": "ent())return false;\n  detailContext.mount(page);"
  },
  {
   "left": ">\n    </div>\n  `;\n\n  if(!detailContext.isCurrent",
   "from": "())r",
   "to": ".body.app",
   "right": "eturn false;\n  detailContext.mount(page);\n  cons"
  },
  {
   "left": " </div>\n  `;\n\n  if(!detailContext.isCurrent())re",
   "from": "tur",
   "to": "",
   "right": "n false;\n  detailContext.mount(page);\n  const se"
  },
  {
   "left": "iv>\n  `;\n\n  if(!detailContext.isCurrent())return",
   "from": " false;\n  ",
   "to": "",
   "right": "detailContext.mount(page);\n  const seller=page.q"
  },
  {
   "left": " if(!detailContext.isCurrent())return false;\n  d",
   "from": "eta",
   "to": "Ch",
   "right": "ilContext.mount(page);\n  const seller=page.query"
  },
  {
   "left": "detailContext.isCurrent())return false;\n  detail",
   "from": "Context.mount",
   "to": "d",
   "right": "(page);\n  const seller=page.querySelector('[data"
  },
  {
   "left": "())return false;\n  detailContext.mount(page);\n  ",
   "from": "c",
   "to": "v",
   "right": "onst seller=page.querySelector('[data-profession"
  },
  {
   "left": ")return false;\n  detailContext.mount(page);\n  co",
   "from": "nst",
   "to": "id",
   "right": " seller=page.querySelector('[data-professional-s"
  },
  {
   "left": "lse;\n  detailContext.mount(page);\n  const seller",
   "from": "",
   "to": "IdentityReady.then(()=>{\n    if(!page.isConnected)return;\n    const target",
   "right": "=page.querySelector('[data-professional-seller]'"
  },
  {
   "left": ".querySelector('[data-professional-seller]');\n  ",
   "from": "",
   "to": "  ",
   "right": "if(seller){\n    seller.innerHTML=window.AUSTA_SE"
  },
  {
   "left": "erySelector('[data-professional-seller]');\n  if(",
   "from": "s",
   "to": "targ",
   "right": "eller){\n    seller.innerHTML=window.AUSTA_SELLER"
  },
  {
   "left": "ySelector('[data-professional-seller]');\n  if(se",
   "from": "ll",
   "to": "t)targ",
   "right": "er){\n    seller.innerHTML=window.AUSTA_SELLER_IN"
  },
  {
   "left": "lector('[data-professional-seller]');\n  if(selle",
   "from": "r){\n    seller",
   "to": "t",
   "right": ".innerHTML=window.AUSTA_SELLER_INTENT?.detail(it"
  },
  {
   "left": "window.AUSTA_SELLER_INTENT?.detail(item)||'';\n  ",
   "from": "  ",
   "to": "}).",
   "right": "const profile=window.AUSTA_SELLER_IDENTITY?.getF"
  },
  {
   "left": "dow.AUSTA_SELLER_INTENT?.detail(item)||'';\n    c",
   "from": "ons",
   "to": "a",
   "right": "t profile=window.AUSTA_SELLER_IDENTITY?.getForLi"
  },
  {
   "left": "AUSTA_SELLER_INTENT?.detail(item)||'';\n    const",
   "from": " profile",
   "to": "ch(()",
   "right": "=window.AUSTA_SELLER_IDENTITY?.getForListing(ite"
  },
  {
   "left": "LER_INTENT?.detail(item)||'';\n    const profile=",
   "from": "window.AUSTA_SELLER_IDENTITY?.getForListing(item",
   "to": ">{}",
   "right": ");\n\n  }\n  const ownerReady=ownerControls(item,pa"
  },
  {
   "left": ".AUSTA_SELLER_IDENTITY?.getForListing(item);\n\n  ",
   "from": "}",
   "to": "// V166: ownership visibility must not wait for gallery/similar-media requests.",
   "right": "\n  const ownerReady=ownerControls(item,page,deta"
  },
  {
   "left": "\n\n  }\n  const ownerReady=ownerControls(item,page",
   "from": ",detailContext",
   "to": "",
   "right": ");\n\n  /*\n   * CLOSE — capture mərhələsində saxla"
  },
  {
   "left": "erReady=ownerControls(item,page,detailContext);\n",
   "from": "",
   "to": "\n  document.body.style.overflow='hidden';\n\n  history.replaceState(\n    null,\n    '',\n    '#listing='+\n    encodeURIComponent(item.id)\n  );\n\n",
   "right": "\n  /*\n   * CLOSE — capture mərhələsində saxla ki"
  },
  {
   "left": "\n   */\n  page.addEventListener(\n    'click',\n   ",
   "from": " async",
   "to": "",
   "right": " event=>{\n      if(!detailContext.isCurrent())re"
  },
  {
   "left": "dEventListener(\n    'click',\n    async event=>{\n",
   "from": "      if(!detailContext.isCurrent())return;\n      if(event.target.closest('[data-austa-detail-share]')){event.preventDefault();return window.AUSTA_LISTING_DETAIL.share(item.id,item.__austa_source,titleOf(item));}\n      const lifecycle=event.target.closest('[data-owner-lifecycle]');\n      if(lifecycle){\n        event.preventDefault();\n        try{await window.AUSTA_MY_LIFECYCLE.transition(ownerManagementItem(item),lifecycle.dataset.ownerLifecycle);}\n        catch(error){if(detailContext.isCurrent()&&!error.silent)alert(error.message);}\n        if(detailContext.isCurrent())return openFullListing(item.id,item.__austa_source,category);\n        return;\n      }\n",
   "to": "",
   "right": "\n      const close=\n        event.target.closest"
  },
  {
   "left": "zırda açıla bilmədi.'\n    );\n\n    return;\n  }\n\n ",
   "from": " await",
   "to": "",
   "right": " window.AUSTA_MY_LISTINGS_V156.delete(realItem);"
  },
  {
   "left": "}\n\n  await window.AUSTA_MY_LISTINGS_V156.delete(",
   "from": "",
   "to": "\n    ",
   "right": "realItem);\n  if(detailContext.isCurrent())await "
  },
  {
   "left": "it window.AUSTA_MY_LISTINGS_V156.delete(realItem",
   "from": "",
   "to": "\n  ",
   "right": ");\n  if(detailContext.isCurrent())await openFull"
  },
  {
   "left": "window.AUSTA_MY_LISTINGS_V156.delete(realItem);\n",
   "from": "  if(detailContext.isCurrent())await openFullListing(item.id,item.__austa_source,category);\n",
   "to": "",
   "right": "\n  return;\n}\n\n    const promotion=\n  event.targe"
  },
  {
   "left": "rd.dataset.austaHomeListing ||\n  '';\n\n    if(!id",
   "from": "",
   "to": " || !findListing(id)",
   "right": "){\n      return;\n    }\n\n    event.preventDefault"
  },
  {
   "left": "=========================================== */\n\n",
   "from": "window.AUSTA_LISTING_DETAIL.install({hydrate:hydrateSupabaseListingMedia,render:renderResolvedListing,close:teardownDetail});\n\n",
   "to": "",
   "right": "window.AUSTA_OPEN_LISTING=\n  openFullListing;\n\nw"
  },
  {
   "left": "penFullListing(\n        realListing.id,\n        ",
   "from": "",
   "to": "r",
   "right": "event.detail?.source || 'vehicle'\n      );\n\n    "
  },
  {
   "left": "enFullListing(\n        realListing.id,\n        e",
   "from": "ve",
   "to": "alListi",
   "right": "nt.detail?.source || 'vehicle'\n      );\n\n    con"
  },
  {
   "left": "ullListing(\n        realListing.id,\n        even",
   "from": "t",
   "to": "g",
   "right": ".detail?.source || 'vehicle'\n      );\n\n    conso"
  },
  {
   "left": "lListing(\n        realListing.id,\n        event.",
   "from": "de",
   "to": "__aus",
   "right": "tail?.source || 'vehicle'\n      );\n\n    console."
  },
  {
   "left": "ting(\n        realListing.id,\n        event.deta",
   "from": "i",
   "to": "_tab",
   "right": "l?.source || 'vehicle'\n      );\n\n    console.log"
  },
  {
   "left": "ng(\n        realListing.id,\n        event.detail",
   "from": "?.sourc",
   "to": "",
   "right": "e || 'vehicle'\n      );\n\n    console.log(\n      "
  },
  {
   "left": "ing.id,\n        event.detail?.source || 'vehicle",
   "from": "",
   "to": "_listings",
   "right": "'\n      );\n\n    console.log(\n      \"A-USTA SUPAB"
  },
  {
   "left": "ticle>\n  `;\n}\n\n\nasync function openListing(id){\n",
   "from": "  return window.AUSTA_LISTING_DETAIL.open(id,'vehicle');\n",
   "to": "",
   "right": "\n  const supabase =\n    window.AUSTA_SUPABASE;\n\n"
  },
  {
   "left": "sync function openRealListing(\n    listingId\n){\n",
   "from": "    return window.AUSTA_LISTING_DETAIL.open(listingId,'vehicle');\n",
   "to": "",
   "right": "\n    if(!listingId){\n        return;\n    }\n\n\n   "
  },
  {
   "left": "         void window.AUSTA_OPEN_FULL_LISTING(id,",
   "from": "",
   "to": "tables[",
   "right": "source,type==='mechanic'?'usta':type);\n         "
  },
  {
   "left": "   void window.AUSTA_OPEN_FULL_LISTING(id,source",
   "from": "",
   "to": "]",
   "right": ",type==='mechanic'?'usta':type);\n            }\n "
  },
  {
   "left": "========== */\n\nasync function findListingById(id",
   "from": ",source='vehicle'",
   "to": "",
   "right": ") {\n    return window.AUSTA_LISTING_DETAIL.looku"
  },
  {
   "left": "function findListingById(id,source='vehicle') {\n",
   "from": "    return window.AUSTA_LISTING_DETAIL.lookup(id,source);\n",
   "to": "",
   "right": "\n    if (!id) return null;\n\n    const tables = ["
  },
  {
   "left": "api.findListingById =\n        async function (id",
   "from": ",source='vehicle'",
   "to": "",
   "right": ") {\n            return window.AUSTA_LISTING_DETA"
  },
  {
   "left": "\n        async function (id,source='vehicle') {\n",
   "from": "            return window.AUSTA_LISTING_DETAIL.lookup(id,source);\n",
   "to": "",
   "right": "\n            if (!id) {\n                return n"
  },
  {
   "left": "arams.set('listing',card.dataset.listingId);url.",
   "from": "searchParams.set('source','vehicle');url.",
   "to": "",
   "right": "hash='';\n    const title=card.querySelector('.au"
  },
  {
   "left": "or);}\n  }\n  async function openRealListing(id){\n",
   "from": "    return window.AUSTA_LISTING_DETAIL.open(id,'vehicle');\n",
   "to": "",
   "right": "    const open=window.AUSTA_OPEN_FULL_LISTING ||"
  },
  {
   "left": "l(timer);\n        loadRealHomeVideos();\n        ",
   "from": "// P1.6 ",
   "to": "",
   "right": "canonical source-aware router owns shared listin"
  },
  {
   "left": "\n        loadRealHomeVideos();\n        // P1.6 c",
   "from": "an",
   "to": "",
   "right": "onical source-aware router owns shared listing l"
  },
  {
   "left": "     loadRealHomeVideos();\n        // P1.6 canon",
   "from": "ical ",
   "to": "",
   "right": "source-aware router owns shared listing links.\n "
  },
  {
   "left": "oadRealHomeVideos();\n        // P1.6 canonical s",
   "from": "ource-aware rou",
   "to": "",
   "right": "ter owns shared listing links.\n        return;\n "
  },
  {
   "left": "s();\n        // P1.6 canonical source-aware rout",
   "from": "er owns",
   "to": "",
   "right": " shared listing links.\n        return;\n      }\n\n"
  },
  {
   "left": "/ P1.6 canonical source-aware router owns shared",
   "from": "",
   "to": "Id=new",
   "right": " listing links.\n        return;\n      }\n\n      i"
  },
  {
   "left": " P1.6 canonical source-aware router owns shared ",
   "from": "",
   "to": "URL(location.href).searchParams.get('",
   "right": "listing links.\n        return;\n      }\n\n      if"
  },
  {
   "left": "anonical source-aware router owns shared listing",
   "from": "",
   "to": "');\n",
   "right": " links.\n        return;\n      }\n\n      if(attemp"
  },
  {
   "left": "nonical source-aware router owns shared listing ",
   "from": "",
   "to": "       if(sharedId)openRea",
   "right": "links.\n        return;\n      }\n\n      if(attempt"
  },
  {
   "left": "onical source-aware router owns shared listing l",
   "from": "",
   "to": "List",
   "right": "inks.\n        return;\n      }\n\n      if(attempts"
  },
  {
   "left": "ical source-aware router owns shared listing lin",
   "from": "k",
   "to": "g(",
   "right": "s.\n        return;\n      }\n\n      if(attempts>=3"
  },
  {
   "left": "al source-aware router owns shared listing links",
   "from": ".",
   "to": "haredId);",
   "right": "\n        return;\n      }\n\n      if(attempts>=30)"
  }
 ],
 "lifecycle": [
  {
   "left": "');\n}\n\n\nfunction austaMyStatusLabel(status) {\n  ",
   "from": "return window.AU",
   "to": "const s = ",
   "right": "STA_MY_LIFECYCLE?.statusLabel(status) || 'Status"
  },
  {
   "left": "austaMyStatusLabel(status) {\n  return window.AUS",
   "from": "TA_MY_LIFECYCLE?.statusLabel(status)",
   "to": "tring(status",
   "right": " || 'Status əlçatan deyil';\n}\n\nfunction austaMyP"
  },
  {
   "left": "dow.AUSTA_MY_LIFECYCLE?.statusLabel(status) || '",
   "from": "",
   "to": "').toLowerCase();\n\n  if (s === 'active') return 'Aktiv';\n  if (s === 'inactive') return 'Deaktiv';\n  if (s === 'draft') return 'Qaralama';\n  if (s === 'pending') return 'Yoxlanılır';\n  if (s === 'rejected') return 'Rədd edilib';\n  if (s === 'sold') return '",
   "right": "Status əlçatan deyil';\n}\n\nfunction austaMyPromot"
  },
  {
   "left": "ow.AUSTA_MY_LIFECYCLE?.statusLabel(status) || 'S",
   "from": "tatus ",
   "to": "atılıb';\n  if (s === 'rented') return 'İcar",
   "right": "əlçatan deyil';\n}\n\nfunction austaMyPromotionLabe"
  },
  {
   "left": "A_MY_LIFECYCLE?.statusLabel(status) || 'Status ə",
   "from": "lçatan deyil",
   "to": "dədir';\n\n  return status || 'Naməlum",
   "right": "';\n}\n\nfunction austaMyPromotionLabel(item) {\n  c"
  },
  {
   "left": "tatusLabel(status) || 'Status əlçatan deyil';\n}\n",
   "from": "",
   "to": "\n",
   "right": "\nfunction austaMyPromotionLabel(item) {\n  const "
  },
  {
   "left": "-------- */\n\nasync function austaMyLoadListings(",
   "from": "",
   "to": ") {\n  const box = $('#austaMyListings');\n\n  if (!box) return;\n\n  box.innerHTML =\n    '<div class=\"austa-mini-note\">' +\n    'Elanlar yüklənir...' +\n    '</div>';\n\n  try {\n    const user = await austaMyGetUser();\n\n    if (!user) {\n      box.innerHTML =\n        '<div class=\"austa-mini-note\">' +\n        'Elanlarınızı görmək üçün ",
   "right": "host) {\n  return window.AUSTA_MY_LIFECYCLE?.load"
  },
  {
   "left": "------- */\n\nasync function austaMyLoadListings(h",
   "from": "ost) {\n  return",
   "to": "esabınıza daxil olun.' +\n        '</div>';\n\n      return;\n    }\n\n    const sb =",
   "right": " window.AUSTA_MY_LIFECYCLE?.load(host || $('#aus"
  },
  {
   "left": "staMyLoadListings(host) {\n  return window.AUSTA_",
   "from": "",
   "to": "SUPABASE;\n\n    const results = await Promise.all(\n      AUSTA_",
   "right": "MY_LIFECYCLE?.load(host || $('#austaMyListings')"
  },
  {
   "left": "LoadListings(host) {\n  return window.AUSTA_MY_LI",
   "from": "FECYC",
   "to": "STING_TAB",
   "right": "LE?.load(host || $('#austaMyListings'));\n}\n\n/* -"
  },
  {
   "left": "tings(host) {\n  return window.AUSTA_MY_LIFECYCLE",
   "from": "?.load(host",
   "to": "S.map(\n        async config => {\n          const {\n            data,\n            error\n          } = await sb\n            .from(config.table)\n            .select('*')\n            .eq('owner_id', user.id)\n            .order('created_at', {\n              ascending: false\n            });\n\n          if (error) {\n            console.error(\n              '[A-USTA V156-B]',\n              config.table,\n              error\n            );\n\n            return [];\n          }\n\n          return (data",
   "right": " || $('#austaMyListings'));\n}\n\n/* --------------"
  },
  {
   "left": " return window.AUSTA_MY_LIFECYCLE?.load(host || ",
   "from": "$('#",
   "to": "[]).map(item => ({\n            ...item,\n\n            __austa_table: config.table,\n            __austa_source: config.source,\n            __austa_label: config.label,\n            __austa_title: config.title(item),\n            __austa_price: config.price(item)\n          }));\n        }\n      )\n    );\n\n    const listings = results\n      .flat()\n      .sort((a, b) => {\n        const ad = new Date(\n          a.created_at || 0\n        ).getTime();\n\n        const bd = new Date(\n          b.created_at || 0\n        ).getTime();\n\n        return bd - ad;\n      });\n\n    window.AUSTA_MY_REAL_LISTINGS =\n      listings;\n\n    ",
   "right": "austaMyListings'));\n}\n\n/* ----------------------"
  },
  {
   "left": "dow.AUSTA_MY_LIFECYCLE?.load(host || $('#austaMy",
   "from": "",
   "to": "Render",
   "right": "Listings'));\n}\n\n/* -----------------------------"
  },
  {
   "left": "A_MY_LIFECYCLE?.load(host || $('#austaMyListings",
   "from": "')",
   "to": "(listings",
   "right": ");\n}\n\n/* ---------------------------------------"
  },
  {
   "left": "LIFECYCLE?.load(host || $('#austaMyListings'));\n",
   "from": "",
   "to": "\n  ",
   "right": "}\n\n/* ------------------------------------------"
  },
  {
   "left": "IFECYCLE?.load(host || $('#austaMyListings'));\n}",
   "from": "\n",
   "to": " catch (error) {\n    console.error(\n      '[A-USTA V156-B] Mənim elanlarım:',\n      error\n    );\n\n    box.innerHTML =\n      '<div class=\"austa-mini-note\">' +\n      'Elanları yükləmək mümkün olmadı.' +\n      '</div>';\n  }\n}\n\n",
   "right": "\n/* --------------------------------------------"
  },
  {
   "left": "istings) {\n  const box = $('#austaMyListings');\n",
   "from": "",
   "to": "\n",
   "right": "  if(box)box.innerHTML = window.AUSTA_MY_LIFECYC"
  },
  {
   "left": "ngs) {\n  const box = $('#austaMyListings');\n  if",
   "from": "",
   "to": " ",
   "right": "(box)box.innerHTML = window.AUSTA_MY_LIFECYCLE?."
  },
  {
   "left": "gs) {\n  const box = $('#austaMyListings');\n  if(",
   "from": "",
   "to": "!",
   "right": "box)box.innerHTML = window.AUSTA_MY_LIFECYCLE?.r"
  },
  {
   "left": "{\n  const box = $('#austaMyListings');\n  if(box)",
   "from": "",
   "to": " return;\n\n  if (!Array.isArray(listings) ||\n      !listings.length) {\n\n    ",
   "right": "box.innerHTML = window.AUSTA_MY_LIFECYCLE?.rende"
  },
  {
   "left": " $('#austaMyListings');\n  if(box)box.innerHTML =",
   "from": " win",
   "to": "\n      '<",
   "right": "dow.AUSTA_MY_LIFECYCLE?.render(listings) || '';\n"
  },
  {
   "left": "austaMyListings');\n  if(box)box.innerHTML = wind",
   "from": "ow",
   "to": "iv class=\"austa-mini-note\">' +\n      'Hələ real elanınız yoxdur",
   "right": ".AUSTA_MY_LIFECYCLE?.render(listings) || '';\n}\n\n"
  },
  {
   "left": "taMyListings');\n  if(box)box.innerHTML = window.",
   "from": "AUS",
   "to": "' +\n      '</div>';\n\n    return;\n  }\n\n  box.innerH",
   "right": "TA_MY_LIFECYCLE?.render(listings) || '';\n}\n\n/* -"
  },
  {
   "left": "Listings');\n  if(box)box.innerHTML = window.AUST",
   "from": "A",
   "to": "ML = listings.map(item => {\n\n    const title =\n      item.",
   "right": "_MY_LIFECYCLE?.render(listings) || '';\n}\n\n/* ---"
  },
  {
   "left": "stings');\n  if(box)box.innerHTML = window.AUSTA_",
   "from": "MY",
   "to": "",
   "right": "_LIFECYCLE?.render(listings) || '';\n}\n\n/* ------"
  },
  {
   "left": "ngs');\n  if(box)box.innerHTML = window.AUSTA_MY_",
   "from": "LIFECYCLE?.render(listings)",
   "to": "austa_title",
   "right": " || '';\n}\n\n/* ----------------------------------"
  },
  {
   "left": "= window.AUSTA_MY_LIFECYCLE?.render(listings) ||",
   "from": " '",
   "to": "\n      'Elan",
   "right": "';\n}\n\n/* ---------------------------------------"
  },
  {
   "left": "dow.AUSTA_MY_LIFECYCLE?.render(listings) || '';\n",
   "from": "",
   "to": "\n    const location =\n      austaMyLocation(item);\n\n    const price =\n      item.__austa_price || '';\n\n    const status =\n      austaMyStatusLabel(item.status);\n\n    const promotion =\n      austaMyPromotionLabel(item);\n\n    const isActive =\n      String(item.status || '')\n        .toLowerCase() === 'active';\n\n    return `\n      <div\n        class=\"austa-listing-card austa-v156-my-listing\"\n        data-austa-my-id=\"${austaMyEsc(item.id)",
   "right": "}\n\n/* ------------------------------------------"
  },
  {
   "left": "ow.AUSTA_MY_LIFECYCLE?.render(listings) || '';\n}",
   "from": "\n",
   "to": "\"\n        data-austa-my-table=\"${austaMyEsc(item.__austa_table)}\"\n      >\n\n        <div class=\"austa-v156-my-info\">\n\n          <b>\n            ${austaMyEsc(title)}\n          </b>\n\n          <small>\n            ${austaMyEsc(item.__austa_label)}\n\n            ${location\n              ? ' • ' + austaMyEsc(location)\n              : ''\n            }\n\n            ${price\n              ? '<br><strong>' +\n                austaMyEsc(price) +\n                '</strong>'\n              : ''\n            }\n\n            <br>\n\n            Status:\n            <strong>\n              ${austaMyEsc(status)}\n            </strong>\n\n            &nbsp;•&nbsp;\n\n            Paket:\n            <strong>\n              ${austaMyEsc(promotion)}\n            </strong>\n\n          </small>\n\n        </div>\n\n\n        <div class=\"austa-listing-actions\">\n\n          <button\n            type=\"button\"\n            data-austa-my-view\n          >\n            Bax\n          </button>\n\n          <button\n            type=\"button\"\n            data-austa-my-edit\n          >\n            Düzəlt\n          </button>\n\n          <button\n            type=\"button\"\n            data-austa-my-toggle\n          >\n            ${isActive\n              ? 'Deaktiv et'\n              : 'Aktiv et'\n            }\n          </button>\n\n          <button\n            type=\"button\"\n            class=\"vip\"\n            data-austa-my-boost\n          >\n            ↑ İrəli çək\n          </button>\n\n          <button\n            type=\"button\"\n            class=\"vip\"\n            data-austa-my-vip\n          >\n            VIP\n          </button>\n\n          <button\n            type=\"button\"\n            class=\"vip\"\n            data-austa-my-premium\n          >\n            Premium\n          </button>\n\n          <button\n            type=\"button\"\n            data-austa-my-delete\n          >\n            Sil\n          </button>\n\n        </div>\n\n      </div>\n    `;\n  }).join('');\n}\n\n",
   "right": "\n/* --------------------------------------------"
  },
  {
   "left": "-------- */\n\nasync function austaMyEdit(item) {\n",
   "from": "    try{window.AUSTA_LISTING_MEDIA?.assertLifecycleIdle(item?.__austa_table,item?.id);}\n    catch(error){alert(error.message);return;}\n",
   "to": "",
   "right": "\n    if (!item) return;\n\n\n    if (\n        windo"
  },
  {
   "left": "-------------------- */\n\nasync function austaMyT",
   "from": "ransiti",
   "to": "",
   "right": "on(item, action) {\n  try {\n    if(!window.AUSTA_"
  },
  {
   "left": "------------ */\n\nasync function austaMyTransitio",
   "from": "n",
   "to": "ggle",
   "right": "(item, action) {\n  try {\n    if(!window.AUSTA_MY"
  },
  {
   "left": "------ */\n\nasync function austaMyTransition(item",
   "from": ", action",
   "to": "",
   "right": ") {\n  try {\n    if(!window.AUSTA_MY_LIFECYCLE)th"
  },
  {
   "left": "sync function austaMyTransition(item, action) {\n",
   "from": "",
   "to": "  if (!item) return;\n\n",
   "right": "  try {\n    if(!window.AUSTA_MY_LIFECYCLE)throw "
  },
  {
   "left": "ction austaMyTransition(item, action) {\n  try {\n",
   "from": "",
   "to": "    const user =\n      await austaMyGetUser();\n\n",
   "right": "    if(!window.AUSTA_MY_LIFECYCLE)throw new Erro"
  },
  {
   "left": "austaMyTransition(item, action) {\n  try {\n    if",
   "from": "",
   "to": " ",
   "right": "(!window.AUSTA_MY_LIFECYCLE)throw new Error('Ela"
  },
  {
   "left": "staMyTransition(item, action) {\n  try {\n    if(!",
   "from": "",
   "to": "user) {\n      alert(\n        'Əvvəlcə hesabınıza daxil olun.'\n      );\n      return;\n    }\n\n    const current =\n      String(item.status || '')\n        .toLowerCase();\n\n    const next =\n      current === 'active'\n        ? 'inactive'\n        : 'active';\n\n    const actionText =\n      next === 'active'\n        ? 'aktiv etmək'\n        : 'deaktiv etmək';\n\n    if (\n      !confirm(\n        '\"' +\n        (item.__austa_title || 'Elan') +\n        '\" elanını ' +\n        actionText +\n        ' istəyirsiniz?'\n      )\n    ) {\n      return;\n    }\n\n    const {\n      error\n    } = await ",
   "right": "window.AUSTA_MY_LIFECYCLE)throw new Error('Elan "
  },
  {
   "left": "on(item, action) {\n  try {\n    if(!window.AUSTA_",
   "from": "",
   "to": "SUPABASE\n      .from(item.__austa_table)\n      .update({\n        status: next,\n        updated_at: new Date().toISOString()\n      })\n      .eq('id', item.id)\n      .eq('owner_id', user.id);\n\n    if (error) throw error;\n\n    await austa",
   "right": "MY_LIFECYCLE)throw new Error('Elan əməliyyatları"
  },
  {
   "left": "n(item, action) {\n  try {\n    if(!window.AUSTA_M",
   "from": "Y_",
   "to": "y",
   "right": "LIFECYCLE)throw new Error('Elan əməliyyatları si"
  },
  {
   "left": "tem, action) {\n  try {\n    if(!window.AUSTA_MY_L",
   "from": "IFECYC",
   "to": "oad",
   "right": "LE)throw new Error('Elan əməliyyatları sistemi h"
  },
  {
   "left": "tion) {\n  try {\n    if(!window.AUSTA_MY_LIFECYCL",
   "from": "E)t",
   "to": "istings();\n\n  } catc",
   "right": "hrow new Error('Elan əməliyyatları sistemi hazır"
  },
  {
   "left": ") {\n  try {\n    if(!window.AUSTA_MY_LIFECYCLE)th",
   "from": "row new Error('Elan əməliyyatları sistemi hazır deyil.');\n    return await window.",
   "to": " (error) {\n    console.error(\n      '[",
   "right": "AUSTA_MY_LIFECYCLE.transition(item, action);\n  }"
  },
  {
   "left": "istemi hazır deyil.');\n    return await window.A",
   "from": "",
   "to": "-",
   "right": "USTA_MY_LIFECYCLE.transition(item, action);\n  } "
  },
  {
   "left": "mi hazır deyil.');\n    return await window.AUSTA",
   "from": "_MY_LIF",
   "to": " V156-B] status:',\n      error\n    );\n\n    alert(\n      '",
   "right": "ECYCLE.transition(item, action);\n  } catch(error"
  },
  {
   "left": " deyil.');\n    return await window.AUSTA_MY_LIFE",
   "from": "CYCLE.transition(item, action);\n  } catch(error) {\n    if(!error.silent)alert(error.message || 'E",
   "to": "",
   "right": "lanın statusu dəyişdirilmədi.');\n  }\n}\n\n/* -----"
  },
  {
   "left": "ror.silent)alert(error.message || 'Elanın status",
   "from": "",
   "to": "un",
   "right": "u dəyişdirilmədi.');\n  }\n}\n\n/* -----------------"
  },
  {
   "left": "ent)alert(error.message || 'Elanın statusu dəyiş",
   "from": "diril",
   "to": "",
   "right": "mədi.');\n  }\n}\n\n/* -----------------------------"
  },
  {
   "left": "rt(error.message || 'Elanın statusu dəyişdirilmə",
   "from": "di.');\n",
   "to": "k mümkün olmadı.'\n    );\n",
   "right": "  }\n}\n\n/* --------------------------------------"
  },
  {
   "left": "age || 'Elanın statusu dəyişdirilmədi.');\n  }\n}\n",
   "from": "",
   "to": "\n",
   "right": "\n/* --------------------------------------------"
  },
  {
   "left": "body.style\n    .removeProperty('overflow');\n}\n\n\n",
   "from": "async ",
   "to": "",
   "right": "function austaV157Open(item, initialPackageType "
  },
  {
   "left": "aV157Open(item, initialPackageType = 'boost') {\n",
   "from": "  try{\n",
   "to": "",
   "right": "    if(!window.AUSTA_MY_LIFECYCLE)throw new Erro"
  },
  {
   "left": "en(item, initialPackageType = 'boost') {\n  try{\n",
   "from": "    if(!window.AUSTA_MY_LIFECYCLE)throw new Error('Elan statusu yoxlanıla bilmədi.');\n",
   "to": "",
   "right": "    item=await window.AUSTA_MY_LIFECYCLE.authori"
  },
  {
   "left": "w new Error('Elan statusu yoxlanıla bilmədi.');\n",
   "from": "    item=await window.AUSTA_MY_LIFECYCLE.authorizePromotion(item);\n",
   "to": "",
   "right": "  }catch(error){if(error.code!=='LIFECYCLE_STALE"
  },
  {
   "left": "ow.AUSTA_MY_LIFECYCLE.authorizePromotion(item);\n",
   "from": "  }catch(error){if(error.code!=='LIFECYCLE_STALE')alert(error.message);return;}\n",
   "to": "",
   "right": "\n\n  if (!item?.id) {\n\n    alert(\n      'Paket tə"
  },
  {
   "left": "'LIFECYCLE_STALE')alert(error.message);return;}\n",
   "from": "\n",
   "to": "",
   "right": "\n  if (!item?.id) {\n\n    alert(\n      'Paket tət"
  },
  {
   "left": "addEventListener(\n  'click',\n  async event => {\n",
   "from": "    if(event.target.closest('[data-austa-my-retry]')){await austaMyLoadListings();return;}\n\n",
   "to": "",
   "right": "\n    const card =\n      event.target.closest(\n  "
  },
  {
   "left": " event.target.closest(\n        '[data-austa-my-t",
   "from": "ransiti",
   "to": "",
   "right": "on]'\n      )\n    ) {\n      await austaMyTransiti"
  },
  {
   "left": "arget.closest(\n        '[data-austa-my-transitio",
   "from": "n",
   "to": "ggle",
   "right": "]'\n      )\n    ) {\n      await austaMyTransition"
  },
  {
   "left": "ransition]'\n      )\n    ) {\n      await austaMyT",
   "from": "ransiti",
   "to": "",
   "right": "on(item, event.target.closest('[data-austa-my-tr"
  },
  {
   "left": "n]'\n      )\n    ) {\n      await austaMyTransitio",
   "from": "n",
   "to": "ggle",
   "right": "(item, event.target.closest('[data-austa-my-tran"
  },
  {
   "left": "    )\n    ) {\n      await austaMyTransition(item",
   "from": ", event.target.closest('[data-austa-my-transition]').dataset.austaMyTransition",
   "to": "",
   "right": ");\n      return;\n    }\n\n\n    if (\n      event.ta"
  },
  {
   "left": "------------------------------------------- */\n\n",
   "from": "",
   "to": "if (\n  ",
   "right": "window.AUSTA_MY_LIFECYCLE?.bindAuth();\n\n\n/* Init"
  },
  {
   "left": "------------------------------ */\n\nwindow.AUSTA_",
   "from": "MY_LIFECYCL",
   "to": "SUPABAS",
   "right": "E?.bindAuth();\n\n\n/* Initial real load */\n\naustaM"
  },
  {
   "left": "---------------- */\n\nwindow.AUSTA_MY_LIFECYCLE?.",
   "from": "b",
   "to": "auth\n) {\n  w",
   "right": "indAuth();\n\n\n/* Initial real load */\n\naustaMyLoa"
  },
  {
   "left": "------------ */\n\nwindow.AUSTA_MY_LIFECYCLE?.bind",
   "from": "",
   "to": "ow.AUSTA_SUPABASE.auth.on",
   "right": "Auth();\n\n\n/* Initial real load */\n\naustaMyLoadLi"
  },
  {
   "left": "-------- */\n\nwindow.AUSTA_MY_LIFECYCLE?.bindAuth",
   "from": "",
   "to": "StateChange",
   "right": "();\n\n\n/* Initial real load */\n\naustaMyLoadListin"
  },
  {
   "left": "------- */\n\nwindow.AUSTA_MY_LIFECYCLE?.bindAuth(",
   "from": "",
   "to": "\n    () => {\n      setTimeout(\n        austaMyLoadListings,\n        0\n      ",
   "right": ");\n\n\n/* Initial real load */\n\naustaMyLoadListing"
  },
  {
   "left": "---- */\n\nwindow.AUSTA_MY_LIFECYCLE?.bindAuth();\n",
   "from": "",
   "to": "    }\n  );\n}\n",
   "right": "\n\n/* Initial real load */\n\naustaMyLoadListings()"
  },
  {
   "left": "(item) {\n    return austaMyEdit(item);\n  },\n\n  t",
   "from": "ransiti",
   "to": "",
   "right": "on(item, action) {\n    return austaMyTransition("
  },
  {
   "left": "\n    return austaMyEdit(item);\n  },\n\n  transitio",
   "from": "n",
   "to": "ggle",
   "right": "(item, action) {\n    return austaMyTransition(it"
  },
  {
   "left": "eturn austaMyEdit(item);\n  },\n\n  transition(item",
   "from": ", action",
   "to": "",
   "right": ") {\n    return austaMyTransition(item, action);\n"
  },
  {
   "left": "  transition(item, action) {\n    return austaMyT",
   "from": "ransiti",
   "to": "",
   "right": "on(item, action);\n  },\n\n  delete(item) {\n    ret"
  },
  {
   "left": "tion(item, action) {\n    return austaMyTransitio",
   "from": "n",
   "to": "ggle",
   "right": "(item, action);\n  },\n\n  delete(item) {\n    retur"
  },
  {
   "left": "tem, action) {\n    return austaMyTransition(item",
   "from": ", action",
   "to": "",
   "right": ");\n  },\n\n  delete(item) {\n    return austaMyDele"
  },
  {
   "left": "ings') {\n    setTimeout(() => {\n      const host",
   "from": "",
   "to": " ",
   "right": "=document.getElementById('austaV39RealListingsHo"
  },
  {
   "left": "ngs') {\n    setTimeout(() => {\n      const host=",
   "from": "",
   "to": "\n        ",
   "right": "document.getElementById('austaV39RealListingsHos"
  },
  {
   "left": ") => {\n      const host=document.getElementById(",
   "from": "",
   "to": "\n          ",
   "right": "'austaV39RealListingsHost');\n      const api=win"
  },
  {
   "left": "cument.getElementById('austaV39RealListingsHost'",
   "from": "",
   "to": "\n        ",
   "right": ");\n      const api=window.AUSTA_MY_LISTINGS_V156"
  },
  {
   "left": "ent.getElementById('austaV39RealListingsHost');\n",
   "from": "      const a",
   "to": "\n      if (!host) return;\n\n      const listings =\n        window.AUSTA_MY_LISTINGS_V156?.getAll?.() || [];\n\n      if (!listings.length) {\n        host.innerHTML =\n          '<div class=\"austa-v39-em",
   "right": "pi=window.AUSTA_MY_LISTINGS_V156;\n      if(!host"
  },
  {
   "left": "ById('austaV39RealListingsHost');\n      const ap",
   "from": "i",
   "to": "ty\">' +\n          'Hələ elan yoxdur.' +\n          '</div>';\n\n        window.AUSTA_MY_LISTINGS_V156\n          ?.refresh?.()\n          ?.then(() ",
   "right": "=window.AUSTA_MY_LISTINGS_V156;\n      if(!host |"
  },
  {
   "left": "Id('austaV39RealListingsHost');\n      const api=",
   "from": "",
   "to": "> {\n            showPage(\n              'listings',\n              currentRole\n            );\n          });\n\n        return;\n      }\n\n      host.innerHTML = listings.map(item => {\n\n        const title =\n          item.__austa_title ||\n          item.title ||\n          item.dealer_name ||\n          [item.brand, item.model, item.year]\n            .filter(Boolean)\n            .join(' ') ||\n          'Elan';\n\n        const location =\n          [item.region, item.district]\n            .filter(Boolean)\n            .join(' / ');\n\n        const status =\n          String(item.status || '')\n            .toLowerCase() === 'active'\n              ? 'Aktiv'\n              : 'Deaktiv';\n\n        const promotion =\n          String(\n            item.promotion_type ||\n            'standard'\n          ).toLowerCase();\n\n        const promotionLabel =\n          promotion === 'premium'\n            ? 'Premium'\n            : promotion === 'vip'\n              ? 'VIP'\n              : promotion === 'boost'\n                ? 'İrəli çək'\n                : 'Standart';\n\n        return `\n          <article\n            class=\"austa-v39-listing\"\n            data-austa-my-id=\"${esc(item.id)}\"\n            data-austa-my-table=\"${esc(item.__austa_table)}\"\n           >\n\n            <div>\n              <h4>\n                ${esc(title)}\n              </h4>\n\n              <p>\n                ${esc(item.__austa_label || 'Elan')}\n                ${location ? ' • ' + esc(location) : ''}\n              </p>\n\n              <p class=\"austa-v39-small\">\n                Status:\n                <b>${esc(status)}</b>\n                • Paket:\n                <b>${esc(promotionLabel)}</b>\n              </p>\n\n              <div class=\"austa-v39-actions\">\n\n              <button\n  class=\"austa-v39-btn\"\n  data-austa-my-view\n>\n  Bax\n</button>\n\n<button\n  class=\"austa-v39-btn\"\n  data-austa-my-edit\n>\n  Düzəlt\n</button>\n\n<button\n  class=\"austa-v39-btn\"\n  data-austa-my-toggle\n>\n  ${\n    String(item.status || '')\n      .toLowerCase() === 'active'\n        ? 'Deaktiv et'\n        : 'Aktiv et'\n  }\n</button>\n\n<button\n  class=\"austa-v39-btn\"\n  data-austa-my-boost\n>\n  ↑ İrəli çək\n</button>\n\n<button\n  class=\"austa-v39-btn\"\n  data-austa-my-vip\n>\n  VIP\n</button>\n\n<button\n  class=\"austa-v39-btn primary\"\n  data-austa-my-premium\n>\n  Premium\n</button>\n\n<button\n  class=\"austa-v39-btn\"\n  data-austa-my-delete\n>\n  Sil\n</button>\n\n              </div>\n            </div>\n\n          </article>\n        `;\n      }).join('');\n\n      /* --------------------------------------------------\n         V156 REAL LISTING MANAGEMENT — V39 BUTTONS\n         -------------------------------------------------- */\n\n      host.onclick = async event => {\n\n        const card = event.target.closest(\n          '[data-austa-my-id]'\n        );\n\n        if (!card || !host.contains(card)) {\n          return;\n        }\n\n        const api =\n          ",
   "right": "window.AUSTA_MY_LISTINGS_V156;\n      if(!host ||"
  },
  {
   "left": "\n      const api=window.AUSTA_MY_LISTINGS_V156;\n",
   "from": "",
   "to": "\n  ",
   "right": "      if(!host || !api)return;\n      void api.re"
  },
  {
   "left": "onst api=window.AUSTA_MY_LISTINGS_V156;\n      if",
   "from": "",
   "to": " ",
   "right": "(!host || !api)return;\n      void api.refresh(ho"
  },
  {
   "left": "st api=window.AUSTA_MY_LISTINGS_V156;\n      if(!",
   "from": "host || !",
   "to": "",
   "right": "api)return;\n      void api.refresh(host);\n      "
  },
  {
   "left": ".AUSTA_MY_LISTINGS_V156;\n      if(!host || !api)",
   "from": "return",
   "to": " {\n          console.error(\n            'AUSTA_MY_LISTINGS_V156 API tapılmadı.'\n          )",
   "right": ";\n      void api.refresh(host);\n      host.oncli"
  },
  {
   "left": "INGS_V156;\n      if(!host || !api)return;\n      ",
   "from": "void",
   "to": "    return;\n        }\n\n        const item =",
   "right": " api.refresh(host);\n      host.onclick=async eve"
  },
  {
   "left": ";\n      if(!host || !api)return;\n      void api.",
   "from": "refresh(host);\n      host.onclick=async event=>{\n        if(event.tar",
   "to": "",
   "right": "get.closest('[data-austa-my-retry]'))return api."
  },
  {
   "left": "t.onclick=async event=>{\n        if(event.target",
   "from": ".closest('[data-austa-my-retry]'))return api.refresh(host);\n",
   "to": "",
   "right": "        const card=event.target.closest('[data-a"
  },
  {
   "left": "ata-austa-my-retry]'))return api.refresh(host);\n",
   "from": "        const card=event.target.closest('[data-austa-my-id]');\n",
   "to": "",
   "right": "        if(!card || !host.contains(card))return;"
  },
  {
   "left": "ard=event.target.closest('[data-austa-my-id]');\n",
   "from": "        if(!card || !host.contains(card))return;\n",
   "to": "",
   "right": "        const item=api.getItem(card.dataset.aust"
  },
  {
   "left": "       if(!card || !host.contains(card))return;\n",
   "from": "        const item=api.get",
   "to": "",
   "right": "Item(card.dataset.austaMyId,card.dataset.austaMy"
  },
  {
   "left": "ns(card))return;\n        const item=api.getItem(",
   "from": "",
   "to": "\n          ",
   "right": "card.dataset.austaMyId,card.dataset.austaMyTable"
  },
  {
   "left": "  const item=api.getItem(card.dataset.austaMyId,",
   "from": "",
   "to": "\n          ",
   "right": "card.dataset.austaMyTable);\n        if(!item)ret"
  },
  {
   "left": "card.dataset.austaMyId,card.dataset.austaMyTable",
   "from": "",
   "to": "\n        ",
   "right": ");\n        if(!item)return;\n        if(event.tar"
  },
  {
   "left": "d.dataset.austaMyId,card.dataset.austaMyTable);\n",
   "from": "",
   "to": "\n",
   "right": "        if(!item)return;\n        if(event.target"
  },
  {
   "left": "austaMyId,card.dataset.austaMyTable);\n        if",
   "from": "",
   "to": " ",
   "right": "(!item)return;\n        if(event.target.closest('"
  },
  {
   "left": "Id,card.dataset.austaMyTable);\n        if(!item)",
   "from": "return;\n        if(event.target.closest('[data-austa-m",
   "to": " {\n          console.error(\n            'V156 elan cache-də tapılmadı.',\n            card.dataset.austaM",
   "right": "y-view]'))return api.view(item);\n        if(even"
  },
  {
   "left": "\n        if(event.target.closest('[data-austa-my",
   "from": "-view]'))return api.view(item);\n        if(event.target.closest('[data-austa-my-edit]'))return api.edit(item);\n        const transition=event.target.closest('[data-austa-my-transition]');\n        if(transition)return api.transition(item",
   "to": "Id",
   "right": ",transition.dataset.austaMyTransition);\n        "
  },
  {
   "left": "       if(transition)return api.transition(item,",
   "from": "transition",
   "to": "\n            card",
   "right": ".dataset.austaMyTransition);\n        if(event.ta"
  },
  {
   "left": " api.transition(item,transition.dataset.austaMyT",
   "from": "ransition",
   "to": "able\n          ",
   "right": ");\n        if(event.target.closest('[data-austa-"
  },
  {
   "left": ",transition.dataset.austaMyTransition);\n        ",
   "from": "",
   "to": "  return;\n        }\n\n        ",
   "right": "if(event.target.closest('[data-austa-my-delete]'"
  },
  {
   "left": "ransition.dataset.austaMyTransition);\n        if",
   "from": "(",
   "to": " (\n          ",
   "right": "event.target.closest('[data-austa-my-delete]'))r"
  },
  {
   "left": "aMyTransition);\n        if(event.target.closest(",
   "from": "",
   "to": "\n            ",
   "right": "'[data-austa-my-delete]'))return api.delete(item"
  },
  {
   "left": "        if(event.target.closest('[data-austa-my-",
   "from": "delete",
   "to": "view",
   "right": "]'))return api.delete(item);\n        for(const t"
  },
  {
   "left": "if(event.target.closest('[data-austa-my-delete]'",
   "from": "))return",
   "to": "\n          )\n        ) {\n          await",
   "right": " api.delete(item);\n        for(const type of ['b"
  },
  {
   "left": "et.closest('[data-austa-my-delete]'))return api.",
   "from": "delete",
   "to": "view",
   "right": "(item);\n        for(const type of ['boost','vip'"
  },
  {
   "left": "a-my-delete]'))return api.delete(item);\n        ",
   "from": "",
   "to": "  return;\n        }\n\n        i",
   "right": "for(const type of ['boost','vip','premium']){\n  "
  },
  {
   "left": "-my-delete]'))return api.delete(item);\n        f",
   "from": "or(const t",
   "to": " (\n          event.target.closest(\n            '[data-austa-m",
   "right": "ype of ['boost','vip','premium']){\n          if("
  },
  {
   "left": "'))return api.delete(item);\n        for(const ty",
   "from": "",
   "to": "-edit]'\n          )\n        ) {\n          await a",
   "right": "pe of ['boost','vip','premium']){\n          if(e"
  },
  {
   "left": "))return api.delete(item);\n        for(const typ",
   "from": "e o",
   "to": "i.edit(item);\n          return;\n        }\n\n        i",
   "right": "f ['boost','vip','premium']){\n          if(event"
  },
  {
   "left": "urn api.delete(item);\n        for(const type of ",
   "from": "",
   "to": "(\n          event.target.closest(\n            '",
   "right": "['boost','vip','premium']){\n          if(event.t"
  },
  {
   "left": "rn api.delete(item);\n        for(const type of [",
   "from": "'",
   "to": "data-austa-my-toggle]'\n          )\n        ) {\n          await api.toggle(item);\n\n          await api.refresh();\n\n          showPage(\n            'listings',\n            currentRole\n          );\n\n          return;\n        }\n\n        if (\n          event.target.closest(\n            '[data-austa-my-",
   "right": "boost','vip','premium']){\n          if(event.tar"
  },
  {
   "left": ".delete(item);\n        for(const type of ['boost",
   "from": "'",
   "to": "]'\n          )\n        ) {\n          api.openPackage(\n            item",
   "right": ",'vip','premium']){\n          if(event.target.cl"
  },
  {
   "left": "elete(item);\n        for(const type of ['boost',",
   "from": "'",
   "to": "\n            'boost'\n          );\n          return;\n        }\n\n        if (\n          e",
   "right": "vip','premium']){\n          if(event.target.clos"
  },
  {
   "left": "ete(item);\n        for(const type of ['boost','v",
   "from": "",
   "to": "ent.target.closest(\n            '[data-austa-my-v",
   "right": "ip','premium']){\n          if(event.target.close"
  },
  {
   "left": "e(item);\n        for(const type of ['boost','vip",
   "from": "'",
   "to": "]'\n          )\n        ) {\n          api.openPackage(\n            item",
   "right": ",'premium']){\n          if(event.target.closest("
  },
  {
   "left": "item);\n        for(const type of ['boost','vip',",
   "from": "'",
   "to": "\n            'vi",
   "right": "premium']){\n          if(event.target.closest('["
  },
  {
   "left": "em);\n        for(const type of ['boost','vip','p",
   "from": "remium'",
   "to": "'\n          );\n          return;\n        }\n\n        if (\n          event.target.closest(\n            '[data-austa-my-premium",
   "right": "]){\n          if(event.target.closest('[data-aus"
  },
  {
   "left": "     for(const type of ['boost','vip','premium']",
   "from": ")",
   "to": "'\n          )\n        ) ",
   "right": "{\n          if(event.target.closest('[data-austa"
  },
  {
   "left": "t type of ['boost','vip','premium']){\n          ",
   "from": "",
   "to": "api.openPackage(\n            item,\n            'premium'\n          );\n          return;\n        }\n\n        ",
   "right": "if(event.target.closest('[data-austa-my-'+type+'"
  },
  {
   "left": "type of ['boost','vip','premium']){\n          if",
   "from": "(",
   "to": " (\n          ",
   "right": "event.target.closest('[data-austa-my-'+type+']')"
  },
  {
   "left": ",'premium']){\n          if(event.target.closest(",
   "from": "",
   "to": "\n            ",
   "right": "'[data-austa-my-'+type+']'))return api.openPacka"
  },
  {
   "left": "        if(event.target.closest('[data-austa-my-",
   "from": "'+ty",
   "to": "delete]'\n          )\n        ) {\n          await a",
   "right": "pe+']'))return api.openPackage(item,type);\n     "
  },
  {
   "left": "   if(event.target.closest('[data-austa-my-'+typ",
   "from": "e+']'))return",
   "to": "i.delete(item);\n\n          await",
   "right": " api.openPackage(item,type);\n        }\n      };\n"
  },
  {
   "left": ".closest('[data-austa-my-'+type+']'))return api.",
   "from": "open",
   "to": "refresh();\n\n          show",
   "right": "Package(item,type);\n        }\n      };\n    },0);"
  },
  {
   "left": "st('[data-austa-my-'+type+']'))return api.openPa",
   "from": "cka",
   "to": "",
   "right": "ge(item,type);\n        }\n      };\n    },0);\n  }\n"
  },
  {
   "left": "ata-austa-my-'+type+']'))return api.openPackage(",
   "from": "item",
   "to": "\n            'listings'",
   "right": ",type);\n        }\n      };\n    },0);\n  }\n if (pa"
  },
  {
   "left": "usta-my-'+type+']'))return api.openPackage(item,",
   "from": "type",
   "to": "\n            currentRole\n          ",
   "right": ");\n        }\n      };\n    },0);\n  }\n if (page =="
  },
  {
   "left": "-'+type+']'))return api.openPackage(item,type);\n",
   "from": "",
   "to": "\n          return;\n",
   "right": "        }\n      };\n    },0);\n  }\n if (page === '"
  },
  {
   "left": " api.openPackage(item,type);\n        }\n      };\n",
   "from": "",
   "to": "\n  \n",
   "right": "    },0);\n  }\n if (page === 'orders') {\n  setTim"
  },
  {
   "left": "penPackage(item,type);\n        }\n      };\n    },",
   "from": "",
   "to": " ",
   "right": "0);\n  }\n if (page === 'orders') {\n  setTimeout(("
  }
 ],
 "ownerOld": [
  {
   "left": " daxil olun.'\n      );\n      return;\n    }\n\n    ",
   "from": "if(!wi",
   "to": "co",
   "right": "ndow.AUSTA_LISTING_MEDIA)throw new Error('Media "
  },
  {
   "left": "olun.'\n      );\n      return;\n    }\n\n    if(!win",
   "from": "dow.AUSTA_LISTING_MEDIA)",
   "to": "s",
   "right": "throw new Error('Media təmizləmə sistemi hazır d"
  },
  {
   "left": "urn;\n    }\n\n    if(!window.AUSTA_LISTING_MEDIA)t",
   "from": "hrow",
   "to": "",
   "right": " new Error('Media təmizləmə sistemi hazır deyil."
  },
  {
   "left": "    }\n\n    if(!window.AUSTA_LISTING_MEDIA)throw ",
   "from": "n",
   "to": "{\n      ",
   "right": "ew Error('Media təmizləmə sistemi hazır deyil.')"
  },
  {
   "left": "  }\n\n    if(!window.AUSTA_LISTING_MEDIA)throw ne",
   "from": "w E",
   "to": "",
   "right": "rror('Media təmizləmə sistemi hazır deyil.');\n  "
  },
  {
   "left": "  if(!window.AUSTA_LISTING_MEDIA)throw new Error",
   "from": "('Media təmizləmə sistemi hazır deyil.');",
   "to": "",
   "right": "\n    await window.AUSTA_LISTING_MEDIA.deleteOwne"
  },
  {
   "left": "ror('Media təmizləmə sistemi hazır deyil.');\n   ",
   "from": "",
   "to": " } =",
   "right": " await window.AUSTA_LISTING_MEDIA.deleteOwnedLis"
  },
  {
   "left": " sistemi hazır deyil.');\n    await window.AUSTA_",
   "from": "LI",
   "to": "",
   "right": "STING_MEDIA.deleteOwnedListing(item.__austa_tabl"
  },
  {
   "left": "stemi hazır deyil.');\n    await window.AUSTA_LIS",
   "from": "TING_M",
   "to": "UPABAS",
   "right": "EDIA.deleteOwnedListing(item.__austa_table,item."
  },
  {
   "left": "azır deyil.');\n    await window.AUSTA_LISTING_ME",
   "from": "DIA",
   "to": "\n      ",
   "right": ".deleteOwnedListing(item.__austa_table,item.id);"
  },
  {
   "left": " deyil.');\n    await window.AUSTA_LISTING_MEDIA.",
   "from": "deleteOwnedListing",
   "to": "from",
   "right": "(item.__austa_table,item.id);\n\n    await austaMy"
  },
  {
   "left": "TING_MEDIA.deleteOwnedListing(item.__austa_table",
   "from": "",
   "to": ")\n      .delete()\n      .eq('id'",
   "right": ",item.id);\n\n    await austaMyLoadListings();\n\n  "
  },
  {
   "left": "ING_MEDIA.deleteOwnedListing(item.__austa_table,",
   "from": "",
   "to": " ",
   "right": "item.id);\n\n    await austaMyLoadListings();\n\n  }"
  },
  {
   "left": "A.deleteOwnedListing(item.__austa_table,item.id)",
   "from": "",
   "to": "\n      .eq('owner_id', user.id)",
   "right": ";\n\n    await austaMyLoadListings();\n\n  } catch ("
  },
  {
   "left": "deleteOwnedListing(item.__austa_table,item.id);\n",
   "from": "",
   "to": "\n    if (error) throw error;\n",
   "right": "\n    await austaMyLoadListings();\n\n  } catch (er"
  },
  {
   "left": "] delete:',\n      error\n    );\n\n    alert(\n     ",
   "from": " error?.code==='MEDIA_DELETE_FAILED' ? error.message :",
   "to": "",
   "right": " 'Elanı silmək mümkün olmadı.'\n    );\n  }\n}\n\n  /"
  },
  {
   "left": "id,storage_path,media_type,sort_order,created_at",
   "from": ",is_cover",
   "to": "",
   "right": "':'id,listing_id,storage_path,media_type,sort_or"
  },
  {
   "left": "ath,media_type,sort_order,created_at,is_cover':'",
   "from": "id,",
   "to": "",
   "right": "listing_id,storage_path,media_type,sort_order,cr"
  },
  {
   "left": ":'id,listing_id,storage_path,media_type,sort_ord",
   "from": "er,created_at,is_cov",
   "to": "",
   "right": "er')\n      .eq('listing_id',item.id).order('sort"
  },
  {
   "left": "     .eq('listing_id',item.id).order('sort_order",
   "from": "',{ascending:true}).order('created_at',{ascending:true}).order('id",
   "to": "",
   "right": "',{ascending:true});\n    if(error)throw error;\n "
  },
  {
   "left": "ths=ready.filter(row=>row.media_type==='image').",
   "from": "sort((a,b)=>Number(b.is_cover)-Number(a.is_cover)).",
   "to": "",
   "right": "map(row=>row.signed_url);\n    item.cover_image_p"
  },
  {
   "left": " : ''])\n  ].filter(([,value])=>value!=='');\n}\n\n\n",
   "from": "window.AUSTA_LISTING_PRESENTATION=Object.freeze({vehicleSpecs:carSpecs,marketplaceSpecs});\n",
   "to": "",
   "right": "function genericSpecs(item){\n\n  const ignored=ne"
  }
 ],
 "ownerRecent": [
  {
   "left": " : ''])\n  ].filter(([,value])=>value!=='');\n}\n\n\n",
   "from": "window.AUSTA_LISTING_PRESENTATION=Object.freeze({vehicleSpecs:carSpecs,marketplaceSpecs});\n",
   "to": "",
   "right": "function genericSpecs(item){\n\n  const ignored=ne"
  }
 ],
 "media": [
  {
   "left": "id,storage_path,media_type,sort_order,created_at",
   "from": ",is_cover",
   "to": "",
   "right": "':'id,listing_id,storage_path,media_type,sort_or"
  },
  {
   "left": "ath,media_type,sort_order,created_at,is_cover':'",
   "from": "id,",
   "to": "",
   "right": "listing_id,storage_path,media_type,sort_order,cr"
  },
  {
   "left": ":'id,listing_id,storage_path,media_type,sort_ord",
   "from": "er,created_at,is_cov",
   "to": "",
   "right": "er')\n      .eq('listing_id',item.id).order('sort"
  },
  {
   "left": "     .eq('listing_id',item.id).order('sort_order",
   "from": "',{ascending:true}).order('created_at',{ascending:true}).order('id",
   "to": "",
   "right": "',{ascending:true});\n    if(error)throw error;\n "
  },
  {
   "left": "ths=ready.filter(row=>row.media_type==='image').",
   "from": "sort((a,b)=>Number(b.is_cover)-Number(a.is_cover)).",
   "to": "",
   "right": "map(row=>row.signed_url);\n    item.cover_image_p"
  },
  {
   "left": " : ''])\n  ].filter(([,value])=>value!=='');\n}\n\n\n",
   "from": "window.AUSTA_LISTING_PRESENTATION=Object.freeze({vehicleSpecs:carSpecs,marketplaceSpecs});\n",
   "to": "",
   "right": "function genericSpecs(item){\n\n  const ignored=ne"
  }
 ],
 "presentation": [
  {
   "left": "ssets/marketplace/seller-identity.js\"></script>\n",
   "from": "<script src=\"assets/marketplace/seller-intent.js\"></script>\n",
   "to": "",
   "right": "<script src=\"assets/marketplace/listing-preview."
  },
  {
   "left": "\"assets/marketplace/seller-intent.js\"></script>\n",
   "from": "<script src=\"assets/marketplace/listing-preview.js\"></script>\n",
   "to": "",
   "right": "<script src=\"assets/marketplace/listing-lifecycl"
  },
  {
   "left": "ssets/marketplace/listing-preview.js\"></script>\n",
   "from": "<script src=\"assets/marketplace/listing-lifecycle.js\"></script>\n",
   "to": "",
   "right": "<link rel=\"stylesheet\" href=\"assets/marketplace/"
  },
  {
   "left": "on.vip{background:#7e142d;border-color:#e62d50}\n",
   "from": "/* P1.5A My Listings */\n",
   "to": "",
   "right": ".austa-p15-actions{display:flex;flex-direction:c"
  },
  {
   "left": "d;border-color:#e62d50}\n/* P1.5A My Listings */\n",
   "from": ".austa-p15-actions{display:flex;flex-direction:column;gap:8px}.austa-p15-status{display:inline-block;padding:4px 8px;border-radius:6px;background:#123b57}.austa-p15-listing p{margin:6px 0}@media(max-width:600px){.austa-p15-listing{grid-template-columns:1fr}.austa-p15-actions .austa-listing-actions{justify-content:flex-start}}\n",
   "to": "",
   "right": "/* /P1.5A My Listings */\n.austa-vip-form{display"
  },
  {
   "left": "ta-listing-actions{justify-content:flex-start}}\n",
   "from": "/* /P1.5A My Listings */\n",
   "to": "",
   "right": ".austa-vip-form{display:grid;grid-template-colum"
  },
  {
   "left": " : ''])\n  ].filter(([,value])=>value!=='');\n}\n\n\n",
   "from": "window.AUSTA_LISTING_PRESENTATION=Object.freeze({vehicleSpecs:carSpecs,marketplaceSpecs});\n",
   "to": "",
   "right": "function genericSpecs(item){\n\n  const ignored=ne"
  },
  {
   "left": "baseListingMedia(\n        item\n      );\n  }\n\n\n  ",
   "from": "c",
   "to": "v",
   "right": "onst sellerIdentityReady=Promise.resolve(window."
  },
  {
   "left": "seListingMedia(\n        item\n      );\n  }\n\n\n  co",
   "from": "nst",
   "to": "id",
   "right": " sellerIdentityReady=Promise.resolve(window.AUST"
  },
  {
   "left": "stingMedia(\n        item\n      );\n  }\n\n\n  const ",
   "from": "sellerIdentityReady=Promise.resolve(",
   "to": "",
   "right": "window.AUSTA_SELLER_IDENTITY?.hydrate([item]));\n"
  },
  {
   "left": "ve(window.AUSTA_SELLER_IDENTITY?.hydrate([item])",
   "from": ")",
   "to": "",
   "right": ";\n\n  removeOldListingOverlays();\n  \n  const cate"
  },
  {
   "left": "      `\n                  : ''\n              }\n\n",
   "from": "              <div data-professional-seller></div>\n",
   "to": "",
   "right": "              <div class=\"austa-final-seller\">\n "
  },
  {
   "left": "</div>\n  `;\n\n  document.body.appendChild(page);\n",
   "from": "  void sellerIdentityReady.then(()=>{\n",
   "to": "",
   "right": "    if(!page.isConnected)return;\n    const targe"
  },
  {
   "left": "ld(page);\n  void sellerIdentityReady.then(()=>{\n",
   "from": "    if(!page.isConnected)return;\n",
   "to": "",
   "right": "    const target=page.querySelector('[data-profe"
  },
  {
   "left": "ady.then(()=>{\n    if(!page.isConnected)return;\n",
   "from": "    const target=page.querySelector('[data-professional-seller]');\n",
   "to": "",
   "right": "    if(target)target.innerHTML=window.AUSTA_SELL"
  },
  {
   "left": "ge.querySelector('[data-professional-seller]');\n",
   "from": "    if(target)target.innerHTML=window.AUSTA_SELLER_INTENT?.detail(item)||'';\n",
   "to": "",
   "right": "  }).catch(()=>{});\n\n  // V166: ownership visibi"
  },
  {
   "left": "L=window.AUSTA_SELLER_INTENT?.detail(item)||'';\n",
   "from": "  }).catch(()=>{});\n",
   "to": "",
   "right": "\n  // V166: ownership visibility must not wait f"
  },
  {
   "left": "ns:repeat(3,minmax(0,1fr));\n    }\n}\n\n</style>\n\n\n",
   "from": "<script src=\"assets/marketplace/media-manager.js\"></script>\n",
   "to": "",
   "right": "<script id=\"austa-v153d-14-category-media-js\">\n("
  }
 ],
 "presentationOld": [
  {
   "left": "ssets/marketplace/seller-identity.js\"></script>\n",
   "from": "<script src=\"assets/marketplace/seller-intent.js\"></script>\n",
   "to": "",
   "right": "<script src=\"assets/marketplace/listing-preview."
  },
  {
   "left": "\"assets/marketplace/seller-intent.js\"></script>\n",
   "from": "<script src=\"assets/marketplace/listing-preview.js\"></script>\n",
   "to": "",
   "right": "<script src=\"assets/marketplace/listing-lifecycl"
  },
  {
   "left": "ssets/marketplace/listing-preview.js\"></script>\n",
   "from": "<script src=\"assets/marketplace/listing-lifecycle.js\"></script>\n",
   "to": "",
   "right": "<link rel=\"stylesheet\" href=\"assets/marketplace/"
  },
  {
   "left": "on.vip{background:#7e142d;border-color:#e62d50}\n",
   "from": "/* P1.5A My Listings */\n",
   "to": "",
   "right": ".austa-p15-actions{display:flex;flex-direction:c"
  },
  {
   "left": "d;border-color:#e62d50}\n/* P1.5A My Listings */\n",
   "from": ".austa-p15-actions{display:flex;flex-direction:column;gap:8px}.austa-p15-status{display:inline-block;padding:4px 8px;border-radius:6px;background:#123b57}.austa-p15-listing p{margin:6px 0}@media(max-width:600px){.austa-p15-listing{grid-template-columns:1fr}.austa-p15-actions .austa-listing-actions{justify-content:flex-start}}\n",
   "to": "",
   "right": "/* /P1.5A My Listings */\n.austa-vip-form{display"
  },
  {
   "left": "ta-listing-actions{justify-content:flex-start}}\n",
   "from": "/* /P1.5A My Listings */\n",
   "to": "",
   "right": ".austa-vip-form{display:grid;grid-template-colum"
  },
  {
   "left": "baseListingMedia(\n        item\n      );\n  }\n\n\n  ",
   "from": "c",
   "to": "v",
   "right": "onst sellerIdentityReady=Promise.resolve(window."
  },
  {
   "left": "seListingMedia(\n        item\n      );\n  }\n\n\n  co",
   "from": "nst",
   "to": "id",
   "right": " sellerIdentityReady=Promise.resolve(window.AUST"
  },
  {
   "left": "stingMedia(\n        item\n      );\n  }\n\n\n  const ",
   "from": "sellerIdentityReady=Promise.resolve(",
   "to": "",
   "right": "window.AUSTA_SELLER_IDENTITY?.hydrate([item]));\n"
  },
  {
   "left": "ve(window.AUSTA_SELLER_IDENTITY?.hydrate([item])",
   "from": ")",
   "to": "",
   "right": ";\n\n  removeOldListingOverlays();\n  \n  const cate"
  },
  {
   "left": "      `\n                  : ''\n              }\n\n",
   "from": "              <div data-professional-seller></div>\n",
   "to": "",
   "right": "              <div class=\"austa-final-seller\">\n "
  },
  {
   "left": "</div>\n  `;\n\n  document.body.appendChild(page);\n",
   "from": "  void sellerIdentityReady.then(()=>{\n",
   "to": "",
   "right": "    if(!page.isConnected)return;\n    const targe"
  },
  {
   "left": "ld(page);\n  void sellerIdentityReady.then(()=>{\n",
   "from": "    if(!page.isConnected)return;\n",
   "to": "",
   "right": "    const target=page.querySelector('[data-profe"
  },
  {
   "left": "ady.then(()=>{\n    if(!page.isConnected)return;\n",
   "from": "    const target=page.querySelector('[data-professional-seller]');\n",
   "to": "",
   "right": "    if(target)target.innerHTML=window.AUSTA_SELL"
  },
  {
   "left": "ge.querySelector('[data-professional-seller]');\n",
   "from": "    if(target)target.innerHTML=window.AUSTA_SELLER_INTENT?.detail(item)||'';\n",
   "to": "",
   "right": "  }).catch(()=>{});\n\n  // V166: ownership visibi"
  },
  {
   "left": "L=window.AUSTA_SELLER_INTENT?.detail(item)||'';\n",
   "from": "  }).catch(()=>{});\n",
   "to": "",
   "right": "\n  // V166: ownership visibility must not wait f"
  },
  {
   "left": "ns:repeat(3,minmax(0,1fr));\n    }\n}\n\n</style>\n\n\n",
   "from": "<script src=\"assets/marketplace/media-manager.js\"></script>\n",
   "to": "",
   "right": "<script id=\"austa-v153d-14-category-media-js\">\n("
  }
 ],
 "presentationRecent": [
  {
   "left": "ssets/marketplace/seller-identity.js\"></script>\n",
   "from": "<script src=\"assets/marketplace/seller-intent.js\"></script>\n",
   "to": "",
   "right": "<script src=\"assets/marketplace/listing-preview."
  },
  {
   "left": "\"assets/marketplace/seller-intent.js\"></script>\n",
   "from": "<script src=\"assets/marketplace/listing-preview.js\"></script>\n",
   "to": "",
   "right": "<script src=\"assets/marketplace/listing-lifecycl"
  },
  {
   "left": "ssets/marketplace/listing-preview.js\"></script>\n",
   "from": "<script src=\"assets/marketplace/listing-lifecycle.js\"></script>\n",
   "to": "",
   "right": "<link rel=\"stylesheet\" href=\"assets/marketplace/"
  },
  {
   "left": "on.vip{background:#7e142d;border-color:#e62d50}\n",
   "from": "/* P1.5A My Listings */\n",
   "to": "",
   "right": ".austa-p15-actions{display:flex;flex-direction:c"
  },
  {
   "left": "d;border-color:#e62d50}\n/* P1.5A My Listings */\n",
   "from": ".austa-p15-actions{display:flex;flex-direction:column;gap:8px}.austa-p15-status{display:inline-block;padding:4px 8px;border-radius:6px;background:#123b57}.austa-p15-listing p{margin:6px 0}@media(max-width:600px){.austa-p15-listing{grid-template-columns:1fr}.austa-p15-actions .austa-listing-actions{justify-content:flex-start}}\n",
   "to": "",
   "right": "/* /P1.5A My Listings */\n.austa-vip-form{display"
  },
  {
   "left": "ta-listing-actions{justify-content:flex-start}}\n",
   "from": "/* /P1.5A My Listings */\n",
   "to": "",
   "right": ".austa-vip-form{display:grid;grid-template-colum"
  },
  {
   "left": "baseListingMedia(\n        item\n      );\n  }\n\n\n  ",
   "from": "c",
   "to": "v",
   "right": "onst sellerIdentityReady=Promise.resolve(window."
  },
  {
   "left": "seListingMedia(\n        item\n      );\n  }\n\n\n  co",
   "from": "nst",
   "to": "id",
   "right": " sellerIdentityReady=Promise.resolve(window.AUST"
  },
  {
   "left": "stingMedia(\n        item\n      );\n  }\n\n\n  const ",
   "from": "sellerIdentityReady=Promise.resolve(",
   "to": "",
   "right": "window.AUSTA_SELLER_IDENTITY?.hydrate([item]));\n"
  },
  {
   "left": "ve(window.AUSTA_SELLER_IDENTITY?.hydrate([item])",
   "from": ")",
   "to": "",
   "right": ";\n\n  removeOldListingOverlays();\n  \n  const cate"
  },
  {
   "left": "      `\n                  : ''\n              }\n\n",
   "from": "              <div data-professional-seller></div>\n",
   "to": "",
   "right": "              <div class=\"austa-final-seller\">\n "
  },
  {
   "left": "</div>\n  `;\n\n  document.body.appendChild(page);\n",
   "from": "  void sellerIdentityReady.then(()=>{\n",
   "to": "",
   "right": "    if(!page.isConnected)return;\n    const targe"
  },
  {
   "left": "ld(page);\n  void sellerIdentityReady.then(()=>{\n",
   "from": "    if(!page.isConnected)return;\n",
   "to": "",
   "right": "    const target=page.querySelector('[data-profe"
  },
  {
   "left": "ady.then(()=>{\n    if(!page.isConnected)return;\n",
   "from": "    const target=page.querySelector('[data-professional-seller]');\n",
   "to": "",
   "right": "    if(target)target.innerHTML=window.AUSTA_SELL"
  },
  {
   "left": "ge.querySelector('[data-professional-seller]');\n",
   "from": "    if(target)target.innerHTML=window.AUSTA_SELLER_INTENT?.detail(item)||'';\n",
   "to": "",
   "right": "  }).catch(()=>{});\n\n  // V166: ownership visibi"
  },
  {
   "left": "L=window.AUSTA_SELLER_INTENT?.detail(item)||'';\n",
   "from": "  }).catch(()=>{});\n",
   "to": "",
   "right": "\n  // V166: ownership visibility must not wait f"
  },
  {
   "left": "ns:repeat(3,minmax(0,1fr));\n    }\n}\n\n</style>\n\n\n",
   "from": "<script src=\"assets/marketplace/media-manager.js\"></script>\n",
   "to": "",
   "right": "<script id=\"austa-v153d-14-category-media-js\">\n("
  }
 ]
};
function apply(text,name){
 const edits=recipes[name].map((r,index)=>{
  const key=r.left+r.from+r.right,at=text.indexOf(key);
  assert.ok(key&&at>=0&&text.indexOf(key,at+1)<0,'P2.A missing/ambiguous '+name+' #'+(index+1));
  return {start:at+r.left.length,end:at+r.left.length+r.from.length,to:r.to};
 }).sort((a,b)=>b.start-a.start);
 for(let i=0;i<edits.length;i++)for(let j=i+1;j<edits.length;j++){
  const a=edits[i],b=edits[j],aInsert=a.start===a.end,bInsert=b.start===b.end;
  const collision=aInsert?bInsert?a.start===b.start:a.start>=b.start&&a.start<=b.end
   :bInsert?b.start>=a.start&&b.start<=a.end:Math.max(a.start,b.start)<Math.min(a.end,b.end);
  assert.ok(!collision,'P2.A edit collision '+name);
 }
 for(const e of edits)text=text.slice(0,e.start)+e.to+text.slice(e.end);
 return text;
}
const crypto=require('node:crypto');
const historicalHashes=["96825bf2f263aabfd8bde04678d2dee4452e180a84f7178fcac59209a5867e32", "6c98fdf8ce688b304165eaa81ee653667bfa628fef43a4a40eccf52078a87ccf"];
const digest=text=>crypto.createHash('sha256').update(text).digest('hex');
function recent(base){const index=historicalHashes.indexOf(digest(base));assert.ok(index>=0,'P2.A unreviewed historical baseline');return index===1;}

// Explicit current-contract partition: these approved units are checked and
// retained separately, NOT reverse-normalized into nonexistent historical code.
const currentUnits=[
 {
  "name": "businessOf",
  "start": "function businessOf(",
  "end": "\nfunction locationOf(",
  "sha256": "6b47e69e1c910f37cb6649a1e5316b1eea7e2a53953b92381e8224c81c5bdbf3"
 },
 {
  "name": "detailInformation",
  "start": "function detailInformation(",
  "end": "\nfunction specsFor(",
  "sha256": "81f1971f5003baffeca51cc264a843d9e5450931258ddc5d6cd6767831f27bff"
 },
 {
  "name": "closePage",
  "start": "function closePage(",
  "end": "\nasync function mediaGallery(",
  "sha256": "2d89663abd32962e8f51d3f74ddc110c31479a9f518dfe53d9dc77cf039906ff"
 },
 {
  "name": "openFullListing",
  "start": "async function openFullListing(",
  "end": "\nasync function renderResolvedListing(",
  "sha256": "ac633f0ef0f2d68365b17c0dba42579404ad92b2f236ef9312fcf340b25869e5"
 },
 {
  "name": "detailModuleImport",
  "start": "<script src=\"assets/marketplace/listing-detail.js\">",
  "end": "\n<link rel=\"stylesheet\" href=\"assets/marketplace/listing-cards.css\">",
  "sha256": "8bdec13fba39e7119dc553abc5dfbe518aea426ab620c0a918f900c7f9f42e4f"
 },
 {
  "name": "detailStyle",
  "start": "<style id=\"austa-p16-detail-css\">",
  "end": "\n<script id=\"austa-final-full-listing-js\">",
  "sha256": "b95bd5abde55262a79a071b382964dc8bf5481057709dc2d849bd96d100c793f"
 },
 {
  "name": "sellerPageLink",
  "start": "    // Existing seller page supports verified active dealers and sale Vehicles only.",
  "end": "\n  }\n  const ownerReady=",
  "sha256": "2537d42a914af57c1f6c9b83c2bf2571baccab930ef2b669fd5d6c287bda0390"
 },
 {
  "name": "lifecycleControls",
  "start": "              <div class=\"austa-p16-lifecycle\">",
  "end": "\n              <div class=\"austa-final-owner-actions austa-v158-promotion-actions\">",
  "sha256": "fd919158f224256cc68ffeded4653c04fb5892f64bc6e2bdcac9e57d0272ab1a"
 }
];
function partitionCurrent(html){
 const binding='window.AUSTA_LISTING_DETAIL.install({hydrate:hydrateSupabaseListingMedia,render:renderResolvedListing,close:teardownDetail});';
 assert.equal(html.split(binding).length-1,1,'P2.A current cleanup binding');
 const scriptStart=html.indexOf('<script id="austa-final-full-listing-js">');
 const scriptEnd=html.indexOf('</script>',scriptStart);
 const parts=currentUnits.map(spec=>{
  const start=html.indexOf(spec.start),end=html.indexOf(spec.end,start);
  assert.ok(start>=0&&html.indexOf(spec.start,start+1)<0&&end>start,'P2.A current boundary '+spec.name);
  if(!['detailModuleImport','detailStyle'].includes(spec.name))assert.ok(start>scriptStart&&end<scriptEnd,'P2.A current placement '+spec.name);
  const source=html.slice(start,end);
  assert.equal(digest(source),spec.sha256,'P2.A current contract '+spec.name);
  return {name:spec.name,source,start,end};
 });
 let historical=html;
 for(const part of [...parts].sort((a,b)=>b.start-a.start))historical=historical.slice(0,part.start)+historical.slice(part.end);
 return {historical,current:parts.map(({name,source})=>({name,source}))};
}
exports.currentContracts=partitionCurrent;


// This P1.5 API accessor has no counterpart in the older 19c generation.
// Retain and verify it as current behavior, separately from historical edits.
function partitionLifecycleState(html){
 const source="  state: () => window.AUSTA_MY_LIFECYCLE?.state(),\n",start=html.indexOf(source);
 assert.ok(start>=0&&html.indexOf(source,start+1)<0,'P2.A current lifecycle state authority');
 assert.equal(digest(source),"d1c7c3edf210f71b989743722ac937c8fd4defa0d54e4759f8d6eb4d8eae8f46");
 return {historical:html.slice(0,start)+html.slice(start+source.length),current:[{name:'lifecycleStateAccessor',source}]};
}
exports.currentLifecycleContracts=partitionLifecycleState;

exports.withBaselineDetail=(html,base)=>{recent(base);return apply(partitionCurrent(html).historical,'detail');};
exports.withBaselineLifecycle=(html,base)=>recent(base)?html:apply(partitionLifecycleState(html).historical,'lifecycle');
exports.withBaselineMediaHydration=(html,base)=>{assert.equal(recent(base),false,'P2.A media historical generation');return apply(html,'media');};
const presentationInputs=new Map();
exports.withBaselineOwnerDelete=(html,base)=>{
 if(html.includes("// One key per selected File/assignment/stage,"))html=require("./e2b-baseline.cjs").normalize(html);
 html=exports.withBaselineDetail(html,base);
 html=exports.withBaselineLifecycle(html,base);
 html=apply(html,recent(base)?'ownerRecent':'ownerOld');
 presentationInputs.set(html,recent(base)?'presentationRecent':'presentationOld');
 return html;
};
exports.withoutSellerPresentation=html=>{
 const known=presentationInputs.get(html);
 if(known)return apply(html,known);
 if(!recent(html))return html;
 return apply(html,'presentation');
};
exports.inventory=()=>Object.entries(recipes).flatMap(([helper,rules])=>rules.map((r,index)=>({helper,index:index+1,...r,classification:'NARROW',failClosed:true})));
exports.verifyRecipe=(text,name)=>apply(text,name);
exports.verifyEdits=(text,rules)=>{const name='__collisionProof';assert.ok(!Object.hasOwn(recipes,name));recipes[name]=rules;try{return apply(text,name);}finally{delete recipes[name];}};
