import { toolbarData, cardData } from './uidata.js'


// 工具栏鼠标滚轮水平滚动
const toolbar = document.querySelector('.toolbar');
toolbar.addEventListener('wheel', function (e) {
    // 阻止默认的垂直滚动
    e.preventDefault();
    // 将垂直滚动量转换为水平滚动
    this.scrollLeft += e.deltaY;
});
// 添加工具栏按钮点击事件
toolbar.addEventListener('click', function (e) {
    // console.log(e)
    if (e.target.localName === 'button') {
        // 创建点击反馈效果
        e.target.style.transform = 'scale(0.95)';
        setTimeout(() => {
            e.target.style.transform = '';
        }, 150);

        // 在实际应用中，这里可以添加按钮的具体功能
        console.log(`点击了按钮: ${e.target.textContent}`);
        let target = e.target

        let index = Array.prototype.indexOf.call(target.parentNode.children, target)
        let tindex = Array.prototype.indexOf.call(target.parentNode.parentNode.children, target.parentNode)
        let func = new Function('btn', 'tindex', 'index', fg.tools[tindex][index].click)
        func(target, tindex, index)
    }
});

const contentElement = document.querySelector('.content');
contentElement.addEventListener('click', function (e) {
    // console.log(e)
    let directClick = true
    let directTarget = e.target
    let target = e.target
    while (target.localName !== 'div') {
        directClick = false
        target = target.parentNode
    }
    if (target.classList.contains('card')) {
        let index = Array.prototype.indexOf.call(target.parentNode.children, target)
        fg.setAsCurrentCard(index)

        // 创建点击反馈效果
        if (directClick) {
            target.style.transform = 'scale(0.95)';
            setTimeout(() => {
                target.style.transform = '';
            }, 150);
        }

        // 在实际应用中，这里可以添加按钮的具体功能
        console.log(`点击了卡片: ${target.textContent}`);
    }
});

const fg = {
    tools: [[], []],
    nodes: [],
    currentCard: { index: -1, card: null, node: null, tick: 0 },
    moveSetting: { up: -1, down: 1 },
    addToolbar(tools) {
        [0, 1].forEach(ii => {
            tools[ii].forEach((bi, index) => {
                const btn = document.createElement('button');
                btn.innerHTML = bi.text.replaceAll(' ', '&nbsp;')
                btn.className = 'toolbar-btn' + (bi.class ? ' ' + bi.class : '')
                // btn.setAttribute('index', index+fg.tools[ii].length)
                if (bi.title) btn.setAttribute('title', bi.title)
                toolbar.children[ii].appendChild(btn);
            })
            fg.tools[ii].push(...tools[ii])
        });
    },
    setCardPos(card, pos) {
        if (card == null) return
        for (let k in pos) {
            if (['height', 'width'].includes(k)) {
                if (pos[k] <= 0) pos[k] = 100
                card.style[k] = pos[k] - 20 + 'px'
            } else if (['left'].includes(k)) {
                if (pos[k] <= 0) pos[k] = 0
                card.style[k] = pos[k] + 200 + 'px'
            } else { // top
                if (pos[k] <= 0) pos[k] = 0
                card.style[k] = pos[k] + 'px'
            }
        }
    },
    addContent(nodes) {

        nodes.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'card';

            card.setAttribute('id', item.id)
            // card.setAttribute('index', index+fg.nodes.length)

            const text = document.createElement('p');
            text.innerText = item.text + '\n' + item.file;

            fg.setCardPos(card, item.pos)

            card.appendChild(text);

            contentElement.appendChild(card);

        });
        fg.nodes.push(...nodes)
        fg.setAsCurrentCard(fg.nodes.length - 1)
    },
    setAsCurrentCard(index) {
        fg.currentCard.index = index
        fg.currentCard.card = contentElement.children[index]
        fg.currentCard.node = fg.nodes[fg.currentCard.index]
        fg.currentCard.tick = new Date().getTime()
    },
    resetCurrentCardPos() {
        fg.setCardPos(fg.currentCard.card, fg.currentCard.node.pos)
    },
    move(direct){
        switch (direct) {
            case 'up':
                fg.currentCard.node.pos.top-=100;fg.resetCurrentCardPos()
                break;
            case 'down':
                fg.currentCard.node.pos.top+=100;fg.resetCurrentCardPos()
                break;
            case 'left':
                fg.currentCard.node.pos.left-=100;fg.resetCurrentCardPos()
                break;
            case 'right':
                fg.currentCard.node.pos.left+=100;fg.resetCurrentCardPos()
                break;
        }
    },
    scale(rate) {
        let cr = /\((.*)\)/.exec(contentElement.style.transform)[1];
        contentElement.style.transform = `scale(${rate * (parseFloat(cr) || 1)})`
    },
    toggleButton(btn) {
        btn.classList.contains("primary") ? btn.classList.remove("primary") : btn.classList.add("primary")
    },
};

globalThis.fg = fg;

fg.addToolbar(toolbarData)
fg.addContent(cardData)

// Array.from({length:2000}).map(v=>{
//     let data = JSON.parse(JSON.stringify(cardData))
//     fg.addContent(data.map(v=>{
//         v.pos.left+=100*~~(20*Math.random())
//         v.pos.top+=100*~~(20*Math.random())
//         return v
//     }))
// })


