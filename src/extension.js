const vscode = require("vscode");
const path = require("path");
const fs = require("fs");

const { spawnSync } = require('child_process');

const post = require('./post').postAsync;

function getRandomString() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
const getNonce = getRandomString;

function foldingMod() {
  return vscode.workspace.getConfiguration('flowgraph')['auto-folding']
}

function loadWebviewFiles(root) {
  let main = fs.readFileSync(path.join(root, 'board', 'index.html'), { encoding: 'utf8' })
  main = main.replace(/<[^\n]*"\.\/inject\/[^\n]*>/g, s => {
    let m = /"\.\/inject\/(.*?\.)(.*?)"/.exec(s)
    let content = fs.readFileSync(path.join(root, 'board', 'inject', m[1] + m[2]), { encoding: 'utf8' })
    switch (m[2]) {
      case 'css':
        return '<style>\n' + content + '\n</style>'
      case 'js':
        return '<script type="module" crossorigin nonce="ToBeReplacedByRandomToken">\n' + content + '\n</script>'
      default:
        return s
    }
  })
  main = main.replace(/ToBeReplacedByRandomToken/g, getNonce())
  return main
}
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
  let fgobj = undefined
  let config = undefined
  let nodes = undefined
  let recordobj = undefined

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
    currentEditor = activeTextEditor;
    try {
      fgobj = JSON.parse(activeTextEditor.document.getText())
      nodes = fgobj.nodes
      let configPath = path.join(path.dirname(activeTextEditor.document.fileName), fgobj.config)
      if (!fs.existsSync(configPath)) {
        configPath = fgobj.config
        if (!!fs.existsSync(configPath)) {
          vscode.window.showErrorMessage('配置文件不存在');
          return '';
        }
      }
      config = JSON.parse(fs.readFileSync(configPath, { encoding: 'utf8' }))
      // vscode.window.showInformationMessage('config:'+JSON.stringify(config))
    } catch (error) {
      vscode.window.showErrorMessage('' + error);
    }

    // vscode.window.showInformationMessage(activeTextEditor.document.fileName)
    return activeTextEditor.document.fileName
  }

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

    currentPanel.webview.html = getWebviewContent(currentPanel.webview.asWebviewUri(vscode.Uri.file(path.join(context.extensionPath, 'board/static'))));
    // Handle messages from the webview
    currentPanel.webview.onDidReceiveMessage(
      message => {

        switch (message.command) {
          case 'showFile':
            let filename = path.join(path.dirname(currentEditor.document.fileName), message.filename)
            // vscode.workspace.rootPath+'/'+message.filename
            if (!fs.existsSync(filename)) {
              fs.writeFileSync(filename, '', { encoding: 'utf8' });
            }
            vscode.window.showTextDocument(
              vscode.Uri.file(filename),
              {
                viewColumn: vscode.ViewColumn.One,
                preserveFocus: true
              }
            )
            return;
          case 'showText':
            showText(message.text)
            return;
          // case 'requestState':
          //   currentPanel.webview.postMessage({ command: 'state', content: webviewState });
          //   return;
          case 'requestConfig':
            currentPanel.webview.postMessage({ command: 'config', content: config });
            return;
          case 'requestNodes':
            currentPanel.webview.postMessage({ command: 'nodes', content: nodes });
            return;
          case 'runFiles':
            runFiles(message.files)
            return;
          // case 'saveState':
          //   webviewState = message.state;
          //   return;
          case 'requestCustom':
            currentPanel.webview.postMessage({ command: 'custom', content: { operate: [] } });
            return;

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

  /** @type {vscode.Terminal | undefined} */
  let terminal = undefined;
  function runTerminal(message) {
    if (!terminal || terminal.exitStatus) terminal = vscode.window.createTerminal({
      name: 'Flow Graph',
      cwd: path.dirname(currentEditor.document.fileName)
    });
    terminal.show();
    terminal.sendText(message);
  }

  // 这个函数要async化
  async function runFiles(files) {
    let display = []
    for (const file of files) {

      let { rid, rconfig, filename, submitTick } = file
      display.push(JSON.stringify(file, null, 4))
      display.push(new Date().getTime() + ': running...')
      await showText(display.join('\n\n'))

      let fullname = path.join(path.dirname(currentEditor.document.fileName), filename)
      let content = fs.readFileSync(fullname, { encoding: 'utf8' })

      function buildPayload(text) {
        let func = new Function('filename', 'fullname', 'content', text)
        return func(filename, fullname, content)
      }

      if (rconfig.type === 'vscode-terminal') {
        let message = rconfig.message.replaceAll('__filename__', filename).replaceAll('__fullname__', fullname).replaceAll('__content__', content)
        runTerminal(message)
        continue
      }
      if (rconfig.type === 'node-terminal') {
        let payload = buildPayload(rconfig.payload)
        const result = spawnSync(payload[0], payload.slice(1), { encoding: 'utf8', cwd: path.dirname(currentEditor.document.fileName) });
        // display.push(JSON.stringify(result))
        if (result.status === 0) {
          display.push(new Date().getTime() + ': ' + result.stdout.toString());
        } else {
          throw new Error(result.stderr.toString());
        }
        continue
      }
      if (rconfig.type === 'node-post') {
        let payload = buildPayload(rconfig.payload)
        let ret = await post(
          rconfig.url,
          payload,
        );
        display.push(new Date().getTime() + ': ' + new Function('ret', rconfig.show)(ret))
        continue
      }
      if (rconfig.type === 'concat') {
        let targetPath = path.join(path.dirname(currentEditor.document.fileName), rconfig.filename)
        fs.writeFileSync(targetPath, content+'\n', { encoding: 'utf8', flag: 'a' })
        display.push(new Date().getTime() + ': write to ' + rconfig.filename);
        continue
      }
    }
    await showText(display.join('\n\n'))
  }

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

function getWebviewContent(cdnpath) {
  return webviewContent.replace('./static', cdnpath)
}