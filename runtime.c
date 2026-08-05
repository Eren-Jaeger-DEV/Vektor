#if defined(_WIN32)
#include <winsock2.h>
#include <ws2tcpip.h>
#else
#include <sys/socket.h>
#include <netdb.h>
#include <unistd.h>
#include <arpa/inet.h>
#define SOCKET int
#define INVALID_SOCKET -1
#define SOCKET_ERROR -1
#define closesocket close
#endif
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

void vk_print_i32(int x) { 
    printf("%d\n", x); 
    fflush(stdout);
}

void vk_print_f64(double x) { 
    printf("%f\n", x); 
    fflush(stdout);
}

void vk_print_str(char* s, long len) { 
    fwrite(s, 1, len, stdout); 
    printf("\n"); 
    fflush(stdout);
}

void vk_print_bool(int x) { 
    if (x) printf("true\n"); 
    else printf("false\n"); 
    fflush(stdout);
}

double vk_sqrt(double x) { 
    // basic sqrt placeholder if math.h is annoying
    double z = 1.0;
    for(int i=0; i<10; i++) {
        z -= (z*z - x) / (2*z);
    }
    return z;
}

// ── Call Stack ────────────────────────────────────────────────
#define MAX_CALL_STACK 256
const char* vk_call_stack[MAX_CALL_STACK];
int vk_stack_ptr = 0;

void vk_push_frame(const char* name) {
    if (vk_stack_ptr < MAX_CALL_STACK) {
        vk_call_stack[vk_stack_ptr++] = name;
    }
}

void vk_pop_frame() {
    if (vk_stack_ptr > 0) {
        vk_stack_ptr--;
    }
}

void vks_panic(const char* msg) {
    fprintf(stderr, "\n  ✗ Native Runtime Panic: %s\nStack trace:\n", msg);
    for (int i = vk_stack_ptr - 1; i >= 0; i--) {
        fprintf(stderr, "  at %s\n", vk_call_stack[i]);
    }
    fprintf(stderr, "\n");
    exit(1);
}

// ── Concurrency Wrappers ──────────────────────────────────────
#if defined(_WIN32)
#include "thread_win.c"
#else
#include "thread_posix.c"
#endif

void* vks_spawn(void* wrapper_fn, void* packed_args) {
    return sys_thread_create(wrapper_fn, packed_args);
}

void vks_thread_join(void* handle) {
    sys_thread_join(handle);
}

void* vks_mutex_create() {
    return sys_mutex_create();
}

void vks_mutex_lock(void* m) {
    sys_mutex_lock(m);
}

void vks_mutex_unlock(void* m) {
    sys_mutex_unlock(m);
}

void vks_mutex_destroy(void* m) {
    sys_mutex_destroy(m);
}

// ── Strings and Arrays ────────────────────────────────────────
typedef struct {
    char* data;
    long long len;
} vks_string;

typedef struct {
    int length;
    int capacity;
    vks_string* data;
} vks_array_str;

// ── Native Entry Point ────────────────────────────────────────
extern void vks_main();

int vks_argc = 0;
char** vks_argv = NULL;

int main(int argc, char** argv) {
    printf("BOOTING VKS NATIVE...\n"); fflush(stdout);
    vks_argc = argc;
    vks_argv = argv;
    
    // Winsock Lifecycle (Windows only)
#if defined(_WIN32)
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        fprintf(stderr, "WSAStartup failed.\n");
        return 1;
    }
#endif
    
    vks_main();
    
#if defined(_WIN32)
    WSACleanup();
#endif
    return 0;
}

// ── Standard Library String & Env ─────────────────────────────
vks_array_str vks_get_args() {
    vks_array_str arr;
    arr.length = vks_argc;
    arr.capacity = vks_argc;
    arr.data = (vks_string*)malloc(sizeof(vks_string) * vks_argc);
    for (int i = 0; i < vks_argc; i++) {
        long long len = strlen(vks_argv[i]);
        char* buf = (char*)malloc(len);
        memcpy(buf, vks_argv[i], len);
        arr.data[i].data = buf;
        arr.data[i].len = len;
    }
    return arr;
}

int32_t vks_system(vks_string cmd) {
    char* cmd_cstr = (char*)malloc(cmd.len + 1);
    memcpy(cmd_cstr, cmd.data, cmd.len);
    cmd_cstr[cmd.len] = '\0';
    int result = system(cmd_cstr);
    free(cmd_cstr);
    return result;
}

char* vks_get_env(vks_string name) {
    char* name_cstr = (char*)malloc(name.len + 1);
    memcpy(name_cstr, name.data, name.len);
    name_cstr[name.len] = '\0';
    char* val = getenv(name_cstr);
    free(name_cstr);
    if (val == NULL) return NULL;
    
    vks_string* ret = (vks_string*)malloc(sizeof(vks_string));
    long long len = strlen(val);
    char* buf = (char*)malloc(len);
    memcpy(buf, val, len);
    ret->data = buf;
    ret->len = len;
    return (char*)ret;
}

