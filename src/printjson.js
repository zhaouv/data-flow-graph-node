const { toolbarData } = require('../board/static/toolbarData.js');
const { blockPrototype } = require('../board/static/blockPrototype.js');
const { Runtype } = require('../board/static/Runtype.js');

const config = {
    toolbarData: toolbarData,
    blockPrototype: blockPrototype,
    Runtype: Runtype,
}
console.log(config)
console.log(JSON.stringify({ Runtype }, null, 4))