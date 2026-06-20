#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>

// Struct to pass wrapper function and arguments to the pthread routine
typedef struct {
    void (*wrapper_fn)(void*);
    void* packed_args;
} ThreadData;

void* VksThreadProc(void* arg) {
    ThreadData* data = (ThreadData*)arg;
    // Call the wrapper function which will unpack arguments, call the real function, and free packed_args
    data->wrapper_fn(data->packed_args);
    // Free the thread data struct itself
    free(data);
    return NULL;
}

void* sys_thread_create(void* wrapper_fn, void* packed_args) {
    ThreadData* data = (ThreadData*)malloc(sizeof(ThreadData));
    data->wrapper_fn = (void (*)(void*))wrapper_fn;
    data->packed_args = packed_args;

    pthread_t* thread = (pthread_t*)malloc(sizeof(pthread_t));
    if (pthread_create(thread, NULL, VksThreadProc, data) != 0) {
        fprintf(stderr, "Fatal Error: sys_thread_create failed to create thread.\n");
        free(thread);
        free(data);
        exit(1);
    }
    return (void*)thread;
}

void sys_thread_join(void* handle) {
    if (handle == NULL) return;
    pthread_t* thread = (pthread_t*)handle;
    pthread_join(*thread, NULL);
    free(thread);
}

void* sys_mutex_create() {
    pthread_mutex_t* mutex = (pthread_mutex_t*)malloc(sizeof(pthread_mutex_t));
    if (pthread_mutex_init(mutex, NULL) != 0) {
        fprintf(stderr, "Fatal Error: sys_mutex_create failed.\n");
        free(mutex);
        exit(1);
    }
    return (void*)mutex;
}

void sys_mutex_lock(void* m) {
    if (m == NULL) return;
    pthread_mutex_lock((pthread_mutex_t*)m);
}

void sys_mutex_unlock(void* m) {
    if (m == NULL) return;
    pthread_mutex_unlock((pthread_mutex_t*)m);
}

void sys_mutex_destroy(void* m) {
    if (m == NULL) return;
    pthread_mutex_t* mutex = (pthread_mutex_t*)m;
    pthread_mutex_destroy(mutex);
    free(mutex);
}
