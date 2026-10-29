/* A-USTA V169A: shared brand/model catalog, shared by all vehicle consumers. */
(function(){
'use strict';
const models = {

  "Mercedes-Benz": [
    "A-Class",
    "B-Class",
    "C-Class",
    "CLA",
    "CLC",
    "CLK",
    "CLS",
    "E-Class",
    "G-Class",
    "GLA",
    "GLB",
    "GLC",
    "GLE",
    "GL",
    "GLK",
    "GLS",
    "ML",
    "R-Class",
    "S-Class",
    "SL",
    "SLC",
    "SLK",
    "V-Class",
    "Viano",
    "Vito",
    "Sprinter",
    "Citan",
    "EQA",
    "EQB",
    "EQC",
    "EQE",
    "EQS",
    "EQV",
    "AMG GT",
    "Digər"
  ],

  "BMW": [
    "1 Series",
    "2 Series",
    "3 Series",
    "4 Series",
    "5 Series",
    "6 Series",
    "7 Series",
    "8 Series",
    "X1",
    "X2",
    "X3",
    "X4",
    "X5",
    "X6",
    "X7",
    "XM",
    "Z4",
    "i3",
    "i4",
    "i5",
    "i7",
    "i8",
    "iX",
    "iX1",
    "iX2",
    "iX3",
    "M2",
    "M3",
    "M4",
    "M5",
    "M8",
    "Digər"
  ],

  "Audi": [
    "A1",
    "A2",
    "A3",
    "A4",
    "A5",
    "A6",
    "A7",
    "A8",
    "Q2",
    "Q3",
    "Q4 e-tron",
    "Q5",
    "Q6 e-tron",
    "Q7",
    "Q8",
    "TT",
    "R8",
    "e-tron",
    "e-tron GT",
    "RS3",
    "RS4",
    "RS5",
    "RS6",
    "RS7",
    "RS Q8",
    "Digər"
  ],

  "Toyota": [
    "Camry",
    "Corolla",
    "Corolla Cross",
    "C-HR",
    "RAV4",
    "Highlander",
    "Land Cruiser",
    "Land Cruiser Prado",
    "4Runner",
    "Fortuner",
    "Hilux",
    "Avalon",
    "Yaris",
    "Prius",
    "Sienna",
    "Venza",
    "Sequoia",
    "Tacoma",
    "Tundra",
    "Supra",
    "bZ4X",
    "Crown",
    "Digər"
  ],

  "Lexus": [
    "CT",
    "IS",
    "ES",
    "GS",
    "LS",
    "UX",
    "NX",
    "RX",
    "GX",
    "LX",
    "RC",
    "LC",
    "RZ",
    "LM",
    "Digər"
  ],

  "Hyundai": [
    "Accent",
    "Elantra",
    "Sonata",
    "Azera",
    "i10",
    "i20",
    "i30",
    "Tucson",
    "Santa Fe",
    "Palisade",
    "Creta",
    "Kona",
    "Venue",
    "Staria",
    "H-1",
    "IONIQ",
    "IONIQ 5",
    "IONIQ 6",
    "IONIQ 9",
    "Genesis Coupe",
    "Digər"
  ],

  "Kia": [
    "Picanto",
    "Rio",
    "Cerato",
    "K3",
    "K5",
    "K7",
    "K8",
    "K9",
    "Optima",
    "Stinger",
    "Soul",
    "Seltos",
    "Sportage",
    "Sorento",
    "Telluride",
    "Carnival",
    "Niro",
    "EV3",
    "EV5",
    "EV6",
    "EV9",
    "Digər"
  ],

  "Nissan": [
    "Micra",
    "Sunny",
    "Sentra",
    "Altima",
    "Maxima",
    "Juke",
    "Qashqai",
    "X-Trail",
    "Rogue",
    "Murano",
    "Pathfinder",
    "Patrol",
    "Armada",
    "Navara",
    "Frontier",
    "Leaf",
    "Ariya",
    "GT-R",
    "370Z",
    "Z",
    "Digər"
  ],

  "Honda": [
    "Civic",
    "Accord",
    "City",
    "Fit",
    "Jazz",
    "HR-V",
    "CR-V",
    "Pilot",
    "Passport",
    "Odyssey",
    "Ridgeline",
    "Insight",
    "e:Ny1",
    "NSX",
    "Digər"
  ],

  "Mazda": [
    "Mazda2",
    "Mazda3",
    "Mazda6",
    "CX-3",
    "CX-30",
    "CX-5",
    "CX-50",
    "CX-60",
    "CX-70",
    "CX-80",
    "CX-90",
    "MX-5",
    "MX-30",
    "BT-50",
    "Digər"
  ],

  "Mitsubishi": [
    "Lancer",
    "Galant",
    "ASX",
    "Eclipse Cross",
    "Outlander",
    "Pajero",
    "Pajero Sport",
    "Montero",
    "L200",
    "Attrage",
    "Colt",
    "Xpander",
    "Digər"
  ],

  "Subaru": [
    "Impreza",
    "Legacy",
    "WRX",
    "BRZ",
    "Forester",
    "Outback",
    "Crosstrek",
    "Ascent",
    "Solterra",
    "Digər"
  ],

  "Volkswagen": [
    "Polo",
    "Golf",
    "Jetta",
    "Passat",
    "Arteon",
    "T-Roc",
    "T-Cross",
    "Taigo",
    "Tiguan",
    "Touareg",
    "Atlas",
    "Touran",
    "Caddy",
    "Transporter",
    "Multivan",
    "Crafter",
    "ID.3",
    "ID.4",
    "ID.5",
    "ID.6",
    "ID.7",
    "ID. Buzz",
    "Digər"
  ],

  "Skoda": [
    "Fabia",
    "Rapid",
    "Scala",
    "Octavia",
    "Superb",
    "Kamiq",
    "Karoq",
    "Kodiaq",
    "Enyaq",
    "Elroq",
    "Digər"
  ],

  "SEAT": [
    "Ibiza",
    "Leon",
    "Arona",
    "Ateca",
    "Tarraco",
    "Alhambra",
    "Toledo",
    "Digər"
  ],

  "Cupra": [
    "Leon",
    "Ateca",
    "Formentor",
    "Born",
    "Tavascan",
    "Terramar",
    "Digər"
  ],

  "Porsche": [
    "718 Boxster",
    "718 Cayman",
    "911",
    "Panamera",
    "Macan",
    "Cayenne",
    "Taycan",
    "Digər"
  ],

  "Land Rover": [
    "Defender",
    "Discovery",
    "Discovery Sport",
    "Range Rover",
    "Range Rover Sport",
    "Range Rover Velar",
    "Range Rover Evoque",
    "Freelander",
    "Digər"
  ],

  "Jaguar": [
    "XE",
    "XF",
    "XJ",
    "F-Type",
    "E-Pace",
    "F-Pace",
    "I-Pace",
    "Digər"
  ],

  "Ford": [
    "Fiesta",
    "Focus",
    "Mondeo",
    "Fusion",
    "Mustang",
    "Mustang Mach-E",
    "EcoSport",
    "Puma",
    "Kuga",
    "Escape",
    "Edge",
    "Explorer",
    "Expedition",
    "Bronco",
    "Ranger",
    "F-150",
    "Maverick",
    "Transit",
    "Transit Connect",
    "Tourneo",
    "Digər"
  ],

  "Chevrolet": [
    "Spark",
    "Aveo",
    "Cruze",
    "Malibu",
    "Impala",
    "Camaro",
    "Corvette",
    "Trax",
    "Trailblazer",
    "Equinox",
    "Blazer",
    "Traverse",
    "Tahoe",
    "Suburban",
    "Captiva",
    "Colorado",
    "Silverado",
    "Bolt EV",
    "Bolt EUV",
    "Digər"
  ],

  "Cadillac": [
    "ATS",
    "CTS",
    "CT4",
    "CT5",
    "CT6",
    "XT4",
    "XT5",
    "XT6",
    "Escalade",
    "Lyriq",
    "Optiq",
    "Digər"
  ],

  "Jeep": [
    "Renegade",
    "Compass",
    "Cherokee",
    "Grand Cherokee",
    "Wrangler",
    "Gladiator",
    "Commander",
    "Avenger",
    "Wagoneer",
    "Grand Wagoneer",
    "Digər"
  ],

  "Dodge": [
    "Dart",
    "Charger",
    "Challenger",
    "Durango",
    "Journey",
    "Hornet",
    "Ram",
    "Digər"
  ],

  "Chrysler": [
    "200",
    "300",
    "Pacifica",
    "Voyager",
    "Town & Country",
    "Digər"
  ],

  "Tesla": [
    "Model 3",
    "Model S",
    "Model X",
    "Model Y",
    "Cybertruck",
    "Roadster",
    "Digər"
  ],

  "Volvo": [
    "S40",
    "S60",
    "S80",
    "S90",
    "V40",
    "V60",
    "V90",
    "XC40",
    "XC60",
    "XC90",
    "C40",
    "EX30",
    "EX40",
    "EX90",
    "Digər"
  ],

  "Renault": [
    "Clio",
    "Megane",
    "Fluence",
    "Talisman",
    "Symbol",
    "Captur",
    "Kadjar",
    "Koleos",
    "Arkana",
    "Duster",
    "Austral",
    "Espace",
    "Kangoo",
    "Master",
    "Zoe",
    "Megane E-Tech",
    "Digər"
  ],

  "Peugeot": [
    "107",
    "108",
    "206",
    "207",
    "208",
    "301",
    "307",
    "308",
    "407",
    "408",
    "508",
    "2008",
    "3008",
    "4008",
    "5008",
    "Partner",
    "Rifter",
    "Expert",
    "Boxer",
    "Digər"
  ],

  "Citroen": [
    "C1",
    "C2",
    "C3",
    "C4",
    "C5",
    "C-Elysee",
    "C3 Aircross",
    "C4 Cactus",
    "C5 Aircross",
    "Berlingo",
    "Jumpy",
    "Jumper",
    "Digər"
  ],

  "Opel": [
    "Corsa",
    "Astra",
    "Vectra",
    "Insignia",
    "Mokka",
    "Crossland",
    "Grandland",
    "Zafira",
    "Combo",
    "Vivaro",
    "Movano",
    "Frontera",
    "Digər"
  ],

  "Fiat": [
    "500",
    "Panda",
    "Punto",
    "Tipo",
    "Bravo",
    "Linea",
    "500X",
    "500L",
    "Doblo",
    "Fiorino",
    "Ducato",
    "Fullback",
    "600",
    "Digər"
  ],

  "Alfa Romeo": [
    "147",
    "156",
    "159",
    "Giulietta",
    "Giulia",
    "Stelvio",
    "Tonale",
    "4C",
    "Digər"
  ],

  "Maserati": [
    "Ghibli",
    "Quattroporte",
    "Levante",
    "Grecale",
    "GranTurismo",
    "GranCabrio",
    "MC20",
    "Digər"
  ],

  "Ferrari": [
    "Roma",
    "Portofino",
    "296",
    "488",
    "F8",
    "812",
    "SF90",
    "Purosangue",
    "Digər"
  ],

  "Lamborghini": [
    "Huracan",
    "Aventador",
    "Revuelto",
    "Urus",
    "Temerario",
    "Digər"
  ],

  "Bentley": [
    "Continental GT",
    "Flying Spur",
    "Bentayga",
    "Mulsanne",
    "Digər"
  ],

  "Rolls-Royce": [
    "Ghost",
    "Phantom",
    "Wraith",
    "Dawn",
    "Cullinan",
    "Spectre",
    "Digər"
  ],

  "MINI": [
    "Cooper",
    "Cooper S",
    "Clubman",
    "Countryman",
    "Paceman",
    "Aceman",
    "Digər"
  ],

  "Suzuki": [
    "Alto",
    "Swift",
    "Baleno",
    "Ciaz",
    "Jimny",
    "Vitara",
    "Grand Vitara",
    "S-Cross",
    "Ignis",
    "Ertiga",
    "Digər"
  ],

  "Isuzu": [
    "D-Max",
    "MU-X",
    "N-Series",
    "F-Series",
    "Digər"
  ],

  "Infiniti": [
    "G",
    "Q30",
    "Q50",
    "Q60",
    "Q70",
    "QX30",
    "QX50",
    "QX55",
    "QX60",
    "QX70",
    "QX80",
    "FX",
    "Digər"
  ],

  "Acura": [
    "ILX",
    "TLX",
    "RLX",
    "Integra",
    "RDX",
    "MDX",
    "ZDX",
    "NSX",
    "Digər"
  ],

  "Genesis": [
    "G70",
    "G80",
    "G90",
    "GV60",
    "GV70",
    "GV80",
    "Digər"
  ],

  "BYD": [
    "Dolphin",
    "Seagull",
    "Seal",
    "Seal U",
    "Atto 3",
    "Han",
    "Tang",
    "Song Plus",
    "Song Pro",
    "Qin Plus",
    "Qin L",
    "Destroyer 05",
    "Yuan Plus",
    "Yuan Up",
    "e2",
    "e6",
    "Digər"
  ],

  "Changan": [
    "Alsvin",
    "Eado",
    "UNI-V",
    "UNI-T",
    "UNI-K",
    "CS35 Plus",
    "CS55 Plus",
    "CS75 Plus",
    "CS85",
    "CS95",
    "Deepal S7",
    "Deepal SL03",
    "Lumin",
    "Digər"
  ],

  "Geely": [
    "Emgrand",
    "Coolray",
    "Atlas",
    "Atlas Pro",
    "Monjaro",
    "Tugella",
    "Okavango",
    "Geometry C",
    "Galaxy L6",
    "Galaxy L7",
    "Galaxy E5",
    "Digər"
  ],

  "Zeekr": [
    "001",
    "007",
    "009",
    "7X",
    "X",
    "MIX",
    "Digər"
  ],

  "Lynk & Co": [
    "01",
    "02",
    "03",
    "05",
    "06",
    "07",
    "08",
    "09",
    "Z10",
    "Digər"
  ],

  "Haval": [
    "Jolion",
    "H6",
    "H6 GT",
    "H9",
    "Dargo",
    "M6",
    "F7",
    "Digər"
  ],

  "GWM": [
    "Poer",
    "Wingle",
    "Tank 300",
    "Tank 400",
    "Tank 500",
    "Ora 03",
    "Digər"
  ],

  "Chery": [
    "Arrizo 5",
    "Arrizo 6",
    "Arrizo 8",
    "Tiggo 2",
    "Tiggo 4",
    "Tiggo 7",
    "Tiggo 8",
    "Tiggo 9",
    "Digər"
  ],

  "Exeed": [
    "LX",
    "TXL",
    "RX",
    "VX",
    "Exlantix ES",
    "Exlantix ET",
    "Digər"
  ],

  "Jetour": [
    "X50",
    "X70",
    "X70 Plus",
    "X90",
    "X90 Plus",
    "Dashing",
    "T1",
    "T2",
    "Digər"
  ],

  "Hongqi": [
    "H5",
    "H6",
    "H9",
    "HS3",
    "HS5",
    "HS7",
    "E-HS9",
    "Digər"
  ],

  "FAW": [
    "Bestune B70",
    "Bestune T55",
    "Bestune T77",
    "Bestune T90",
    "Bestune NAT",
    "Digər"
  ],

  "JAC": [
    "J7",
    "JS2",
    "JS3",
    "JS4",
    "JS6",
    "T8",
    "T9",
    "E-J7",
    "Digər"
  ],

  "MG": [
    "MG3",
    "MG4",
    "MG5",
    "MG6",
    "ZS",
    "HS",
    "Marvel R",
    "Cyberster",
    "Digər"
  ],

  "NIO": [
    "ET5",
    "ET7",
    "EL6",
    "EL7",
    "EL8",
    "EC6",
    "EC7",
    "Digər"
  ],

  "XPeng": [
    "P5",
    "P7",
    "G6",
    "G9",
    "X9",
    "Mona M03",
    "Digər"
  ],

  "Li Auto": [
    "L6",
    "L7",
    "L8",
    "L9",
    "MEGA",
    "Digər"
  ],

  "AITO": [
    "M5",
    "M7",
    "M8",
    "M9",
    "Digər"
  ],

  "Dongfeng": [
    "Aeolus",
    "Forthing T5",
    "Forthing T5 EVO",
    "Forthing U-Tour",
    "Voyah Free",
    "Voyah Dream",
    "Voyah Passion",
    "Digər"
  ],

  "BAIC": [
    "U5 Plus",
    "X35",
    "X55",
    "X7",
    "BJ40",
    "BJ60",
    "BJ80",
    "Digər"
  ],

  "GAC": [
    "Empow",
    "GS3",
    "GS4",
    "GS8",
    "M8",
    "Aion S",
    "Aion Y",
    "Aion V",
    "Digər"
  ],

  "Rivian": [
    "R1T",
    "R1S",
    "R2",
    "R3",
    "Digər"
  ],

  "Lucid": [
    "Air",
    "Gravity",
    "Digər"
  ],

  "Lada": [
    "2101",
    "2106",
    "2107",
    "2109",
    "2110",
    "2114",
    "Niva",
    "Niva Travel",
    "Granta",
    "Vesta",
    "Largus",
    "XRAY",
    "Digər"
  ],

  "GAZ": [
    "Volga",
    "Gazelle",
    "Gazelle NEXT",
    "Sobol",
    "Digər"
  ],

  "UAZ": [
    "Hunter",
    "Patriot",
    "Pickup",
    "Bukhanka",
    "Digər"
  ],

  "Daewoo": [
    "Matiz",
    "Nexia",
    "Lanos",
    "Leganza",
    "Nubira",
    "Gentra",
    "Digər"
  ],

  "Ravon": [
    "R2",
    "R3",
    "R4",
    "Gentra",
    "Nexia",
    "Digər"
  ]
};
// V169D.2: additional approved brands; empty arrays require manual model entry.
models["Abarth"] = [];
models["Aprilia"] = [];
models["Arctic Cat"] = [];
models["Aston Martin"] = [];
models["ATV"] = [];
models["Avatr"] = [];
models["Avia"] = [];
models["Bajaj"] = [];
models["BAW"] = [];
models["BENDA"] = [];
models["Bestune"] = [];
models["BMC"] = [];
models["BMW Alpina"] = [];
models["BRP"] = [];
models["Buick"] = [];
models["C.Moto"] = [];
models["Can-Am"] = [];
models["Cengo"] = [];
models["CFMOTO"] = [];
models["Champ"] = [];
models["Dacia"] = [];
models["DAF"] = [];
models["Daihatsu"] = [];
models["Dayang"] = [];
models["Dayun"] = [];
models["Denza"] = [];
models["DFSK"] = [];
models["Dnepr"] = [];
models["Dofern"] = [];
models["Ducati"] = [];
models["Forthing"] = [];
models["Foton"] = [];
models["Freedom"] = [];
models["General Auto"] = [];
models["GMC"] = [];
models["Grandmoto"] = [];
models["GST"] = [];
models["Haima"] = [];
models["Haojue"] = [];
models["Harley-Davidson"] = [];
models["HOWO"] = [];
models["Hummer"] = [];
models["Hycan"] = [];
models["iCar"] = [];
models["iHonzda"] = [];
models["IJ"] = [];
models["IM"] = [];
models["Indian Motorcycle"] = [];
models["Iran Khodro"] = [];
models["Iveco"] = [];
models["JAECOO"] = [];
models["Jawa"] = [];
models["Jiangmen"] = [];
models["Jianshe"] = [];
models["JMC"] = [];
models["Jonway"] = [];
models["KAIYI"] = [];
models["Kama"] = [];
models["KamAz"] = [];
models["Karry"] = [];
models["Kavaki"] = [];
models["KAvZ"] = [];
models["Kawasaki"] = [];
models["Kayo"] = [];
models["Khazar"] = [];
models["Kuba"] = [];
models["KYC"] = [];
models["Leapmotor"] = [];
models["Lifan"] = [];
models["Lincoln"] = [];
models["Lotus"] = [];
models["LTI"] = [];
models["LuAz"] = [];
models["M-Hero"] = [];
models["Mack"] = [];
models["Maextro"] = [];
models["MAN"] = [];
models["Maple"] = [];
models["MAZ"] = [];
models["Megelli"] = [];
models["Mercedes-Maybach"] = [];
models["Mercury"] = [];
models["Mikilon"] = [];
models["Minsk"] = [];
models["Mondial"] = [];
models["Moskvich"] = [];
models["Muravey"] = [];
models["MV Agusta"] = [];
models["Nama"] = [];
models["Neman"] = [];
models["Neta"] = [];
models["PAZ"] = [];
models["Polad"] = [];
models["Polaris"] = [];
models["Polestar"] = [];
models["Pontiac"] = [];
models["QJMotor"] = [];
models["RAF"] = [];
models["Renault Samsung"] = [];
models["RKS"] = [];
models["Rover"] = [];
models["ROX (Polar Stone)"] = [];
models["Royal Enfield"] = [];
models["Saab"] = [];
models["Saipa"] = [];
models["SamAuto"] = [];
models["Saturn"] = [];
models["Scania"] = [];
models["Shacman"] = [];
models["Shaolin"] = [];
models["Sharmax"] = [];
models["Shifeng"] = [];
models["Shining Golf Cart"] = [];
models["Skywell"] = [];
models["Smart"] = [];
models["Soueast"] = [];
models["Ssang Yong"] = [];
models["SYM"] = [];
models["Tofas"] = [];
models["Triumph"] = [];
models["Tufan"] = [];
models["Tur motors"] = [];
models["TVS"] = [];
models["Ural"] = [];
models["Vespa"] = [];
models["VGV"] = [];
models["Victory"] = [];
models["Voge"] = [];
models["Volta"] = [];
models["Voyah"] = [];
models["Wuling"] = [];
models["Xiaomi"] = [];
models["Yadea"] = [];
models["Yamaha"] = [];
models["Yutong"] = [];
models["ZAZ"] = [];
models["Zhongtong"] = [];
models["ZIL"] = [];
models["Zonsen"] = [];
models["Zontes"] = [];
models["ZX Auto"] = [];
Object.values(models).forEach(Object.freeze);
Object.freeze(models);
const popular = Object.freeze(['Mercedes-Benz','Toyota','Opel','Hyundai','BMW','Nissan',
  'Lada','Chevrolet','Land Rover','Kia','Changan','Ford']);
const normalize = value=>String(value || '').normalize('NFKC').toLocaleLowerCase('az-AZ').trim();
window.AUSTA_VEHICLE_CATALOG = Object.freeze({
  models, popular,
  brands:Object.freeze(Object.keys(models).sort((a,b)=>a.localeCompare(b,'az'))),
  resolveBrand(value){return Object.keys(models).find(name=>normalize(name)===normalize(value)) || '';}
});

})();
