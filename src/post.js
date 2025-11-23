'use strict';
Object.defineProperty(exports, "__esModule", { value: true });
const http = require('http');
const https = require('https');

/**
 * 发送 POST 请求，自动识别 HTTP/HTTPS
 * @param {string} url - 请求的URL，例如 'http://example.com/api' 或 'https://example.com/api'
 * @param {object} jsondata - 要发送的JSON数据对象
 * @param {function} callback - 回调函数，格式 callback(data, err)
 * @param {object} options - 额外选项
 */
function post(url, jsondata, callback, options = {}) {
  // 解析URL
  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (err) {
    callback(null, new Error(`无效的URL: ${url}`));
    return;
  }
  
  // 根据协议选择相应的模块
  const isHttps = urlObj.protocol === 'https:';
  const requestModule = isHttps ? https : http;
  
  // 准备请求数据
  const postData = JSON.stringify(jsondata);
  
  // 配置请求选项
  const defaultPort = isHttps ? 443 : 80;
  const requestOptions = {
    hostname: urlObj.hostname,
    port: urlObj.port || defaultPort,
    path: urlObj.pathname + urlObj.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      ...options.headers // 允许自定义头部
    },
    timeout: options.timeout || 0, // 默认永不超时
    ...options.httpsOptions // HTTPS特有选项，如rejectUnauthorized等
  };
  // console.log(requestOptions)
  
  // 创建请求
  const req = requestModule.request(requestOptions, (res) => {
    let responseData = '';
    const statusCode = res.statusCode;
    
    // 接收数据片段
    res.on('data', (chunk) => {
      responseData += chunk;
    });
    
    // 响应接收完成
    res.on('end', () => {
      // 处理重定向
      if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
        if (options.followRedirect !== false) {
          // 跟随重定向
          post(res.headers.location, jsondata, callback, {
            ...options,
            followRedirect: options.followRedirect ? options.followRedirect - 1 : 4 // 限制重定向次数
          });
          return;
        }
      }
      
      if (statusCode >= 200 && statusCode < 300) {
        // 成功响应
        try {
          const parsedData = responseData ? JSON.parse(responseData) : null;
          callback(parsedData, null);
        } catch (parseError) {
          // 如果解析失败，返回原始数据
          callback(responseData, null);
        }
      } else {
        // 错误响应
        let errorMessage = `HTTP ${statusCode}`;
        if (responseData) {
          try {
            const errorObj = JSON.parse(responseData);
            errorMessage = errorObj.message || errorMessage;
          } catch (e) {
            errorMessage = responseData.length > 100 ? 
              responseData.substring(0, 100) + '...' : responseData;
          }
        }
        callback(null, new Error(errorMessage));
      }
    });
  });
  
  // 处理请求错误
  req.on('error', (err) => {
    callback(null, err);
  });
  
  // 处理超时
  req.on('timeout', () => {
    req.destroy();
    callback(null, new Error(`请求超时 (${requestOptions.timeout}ms)`));
  });
  
  // 发送数据
  req.write(postData);
  req.end();
}
exports.post = post;

function postAsync(url, jsondata, options = {}) {
  return new Promise((resolve, reject) => {
    post(url, jsondata, (data, err) => {
      if (err) {
        reject(err); // 如果有错误，reject
      } else {
        resolve(data); // 如果成功，resolve
      }
    }, options);
  });
}

exports.postAsync = postAsync;