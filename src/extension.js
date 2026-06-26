const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

const { spawnSync } = require('child_process');

const post = require('./post').postAsync;

const { defaultConfig, templateConfig } = require('./fgConfig.js');
const { loadWebviewFiles, getWebviewContent } = require('./webviewLoader.js');
const { recordDefault, createFgModel } = require('./fgModel.js');
const { createDiffUtils } = require('./diffUtils.js');
const { createRunners } = require('./runners.js');
const { createMessageHandlers } = require('./messageHandlers.js');

const webviewContent = loadWebviewFiles(path.join(__dirname, '..'));

/** @param {vscode.ExtensionContext} context */
function activate(context) {

  /** @type {vscode.WebviewPanel | undefined} */
  let currentPanel = undefined;

  /** @type {vscode.TextEditor | undefined} */
  let currentEditor = undefined;

  /** @type {vscode.TextDocument | undefined} */
  let showTextPanel = undefined
  // let webviewState = {}
  // config 不需要通过插件修改
  let ctx = { rootPath: undefined, nodesPath: undefined, recordPath: undefined, fgProject: undefined, record: undefined }

  let fg = createFgModel()

  const { showFilesDiff } = createDiffUtils({
    Uri: vscode.Uri,
    ViewColumn: vscode.ViewColumn,
    workspace: vscode.workspace,
    commands: vscode.commands,
  })

  let recieveMessage = {}

  function showText(text) {
    if (showTextPanel == undefined || showTextPanel.isClosed) {
      return vscode.workspace.openTextDocument({
        content: text,
        encoding: 'utf8', language: 'log'
      }).then(document => {
        showTextPanel = document
        vscode.window.showTextDocument(
          showTextPanel,
          vscode.ViewColumn.One,
          true
        )
      })
    } else {
      return vscode.window.showTextDocument(
        showTextPanel,
        vscode.ViewColumn.One,
        true
      ).then((editor) => editor.edit(edit => {
        edit.replace(new vscode.Range(0, 0, 999999, 0), text);
      }))
    }
  }

  function loadFlowGraphAndConfig() {
    let activeTextEditor = vscode.window.activeTextEditor;
    if (!activeTextEditor || activeTextEditor.document.isClosed || !activeTextEditor.document.fileName.endsWith('.flowgraph.json')) {
      vscode.window.showErrorMessage('No active .flowgraph.json file');
      return '';
    }
    ctx.rootPath = path.dirname(activeTextEditor.document.fileName)
    currentEditor = activeTextEditor;
    try {
      ctx.fgProject = JSON.parse(activeTextEditor.document.getText())

      let configPath = path.join(ctx.rootPath, ctx.fgProject.config)
      if (!fs.existsSync(configPath)) {
        configPath = ctx.fgProject.config
        if (!!fs.existsSync(configPath)) {
          vscode.window.showErrorMessage('配置文件不存在');
          return '';
        }
      }
      fg.rawConfig = JSON.parse(fs.readFileSync(configPath, { encoding: 'utf8' }))
      fg.config = Object.assign({}, defaultConfig, fg.rawConfig)

      ctx.nodesPath = path.join(ctx.rootPath, ctx.fgProject.nodes)
      if (!fs.existsSync(ctx.nodesPath)) {
        vscode.window.showErrorMessage('节点文件不存在');
        return '';
      }
      fg.nodes = JSON.parse(fs.readFileSync(ctx.nodesPath, { encoding: 'utf8' }))

      ctx.recordPath = path.join(ctx.rootPath, ctx.fgProject.record)
      if (!fs.existsSync(ctx.recordPath)) {
        fs.writeFileSync(ctx.recordPath, recordDefault, { encoding: 'utf8' });
        ctx.record = JSON.parse(recordDefault)
      } else {
        ctx.record = JSON.parse(fs.readFileSync(ctx.recordPath, { encoding: 'utf8' }))
      }
      fg.record = ctx.record.current

      fg.config?.custom?.extension?.forEach(operate => {
        if (operate.type === 'script') {
          let func = new Function('fg', 'recieveMessage', operate.function)
          func(fg, recieveMessage)
        }
      })

      // vscode.window.showInformationMessage('config:'+JSON.stringify(fg.config))
    } catch (error) {
      vscode.window.showErrorMessage(error.stack);
    }

    // vscode.window.showInformationMessage(activeTextEditor.document.fileName)
    return activeTextEditor.document.fileName
  }

  /** @type {vscode.Terminal | undefined} */
  let terminal = undefined;
  function runTerminal(message) {
    if (!terminal || terminal.exitStatus) terminal = vscode.window.createTerminal({
      name: 'Flow Graph',
      cwd: ctx.rootPath
    });
    terminal.show();
    terminal.sendText(message);
  }

  function saveAndPushRecord() {
    currentPanel.webview.postMessage({ command: 'record', content: fg.record });
    fs.writeFileSync(ctx.recordPath, JSON.stringify(ctx.record, null, 4), { encoding: 'utf8' });
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  async function runJupyter(fullname, rid, code, sourcename = '') {
    await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(fullname), 'jupyter-notebook')
    await delay(200)
    if (fg.mode.clearIpynb) {
      await vscode.commands.executeCommand('jupyter.notebookeditor.removeallcells')
      fg.mode.clearIpynb = undefined
    }
    if (fg.mode.restartKernel) {
      await vscode.commands.executeCommand('jupyter.restartkernel') // 这个指令微软没做成结束才返回
      await delay(100) // 只能强行填个延时来等待结束...
      // 以及要配合 "jupyter.askForKernelRestart": false
      fg.mode.restartKernel = undefined
    }
    await vscode.commands.executeCommand('notebook.focusBottom')
    await vscode.commands.executeCommand('notebook.cell.insertCodeCellBelow')
    await delay(400)
    const nbeditor = vscode.window.activeNotebookEditor;
    let editor = vscode.window.activeTextEditor;
    await editor.edit(edit => {
      edit.insert(editor.selection.active, '#rid:' + rid + '\n__fg_file__ = r"' + sourcename + '"\n' + code);
    })
    await delay(200)
    await vscode.commands.executeCommand('notebook.cell.execute')
    let robj = nbeditor.notebook.getCells().slice(-1)[0]
    robj = { outputs: robj.outputs, executionSummary: robj.executionSummary }
    // vscode.window.showInformationMessage(JSON.stringify(robj))
    // console.log(robj)
    let ret = { output: [], error: [] }
    robj.outputs.forEach(v => {
      try {
        if (v.metadata.outputType == 'stream') {
          ret.output.push(v.items.map(v => v.data.toString()).join(''))
        } else if (v.metadata.outputType == 'execute_result') {
          ret.output.push(v.items.map(v => v.data.toString()).join(''))
        } else if (v.metadata.outputType == 'error') {
          ret.error.push(v.metadata.originalError.traceback.join('\n').replace(/\u001b\[[0-9;]*m/g, ''))
        }
      } catch (error) {
      }
    })
    ret.output = ret.output.join('\n')
    ret.error = ret.error.join('\n')
    return ret
  }

  const host = {
    fs,
    spawnSync,
    post,
    postMessage: (msg) => currentPanel.webview.postMessage(msg),
    showText,
    showInfo: (t, ...items) => vscode.window.showInformationMessage(t, ...items),
    showError: (t, ...items) => vscode.window.showErrorMessage(t, ...items),
    showInputBox: (opts) => vscode.window.showInputBox(opts),
    openFile: (fullpath) => vscode.window.showTextDocument(vscode.Uri.file(fullpath), { viewColumn: vscode.ViewColumn.One, preserveFocus: true }),
    getConfiguration: (section) => vscode.workspace.getConfiguration(section),
    showFilesDiff,
    saveAndPushRecord,
    runJupyter,
    runTerminal,
  }

  const runners = createRunners({ fg, ctx, host })

  Object.assign(recieveMessage, createMessageHandlers({ fg, ctx, host, runners }))

  function createNewPanel() {
    if (!loadFlowGraphAndConfig()) return;
    // Create and show panel
    currentPanel = vscode.window.createWebviewPanel(
      'flowgraph',
      'Flow Graph',
      vscode.ViewColumn.Two,
      {
        // Enable scripts in the webview
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(context.extensionPath, 'board'))]
      }
    );

    currentPanel.webview.html = getWebviewContent(webviewContent, currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'board/static'))));
    // Handle messages from the webview
    currentPanel.webview.onDidReceiveMessage(
      message => {

        if (message.command in recieveMessage) {
          recieveMessage[message.command](message)
        } else {
          recieveMessage.default(message)
        }
      },
      undefined,
      context.subscriptions
    );

    currentPanel.onDidDispose(
      () => {
        currentPanel = undefined;
      },
      undefined,
      context.subscriptions
    );
  }

  context.subscriptions.push(
    vscode.commands.registerCommand('flowgraph.initProject', async () => {

      async function initProject() {
        let defaultpath = path.join(vscode.workspace.rootPath, 'a1').toString()
        let userInput = await vscode.window.showInputBox({
          prompt: 'input path',
          // ignoreFocusOut: true, // 设为true可防止点击编辑器其他区域时输入框关闭
          value: defaultpath, // 可设置默认值
          valueSelection: [defaultpath.length - 2, defaultpath.length] // 可预设选中部分默认文本，例如选中"default"
        })
        if (userInput == null) return
        let dirname = path.dirname(userInput)
        let basename = path.basename(userInput)
        let prefix = path.join(dirname, basename)
        fs.writeFileSync(prefix + '.flowgraph.json', `{"config": "${basename}.config.json","nodes": "${basename}.nodes.json","record": "${basename}.record.json","giturl": "http://xx/xx.git","project": "path/to/${basename}.flowgraph.json","owner": "user0","projectname": "${basename}"}`, { encoding: 'utf8' });
        fs.writeFileSync(prefix + '.config.json', JSON.stringify(templateConfig, null, 4), { encoding: 'utf8' });
        fs.writeFileSync(prefix + '.nodes.json', JSON.stringify([{
          "text": "new",
          "filename": "a.py",
          "_pos": {
            "left": 0,
            "top": 100,
            "width": 100,
            "height": 100
          }
        }], null, 4), { encoding: 'utf8' });
        await vscode.window.showTextDocument(
          vscode.Uri.file(prefix + '.flowgraph.json'),
          {
            viewColumn: vscode.ViewColumn.One,
            preserveFocus: true
          }
        )
        await vscode.commands.executeCommand('flowgraph.editFlowGraph')
      }

      initProject()

    })

  );

  context.subscriptions.push(
    vscode.commands.registerCommand('flowgraph.editFlowGraph', () => {
      if (currentPanel) {
        currentPanel.reveal();
      } else {
        createNewPanel()
      }
    })
  );

}
exports.activate = activate;