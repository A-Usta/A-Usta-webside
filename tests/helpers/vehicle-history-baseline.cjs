// Only Phase 2 module references are excluded from historical page equality.
const assert=require('node:assert/strict');
exports.normalize=html=>{
 html=require('./category-route-baseline.cjs').normalize(html);
 html=require('./legacy-archive-baseline.cjs').normalize(html);
 html=require('./g02-contract-baseline.cjs').normalize(html);
 html=require('./auth-dialog-baseline.cjs').normalize(html);
 if(!html.includes('<script src="assets/account/my-vehicles.js"></script>'))return html;
 for(const line of ['<script src="assets/account/maintenance-reminders.js"></script>\n','<script src="assets/account/vehicle-data.js"></script>\n','<script src="assets/account/my-vehicles.js"></script>\n','\n<link rel="stylesheet" href="assets/account/my-vehicles.css">\n']){assert.equal(html.split(line).length,2,'unique Phase 2 reference');html=html.replace(line,'');}
 return html;
};
