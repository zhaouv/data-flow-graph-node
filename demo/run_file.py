from IPython.utils.io import Tee
from io import StringIO
from IPython.core.interactiveshell import InteractiveShell
shell = InteractiveShell.instance()
if shell is None:
    shell = InteractiveShell()

def runfile(file):
    try:
        success=True
        error_in_exec=None
        stdout=Tee(StringIO(), "w", channel="stdout")
        shell.safe_execfile(file,shell.user_ns,shell.user_ns,raise_exceptions=True)
    except Exception as e:
        shell.showtraceback(tb_offset=2)
        error_in_exec=e
        success=False
    finally:
        result=stdout.file.getvalue()
        stdout.close()
    return result,success,error_in_exec

if __name__ == '__main__':
    success=True
    if success:result,success,error_in_exec=runfile('a.py')
    if success:result,success,error_in_exec=runfile('b.py')
    if success:result,success,error_in_exec=runfile('e.py')

    print("=== 打印最后一个运行的结果 ===")
    print("=== 捕获的输出 ===")
    print(result)
    print("=== --------- ===")
    print("执行成功:", success)
    print("错误信息:", error_in_exec)

    # 此文件通过 ipython 的 %run run_file.py 运行的话, 是能拿到 aaa 这个变量的