vks_array_str* vks_str_split(char* s_data, long long s_len, char* sep_data, long long sep_len) {
    vks_array_str* arr = (vks_array_str*)malloc(sizeof(vks_array_str));
    arr->capacity = 8;
    arr->length = 0;
    arr->data = (vks_string*)malloc(sizeof(vks_string) * arr->capacity);
    
    if (s_len == 0) {
        return arr; // returns empty array
    }
    
    if (sep_len == 0) {
        for (long long i = 0; i < s_len; i++) {
            if (arr->length == arr->capacity) {
                arr->capacity *= 2;
                arr->data = (vks_string*)realloc(arr->data, sizeof(vks_string) * arr->capacity);
            }
            char* buf = (char*)malloc(1);
            buf[0] = s_data[i];
            arr->data[i].data = buf;
            arr->data[i].len = 1;
            arr->length++;
        }
        return arr;
    }
    
    long long last = 0;
    for (long long i = 0; i <= s_len - sep_len; ) {
        int match = 1;
        for (long long j = 0; j < sep_len; j++) {
            if (s_data[i+j] != sep_data[j]) {
                match = 0; break;
            }
        }
        if (match) {
            if (arr->length == arr->capacity) {
                arr->capacity *= 2;
                arr->data = (vks_string*)realloc(arr->data, sizeof(vks_string) * arr->capacity);
            }
            long long part_len = i - last;
            char* buf = NULL;
            if (part_len > 0) {
                buf = (char*)malloc(part_len);
                memcpy(buf, s_data + last, part_len);
            }
            arr->data[arr->length].data = buf;
            arr->data[arr->length].len = part_len;
            arr->length++;
            
            i += sep_len;
            last = i;
        } else {
            i++;
        }
    }
    
    if (arr->length == arr->capacity) {
        arr->capacity++;
        arr->data = (vks_string*)realloc(arr->data, sizeof(vks_string) * arr->capacity);
    }
    long long rem_len = s_len - last;
    char* buf2 = NULL;
    if (rem_len > 0) {
        buf2 = (char*)malloc(rem_len);
        memcpy(buf2, s_data + last, rem_len);
    }
    arr->data[arr->length].data = buf2;
    arr->data[arr->length].len = rem_len;
    arr->length++;
    
    return arr;
}

vks_string vks_str_replace(vks_string s, vks_string find, vks_string rep) {
    if (find.len == 0 || s.len == 0) return s;
    
    long long count = 0;
    for (long long i = 0; i <= s.len - find.len; i++) {
        int match = 1;
        for (long long j = 0; j < find.len; j++) {
            if (s.data[i+j] != find.data[j]) {
                match = 0; break;
            }
        }
        if (match) {
            count++;
            i += find.len - 1;
        }
    }
    
    if (count == 0) return s;
    
    long long new_len = s.len + count * (rep.len - find.len);
    char* new_data = (char*)malloc(new_len);
    
    long long write_idx = 0;
    for (long long i = 0; i < s.len; ) {
        int match = 0;
        if (i <= s.len - find.len) {
            match = 1;
            for (long long j = 0; j < find.len; j++) {
                if (s.data[i+j] != find.data[j]) {
                    match = 0; break;
                }
            }
        }
        if (match) {
            if (rep.len > 0) memcpy(new_data + write_idx, rep.data, rep.len);
            write_idx += rep.len;
            i += find.len;
        } else {
            new_data[write_idx++] = s.data[i++];
        }
    }
    
    vks_string ret = { new_data, new_len };
    return ret;
}

void vk_free_str_array(vks_array_str arr) {
    if (arr.data != NULL) {
        for (int i = 0; i < arr.length; i++) {
            if (arr.data[i].data != NULL) free(arr.data[i].data);
        }
        free(arr.data);
    }
}

// ── Networking (Winsock) ──────────────────────────────────────

void* vks_tcp_connect(char* host_data, long long host_len, int port) {
    char* host_cstr = (char*)malloc(host_len + 1);
    memcpy(host_cstr, host_data, host_len);
    host_cstr[host_len] = '\0';
    
    char port_cstr[16];
    sprintf(port_cstr, "%d", port);

    struct addrinfo hints, *res;
    memset(&hints, 0, sizeof(hints));
    hints.ai_family = AF_UNSPEC;
    hints.ai_socktype = SOCK_STREAM;
    hints.ai_protocol = IPPROTO_TCP;

    if (getaddrinfo(host_cstr, port_cstr, &hints, &res) != 0) {
        free(host_cstr);
        return NULL;
    }

    SOCKET sock = socket(res->ai_family, res->ai_socktype, res->ai_protocol);
    if (sock == INVALID_SOCKET) {
        freeaddrinfo(res);
        free(host_cstr);
        return NULL;
    }

    if (connect(sock, res->ai_addr, (int)res->ai_addrlen) == SOCKET_ERROR) {
        closesocket(sock);
        freeaddrinfo(res);
        free(host_cstr);
        return NULL;
    }

    freeaddrinfo(res);
    free(host_cstr);
    return (void*)sock;
}

int vks_socket_send(void* sock, char* data_ptr, long long data_len) {
    if (sock == NULL || data_len == 0) return -1;
    return send((SOCKET)sock, data_ptr, (int)data_len, 0);
}

vks_string* vks_socket_recv_all(void* sock) {
    int capacity = 4096;
    char* buf = (char*)malloc(capacity);
    int total = 0;
    int n;
    if (sock != NULL) {
        while ((n = recv((SOCKET)sock, buf + total, capacity - total, 0)) > 0) {
            total += n;
            if (total == capacity) {
                capacity *= 2;
                buf = (char*)realloc(buf, capacity);
            }
        }
    }
    vks_string* ret = (vks_string*)malloc(sizeof(vks_string));
    ret->data = buf;
    ret->len = total;
    return ret;
}

void vks_socket_close(void* sock) {
    if (sock != NULL) {
        closesocket((SOCKET)sock);
    }
}

#include "vks_runtime_ext.c"
