const BaseConfig = {
    "Snapshot": {
        "noCheckSource": false, // 是否检查源代码和record的源代码的一致性
        "noShowCheckSourceDiff": false, // 是否显示检查源代码时, 源代码间的差异
        "dirname": ".",
    }
}

// export default BaseConfig
if (typeof exports === 'undefined') { globalThis.exports = globalThis }
exports.BaseConfig = BaseConfig;