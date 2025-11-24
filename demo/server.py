# -*- coding: utf-8 -*-
import json
import socket
import threading
import os
import time
import mimetypes
#strtime=time.strftime('%Y%m%d%H%M%S')

import io
import traceback
globals_dict = {}
locals_dict = {}
lastinfo={'id':0,'output':'','error':''}

def execute(code):
    output_buffer = io.StringIO()
    try:
        old_stdout = sys.stdout
        old_stderr = sys.stderr
        sys.stdout = output_buffer
        sys.stderr = output_buffer
        
        exec(code, globals_dict, locals_dict)
        
        lastinfo['error'] = ''

    except Exception as e:
        lastinfo['error'] = traceback.format_exc()
    
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        lastinfo['output'] = output_buffer.getvalue()
        lastinfo['id']+=1
        globals_dict.update(locals_dict)

import sys
if(sys.version_info.major==2):
    import codecs
    open=codecs.open
def get_mimetype(path):
    return mimetypes.guess_type(path)[0] or 'application/octet-stream'
def is_sub(filename):
    try:
        return (os.path.realpath(filename) + os.sep).startswith(os.path.realpath('.') + os.sep)
    except:
        return True

def runnow_threading(func):
    out = threading.Thread(target=func)
    out.start()
    return lambda:out

def mecho(a):
    return
    print(a)

def sysecho(a):
    print(a)
    return
    @runnow_threading
    def fprint(a):
        with open('a.out','a') as fid:
            fid.write(a+'\n')

class g:
    strtemplate='HTTP/1.0 302 Move temporarily\r\nContent-Length: 0\r\nLocation: {urlstr}\r\n\r\n' #{urlstr}
    ip='127.0.0.1'
    port=12082


def initdata():
    pass

def mainget(urlstr):
    callback=lambda:0
    sysecho(''.join([
            'GET '+urlstr+' ',addr[0],':',str(addr[1])
            ]))
    if urlstr[-1]=='/':
        urlstr+='index.html'
    urlsplit=urlstr.split('/')
    urlsplit[0]=os.path.realpath('.')
    path=os.sep.join(urlsplit)
    if not is_sub(path):
        return (403,'403')
    with open(path, 'rb') as f:
        content = f.read()
    header=('HTTP/1.0 200\r\nContent-Type: {type}; charset=utf-8\r\nContent-Length: '.format(type=get_mimetype(path))+str(len(content))+'\r\nAccess-Control-Allow-Origin: *\r\n\r\n')
    return (header,content,callback)

    
def mainpost(urlstr,body):
    callback=lambda:0
    if urlstr == '/':
        sysecho(''.join([
            'POST / ',addr[0],':',str(addr[1]),' ',str(body)
            ]))
    if urlstr == '/exec':
        sysecho(''.join([
            'POST /exec ',addr[0],':',str(addr[1]),' ',str(body)
            ]))
        send_data = {"version": "0.0.10"}
        try:
            data=json.loads(body)
            execute(data['code'])
            if lastinfo['output']:print(lastinfo['output'])
            if lastinfo['error']:print(lastinfo['error'])
            send_data.update(lastinfo)
        except Exception as ex:
            send_data['error']=traceback.format_exc()
        return (200,json.dumps(send_data),callback)

    return (200,'succeed',callback)
    return (403,'no service this url')


def mainparse(header,body):
    callback=lambda:0
    for _tmp in [1]:
        if header[:3]=='GET':
            urlstr=header.split(' ',2)[1]
            host=header.split('Host: ',1)[1].split('\r\n',1)[0]
            mainre = mainget(urlstr)
            if len(mainre)==2:
                header,body=mainre
            else:
                header,body,callback=mainre
            break

        if header[:4]=='POST':
            urlstr=header.split(' ',2)[1]
            mainre =  mainpost(urlstr,body)
            if len(mainre)==2:
                header,body=mainre
            else:
                header,body,callback=mainre
            break

        if header=='':
            header,body= (403,'')
            break

        header,body= (403,'')
    
    if hasattr(body,'encode'):
        body=body.encode('utf-8')
    if type(header)==int:
        codeDict={200:'200 OK',302:'302 Move temporarily',403:'403 Forbidden',404:'404 Not Found'}
        header=('HTTP/1.0 {statu}\r\nContent-Type: text/json; charset=utf-8\r\nContent-Length: '.format(statu=codeDict[header])+str(len(body))+'\r\nAccess-Control-Allow-Origin: *\r\n\r\n')
        #Access-Control-Allow-Origin: null : to test in chrome
    header=header.encode('utf-8')
    return (header,body,callback)

def tcplink(sock, addr):
    mecho('\n\nAccept new connection from %s:%s...' % addr)

    tempbuffer = ['']
    data=''
    header=''
    body=''
    while True:
        # 1k most one time:
        d = sock.recv(512)
        if d:
            d=d.decode('utf-8')
            tempbuffer.append(d)
            if False: # not boolcheck:
                sock.close()
                mecho('Connection from %s:%s closed.' % addr)
                return

            tempend=tempbuffer[-1][-4:]+d
            if '\r\n\r\n' in tempend:
                headend=True
                data=''.join(tempbuffer)
                header, body = data.split('\r\n\r\n', 1)
                if header[:3]=='GET':
                    tempbuffer=[]
                    break
                tempbuffer=[body]
                a=int(header.split('Content-Length:',1)[1].split('\r\n',1)[0])-len(body.encode('utf-8'))#str.len not equal byte.len
                while a>0:
                    tempbuffer.append(sock.recv(min(a,512)).decode('utf-8'))
                    a=a-min(a,512)
                break
        else:
            break
    mecho('recv end\n===')
    body = ''.join(tempbuffer)
    mecho(header)
    mecho('---')
    if len(body)>250:
        mecho(body[:100])
        mecho('...\n')
        mecho(body[-100:])
    else:
        mecho(body)

    callback=lambda:0
    if True: 
        try:
            header,body,callback=mainparse(header,body)
        except Exception as ee:
            initdata()
            raise ee
        mecho('===\nsend start\n')
        sock.send(header)
        sock.send(body)
        mecho('\nsend end\n===')
    sock.close()
    mecho('Connection from %s:%s closed.' % addr)
    callback()

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1]=='test':
        import requests
        payload = {"code": "a=999;import sys;print(f'123{a}321123');print(sys.argv)"}
        r = requests.post("http://127.0.0.1:"+str(g.port)+"/exec", json=payload)
        print(r.status_code, r.json())
        sys.exit(0)

    initdata()
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

    s.bind((g.ip, g.port))

    s.listen(500)
    sysecho('Waiting for connection...')

    
    while True:
        sock, addr = s.accept()
        t = threading.Thread(target=tcplink, args=(sock, addr))
        t.start()
