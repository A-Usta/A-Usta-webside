const assert=require('node:assert/strict');
const from="// The source-aware module owns this API. Legacy wrappers above delegate to it;\n// replacing it here removes install/openLink and makes open recursively call itself.",to="window.AUSTA_LISTING_DETAIL={\n  open:openListingDetail,\n  close:closeListingDetail,\n  bind:bindAll\n};";
exports.normalize=html=>{if(!html.includes(from))return html;assert.equal(html.split(from).length,2,'unique G02 canonical API ownership hunk');return html.replace(from,()=>to);};
