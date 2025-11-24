export const blockPrototype =
{
    blocks: {
        NormalString: {
            type: "input",
            value: "NormalString_default"
        },
        Snapshot: {
            type: "snapshot",
            value: null
        },
        MultiString: {
            type: "multi",
            value: "MultiString_default"
        },
        Runfile: {
            type: "editabledroplist",
            options: [
                ["", ""],
                ["1", "1"],
            ],
            value: ""
        },
        Runtype: {
            type: "editabledroplist",
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
            message: '%1\n%2\n%3 %4',
            run: '%1\n%2\n%3',
            args: [
                { name: 'comment', type: 'MultiString', value: 'comment' },
                { name: 'filename', type: 'Runfile', value: 'a.py' },
                { name: 'snapshot', type: 'Snapshot', value: null },
                { name: 'runtype', type: 'Runtype', value: '' },
            ],
            typename: null,
            checkType: 'args',
            linkTo: [
                { name: 'next', position: 'down', range: 'runfile'}
            ],
            linkFrom: [
                { name: 'previous', position: 'up', range: 'runfile' }
            ],
        }
    }
}