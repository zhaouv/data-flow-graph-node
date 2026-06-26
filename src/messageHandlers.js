const path = require('path')
const { buildReleasePayload } = require('./release.js')
const { getSha1AndBase64 } = require('./getSha1AndBase64.js')
const { recordDefault } = require('./fgModel.js')

/**
 * 创建 webview 消息处理器
 * @returns {Object} recieveMessage 对象（command→handler 映射）
 */
function createMessageHandlers(deps) {
  const { fg, ctx, host, runners } = deps

  return {
    showFile(message) {
      let filename = path.join(ctx.rootPath, message.filename)
      if (!host.fs.existsSync(filename)) host.fs.writeFileSync(filename, '', { encoding: 'utf8' })
      host.openFile(filename)
    },
    showText(message) {
      host.showText(message.text)
    },
    showInfo(message) {
      host.showInfo(message.text)
    },
    requestConfig(message) {
      host.postMessage({ command: 'config', content: fg.config });
    },
    requestNodes(message) {
      host.postMessage({ command: 'nodes', content: fg.nodes });
    },
    saveNodes(message) {
      fg.nodes = message.nodes
      fg.buildLines()
      host.fs.writeFileSync(ctx.nodesPath, JSON.stringify(fg.nodes, null, 4), { encoding: 'utf8' });
    },
    requestRecord(message) {
      host.postMessage({ command: 'record', content: fg.record });
    },
    runNodes(message) {
      fg.nodes = message.nodes
      fg.buildLines()
      host.fs.writeFileSync(ctx.nodesPath, JSON.stringify(fg.nodes, null, 4), { encoding: 'utf8' });
      fg.runNodes(message.indexes, runners.runFiles)
    },
    runChain(message) {
      fg.nodes = message.nodes
      fg.buildLines()
      host.fs.writeFileSync(ctx.nodesPath, JSON.stringify(fg.nodes, null, 4), { encoding: 'utf8' });
      runners.runChain(message.targetIndex, message.clearIpynb, message.restartKernel)
    },
    showAllDiff(message) {
      runners.checkSource(fg.nodes.map((v, i) => i), true, false)
    },
    showAllHistoryDiff(message) {
      let index = message.targetIndex
      let entry = fg.record[index]
      if (!entry || !entry.filename) {
        return
      }
      let content = host.fs.readFileSync(path.join(ctx.rootPath, entry.filename), { encoding: 'utf8' })
      let toShow = []
      const record = ctx.record
      for (let i = record.history.length - 1; i >= 0; i--) {
        let rctx = record.history[i]
        if (rctx && rctx.content && rctx.filename == entry.filename && rctx.content != content) {
          if (!toShow.includes(rctx.content)) toShow.push(rctx.content)
        }
      }
      if (toShow.length) host.showFilesDiff(toShow.map(v => [entry.filename, v]), '与运行历史差异', ctx.rootPath)
    },
    release(message) {
      let url = host.getConfiguration('flowgraph')['release-server-url']
      let author = host.getConfiguration('flowgraph')['release-server-author']
      const fgProject = ctx.fgProject
      let giturl = fgProject.giturl
      let owner = fgProject.owner
      let projectname = fgProject.projectname
      if (!url || !author || !giturl || !owner || !projectname) {
        host.showError('Missing required configuration for release');
        return;
      }

      host.showInfo(
        '选择要执行的行动',
        'push',
        'pull cover',
        'pull merge',
      ).then(action => {
        const rootPath = ctx.rootPath
        const result = host.spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: rootPath });
        var githash = 'hash1'
        if (result.status === 0) {
          githash = result.stdout.toString().trim()
        } else {
          var errorMsg = result.stderr.toString();
          host.showError('调取 git rev-parse HEAD 时发生错误: ' + errorMsg);
          throw new Error(errorMsg);
        }
        host.showInputBox({
          prompt: 'githash',
          value: githash,
        }).then(userInput => {
          if (userInput == null) return;
          if (action === 'push') {
            buildReleasePayload({ rootPath: ctx.rootPath, fgProject, fg, recordDefault, getSha1AndBase64, fsModule: host.fs }, githash).then(async ({ filehashmap, filePayload, projectfile }) => {
              let log = []
              const server = url.replace(/\/$/, '')
              log.push('release push step1 ready. files: ' + Object.keys(filehashmap).length)

              // step2 /checkFile 得到缺失 hash
              let missing = []
              try {
                const allHashes = Object.values(filehashmap)
                const ret = await host.post(server + '/checkFile', allHashes)
                const existed = new Set(ret?.hashes || [])
                missing = allHashes.filter(h => !existed.has(h))
                log.push('step2 checkFile missing: ' + missing.length + ', existed: ' + existed.size)
              } catch (error) {
                throw new Error('checkFile 失败: ' + error.message)
              }

              // step3 /submitFile 上传缺失文件
              if (missing.length) {
                const payload = {}
                missing.forEach(h => {
                  if (filePayload[h]) payload[h] = filePayload[h]
                })
                try {
                  await host.post(server + '/submitFile', payload)
                  log.push('step3 submitFile done: ' + Object.keys(payload).length)
                } catch (error) {
                  throw new Error('submitFile 失败: ' + error.message)
                }
              } else {
                log.push('step3 skip submitFile, all exists')
              }

              // step4 /submitRelease 提交元数据
              try {
                const body = {
                  githash: userInput.trim(),
                  projectname,
                  owner,
                  author,
                  filehashmap,
                  projectfile,
                  time: new Date().toISOString(),
                }
                const ret = await host.post(server + '/submitRelease', body)
                if (ret?.files && ret.files.length) {
                  throw new Error('submitRelease 缺失文件: ' + ret.files.join(','))
                }
                log.push('step4 submitRelease done, count: ' + (ret?.count ?? 0))
                host.showInfo('release push 完成')
              } catch (error) {
                throw new Error('submitRelease 失败: ' + error.message)
              }

              host.showText(log.join('\n'))
            }).catch(err => {
              host.showError('release push failed: ' + err.message)
            })
          } else if (action === 'pull cover') {

          } else if (action === 'pull merge') {

          }
        });
      })
    },
    clearSnapshot(message) {
      message.indexes.forEach(ii => delete fg.record[ii]?.snapshot)
      host.saveAndPushRecord()
    },
    prompt(message) {
      host.showInputBox({
        prompt: message.show,
        value: message.text,
      }).then(userInput => {
        host.postMessage({ command: 'prompt', content: userInput });
      });
    },
    requestCustom(message) {
      host.postMessage({ command: 'custom', content: { operate: [] } });
    },
    default(message) {
      console.log('unknown message:', message)
    }
  }
}

exports.createMessageHandlers = createMessageHandlers;
