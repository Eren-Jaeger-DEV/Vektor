#include <windows.h>
#include <stdio.h>
#include <stdlib.h>

// Struct to pass wrapper function and arguments to the Win32 thread routine
typedef struct {
    void (*wrapper_fn)(void*);
    void* packed_args;
} ThreadData;

DWORD WINAPI VksThreadProc(LPVOID lpParam) {
    ThreadData* data = (ThreadData*)lpParam;
    // Call the wrapper function which will unpack arguments, call the real function, and free packed_args
    data->wrapper_fn(data->packed_args);
    // Free the thread data struct itself
    free(data);
    return 0;
}

void* sys_thread_create(void* wrapper_fn, void* packed_args) {
    ThreadData* data = (ThreadData*)malloc(sizeof(ThreadData));
    data->wrapper_fn = (void (*)(void*))wrapper_fn;
    data->packed_args = packed_args;

    HANDLE hThread = CreateThread(
        NULL,                   // default security attributes
        0,                      // use default stack size  
        VksThreadProc,          // thread function name
        data,                   // argument to thread function 
        0,                      // use default creation flags 
        NULL);                  // returns the thread identifier 

    if (hThread == NULL) {
        fprintf(stderr, "Fatal Error: sys_thread_create failed to create thread.\n");
        exit(1);
    }
    return (void*)hThread;
}

void sys_thread_join(void* handle) {
    if (handle == NULL) return;
    HANDLE hThread = (HANDLE)handle;
    WaitForSingleObject(hThread, INFINITE);
    CloseHandle(hThread);
}

void* sys_mutex_create() {
    CRITICAL_SECTION* cs = (CRITICAL_SECTION*)malloc(sizeof(CRITICAL_SECTION));
    InitializeCriticalSection(cs);
    return (void*)cs;
}

void sys_mutex_lock(void* m) {
    if (m == NULL) return;
    EnterCriticalSection((CRITICAL_SECTION*)m);
}

void sys_mutex_unlock(void* m) {
    if (m == NULL) return;
    LeaveCriticalSection((CRITICAL_SECTION*)m);
}

void sys_mutex_destroy(void* m) {
    if (m == NULL) return;
    CRITICAL_SECTION* cs = (CRITICAL_SECTION*)m;
    DeleteCriticalSection(cs);
    free(cs);
}
