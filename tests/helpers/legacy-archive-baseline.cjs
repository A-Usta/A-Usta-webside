const assert=require('node:assert/strict');
const edits=[
  [
    "<script type=\"application/x-austa-legacy\" data-austa-obsolete=\"parse-failed-superseded\">",
    "<script>"
  ],
  [
    "<script id=\"austa-market-v106-js\" type=\"application/x-austa-legacy\" data-austa-obsolete=\"parse-failed-superseded\">",
    "<script id=\"austa-market-v106-js\">"
  ],
  [
    "<script id=\"austa-v47-fix\" type=\"application/x-austa-legacy\" data-austa-obsolete=\"parse-failed-superseded\">",
    "<script id=\"austa-v47-fix\">"
  ],
  [
    "<script id=\"austa-v34-final-js\" type=\"application/x-austa-legacy\" data-austa-obsolete=\"parse-failed-superseded\">",
    "<script id=\"austa-v34-final-js\">"
  ],
  [
    "<script id=\"austa-v16-professional-flow-patch\" type=\"application/x-austa-legacy\" data-austa-obsolete=\"parse-failed-superseded\">",
    "<script id=\"austa-v16-professional-flow-patch\">"
  ]
];
exports.normalize=html=>{for(const[from,to]of edits){if(html.includes(from)){assert.equal(html.split(from).length,2,'unique inert legacy archive marker');html=html.replace(from,()=>to);}}return html;};
