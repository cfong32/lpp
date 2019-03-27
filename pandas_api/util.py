from concurrent.futures import ThreadPoolExecutor
import asyncio
from functools import wraps
_DEFAULT_POOL = ThreadPoolExecutor()


def threadpool(f, executor=None):
    def aux(coroutine):
        try:
            coroutine.send(None)
        except StopIteration as e:
            return e.value

    @wraps(f)
    def wrap(*args, **kwargs):        
        async def async_thread_f():
            y = (executor or _DEFAULT_POOL).submit(f, *args, **kwargs)
            return y.result()

        async def wait_coroutine():
            return await async_thread_f()
        
        return aux(wait_coroutine())
        
    return wrap    
