const assert=require('node:assert/strict');
const current='openCategory(\n                "cars"\n            );',previous='openCategory(\n                "sale"\n            );';
exports.normalize=html=>{if(!html.includes(current))return html;assert.equal(html.split(current).length,2,'unreviewed historical baseline: duplicate canonical route');return html.replace(current,previous);};
