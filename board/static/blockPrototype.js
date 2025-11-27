const blockPrototype =
{
    blocks: {
        NormalString: {
            type: "string",
            value: "NormalString_default"
        },
        Snapshot: {
            type: "snapshot",
            value: null
        },
        MultiString: {
            type: "multi_string",
            value: "MultiString_default"
        },
        Runfile: {
            type: "edit_able_droplist",
            options: [
                ["", ""],
                ["1", "1"],
            ],
            value: ""
        },
        Runtype: {
            type: "edit_able_droplist",
            options: [
                ["", ""],
                ["1", "1"],
                ["2", "2"],
                ["3", "3"],
            ],
            value: ""
        },
        runfile: {
            type: 'runfile',
            message: '%1\n%2\n%3%r%4',
            args: [
                { name: 'text', type: 'MultiString', value: 'comment' },
                { name: 'filename', type: 'Runfile', value: 'a.py' },
                { name: 'runtype', type: 'Runtype', value: '', omitted: true },
                { name: 'snapshot', type: 'Snapshot', value: null, omitted: true },
            ],
            typename: null,
            checkType: 'args',
            linkTo: [
                { name: 'next', position: 'down', range: 'runfile' }
            ],
            linkFrom: [
                { name: 'previous', position: 'up', range: 'runfile' }
            ],
        }
    }
}

// export default blockPrototype
if (typeof exports === 'undefined') { globalThis.exports = globalThis }
exports.blockPrototype = blockPrototype;