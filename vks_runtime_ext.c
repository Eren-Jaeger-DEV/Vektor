#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    int* data;
    long long length;
    long long capacity;
} vks_array_i32;

// Assuming vks_string is defined in runtime.c and we are included at the bottom

// ── Native Map Implementation ──────────────────────────────────────
typedef struct {
    char* k_data;
    long long k_len;
    char* v_data;
    long long v_len;
} vks_map_entry;

typedef struct {
    vks_map_entry* entries;
    int count;
    int capacity;
} vks_map;

vks_map* maps_table[1024];
int maps_count = 1;

int map_create() {
    vks_map* m = (vks_map*)malloc(sizeof(vks_map));
    m->entries = NULL;
    m->count = 0;
    m->capacity = 0;
    maps_table[maps_count] = m;
    return maps_count++;
}

void vks_map_set_ffi(int m_id, char* k_data, long long k_len, char* v_data, long long v_len) {
    if (m_id <= 0 || m_id >= maps_count) return;
    vks_map* m = maps_table[m_id];
    for (int i = 0; i < m->count; i++) {
        if (m->entries[i].k_len == k_len && memcmp(m->entries[i].k_data, k_data, k_len) == 0) {
            char* vbuf = (char*)malloc(v_len);
            memcpy(vbuf, v_data, v_len);
            if (m->entries[i].v_data) free(m->entries[i].v_data);
            m->entries[i].v_data = vbuf;
            m->entries[i].v_len = v_len;
            return;
        }
    }
    if (m->count == m->capacity) {
        m->capacity = m->capacity == 0 ? 8 : m->capacity * 2;
        m->entries = (vks_map_entry*)realloc(m->entries, m->capacity * sizeof(vks_map_entry));
    }
    char* kbuf = (char*)malloc(k_len);
    memcpy(kbuf, k_data, k_len);
    char* vbuf = (char*)malloc(v_len);
    memcpy(vbuf, v_data, v_len);
    m->entries[m->count].k_data = kbuf;
    m->entries[m->count].k_len = k_len;
    m->entries[m->count].v_data = vbuf;
    m->entries[m->count].v_len = v_len;
    m->count++;
}

int map_has(int m_id, char* k_data, long long k_len) {
    if (m_id <= 0 || m_id >= maps_count) return 0;
    vks_map* m = maps_table[m_id];
    for (int i = 0; i < m->count; i++) {
        if (m->entries[i].k_len == k_len && memcmp(m->entries[i].k_data, k_data, k_len) == 0) {
            return 1;
        }
    }
    return 0;
}

int map_get(int m_id, char* k_data, long long k_len) {
    if (m_id <= 0 || m_id >= maps_count) return 0;
    vks_map* m = maps_table[m_id];
    for (int i = 0; i < m->count; i++) {
        if (m->entries[i].k_len == k_len && memcmp(m->entries[i].k_data, k_data, k_len) == 0) {
            // For map_get we just return the first 4 bytes of v_data as an int, or 0.
            if (m->entries[i].v_len == 0) return 0;
            // if v_data is actually an integer string, we can parse it
            char* cstr = (char*)malloc(m->entries[i].v_len + 1);
            memcpy(cstr, m->entries[i].v_data, m->entries[i].v_len);
            cstr[m->entries[i].v_len] = '\0';
            int val = atoi(cstr);
            free(cstr);
            return val;
        }
    }
    return 0;
}

vks_string map_get_string(int m_id, char* k_data, long long k_len) {
    if (m_id <= 0 || m_id >= maps_count) {
        vks_string ret = { NULL, 0 };
        return ret;
    }
    vks_map* m = maps_table[m_id];
    for (int i = 0; i < m->count; i++) {
        if (m->entries[i].k_len == k_len && memcmp(m->entries[i].k_data, k_data, k_len) == 0) {
            vks_string ret = { m->entries[i].v_data, m->entries[i].v_len };
            return ret;
        }
    }
    vks_string ret = { NULL, 0 };
    return ret;
}

vks_array_str map_keys(int m_id) {
    if (m_id <= 0 || m_id >= maps_count) {
        vks_array_str ret = { 0, 0, NULL };
        return ret;
    }
    vks_map* m = maps_table[m_id];
    vks_array_str ret;
    ret.data = (vks_string*)malloc(sizeof(vks_string) * m->count);
    ret.capacity = m->count;
    ret.length = m->count;
    for (int i = 0; i < m->count; i++) {
        vks_string key = { m->entries[i].k_data, m->entries[i].k_len };
        ret.data[i] = key;
    }
    return ret;
}

// ── Other Stubs ─────────────────────────────────────────────
int parse_json(void* raw) { vks_panic("parse_json not implemented"); return 0; }
void mkdir(void* p) { vks_panic("mkdir not implemented"); }

// ── Compiler String Functions ─────────────────────────────────
int str_length(vks_string s) {
    return (int)s.len;
}

int str_length_ffi(vks_string s) {
    printf("[DEBUG] str_length_ffi called with ptr=%p\n", s.data);
    fflush(stdout);
    if (!s.data) return 0;
    int len = (int)s.len;
    printf("[DEBUG] str_length_ffi returning %d\n", len);
    fflush(stdout);
    return len;
}

vks_string substring(char* s_data, long long s_len, int start, int end) {
    if (start < 0) start = 0;
    if (end > s_len) end = s_len;
    if (start > end) start = end;
    
    long long len = end - start;
    char* buf = NULL;
    if (len > 0) {
        buf = (char*)malloc(len);
        memcpy(buf, s_data + start, len);
    }
    vks_string ret = { buf, len };
    return ret;
}

void vks_substring_ffi(char* s_data, long long s_len, int start, int end, vks_string* out) {
    if (start < 0) start = 0;
    if (end > s_len) end = s_len;
    if (start > end) start = end;
    
    long long len = end - start;
    char* buf = NULL;
    if (len > 0) {
        buf = (char*)malloc(len);
        memcpy(buf, s_data + start, len);
    }
    out->data = buf;
    out->len = len;
}

int indexOf(char* s_data, long long s_len, char* target_data, long long target_len) {
    if (target_len == 0) return 0;
    if (s_len < target_len) return -1;
    for (long long i = 0; i <= s_len - target_len; i++) {
        int match = 1;
        for (long long j = 0; j < target_len; j++) {
            if (s_data[i+j] != target_data[j]) {
                match = 0; break;
            }
        }
        if (match) return (int)i;
    }
    return -1;
}

vks_string charAt(char* s_data, long long s_len, int index) {
    if (index < 0 || index >= s_len) {
        vks_string ret = { NULL, 0 };
        return ret;
    }
    char* buf = (char*)malloc(1);
    buf[0] = s_data[index];
    vks_string ret = { buf, 1 };
    return ret;
}

void vks_charAt_ffi(char* s_data, long long s_len, int index, vks_string* out) {
    if (index >= 0 && index <= 2) {
        printf("[DEBUG] charAt index=%d\n", index);
        fflush(stdout);
    }
    if (index < 0 || index >= s_len) {
        out->data = NULL;
        out->len = 0;
        return;
    }
    char* buf = (char*)malloc(1);
    buf[0] = s_data[index];
    out->data = buf;
    out->len = 1;
}

int parseI32(char* s_data, long long s_len) {
    if (s_len == 0) return 0;
    char* cstr = (char*)malloc(s_len + 1);
    memcpy(cstr, s_data, s_len);
    cstr[s_len] = '\0';
    int val = atoi(cstr);
    free(cstr);
    return val;
}

double parseFloat(char* s_data, long long s_len) {
    if (s_len == 0) return 0.0;
    char* cstr = (char*)malloc(s_len + 1);
    memcpy(cstr, s_data, s_len);
    cstr[s_len] = '\0';
    double val = atof(cstr);
    free(cstr);
    return val;
}

int charCodeAt(char* s_data, long long s_len, int index) {
    if (index < 0 || index >= s_len) return 0;
    return (unsigned char)s_data[index];
}

int vks_file_exists_ffi(char* p_data, long long p_len) {
    char* path = (char*)malloc(p_len + 1);
    memcpy(path, p_data, p_len);
    path[p_len] = '\0';
    FILE* f = fopen(path, "r");
    if (f) {
        fclose(f);
        free(path);
        return 1;
    }
    free(path);
    return 0;
}

int shell_exec(char* cmd_data, long long cmd_len) {
    char* cmd = (char*)malloc(cmd_len + 1);
    memcpy(cmd, cmd_data, cmd_len);
    cmd[cmd_len] = '\0';
    int ret = system(cmd);
    free(cmd);
    return ret;
}

void vks_read_file_ffi(char* p_data, long long p_len, vks_string* out) {
    char* path = (char*)malloc(p_len + 1);
    memcpy(path, p_data, p_len);
    path[p_len] = '\0';
    FILE* f = fopen(path, "rb");
    if (!f) {
        free(path);
        out->data = NULL;
        out->len = 0;
        return;
    }
    fseek(f, 0, SEEK_END);
    long long len = ftell(f);
    fseek(f, 0, SEEK_SET);
    char* buf = (char*)malloc(len);
    fread(buf, 1, len, f);
    fclose(f);
    out->data = buf;
    out->len = len;
    printf("[DEBUG] vks_read_file_ffi: read %lld bytes, ptr=%p\n", len, buf);
    fflush(stdout);
}

vks_string resolve_import(char* curr_data, long long curr_len, char* imp_data, long long imp_len) {
    vks_string ret = { imp_data, imp_len };
    return ret;
}

void vks_resolve_import_ffi(char* curr_data, long long curr_len, char* imp_data, long long imp_len, vks_string* out) {
    out->data = imp_data;
    out->len = imp_len;
}

extern int vks_argc;
extern char** vks_argv;

int args_count() {
    return vks_argc > 0 ? vks_argc - 1 : 0;
}

void vks_args_get_ffi(int index, vks_string* out) {
    if (index < 0 || index >= (vks_argc > 0 ? vks_argc - 1 : 0)) {
        out->data = NULL;
        out->len = 0;
        return;
    }
    char* arg = vks_argv[index + 1];
    long long len = strlen(arg);
    char* buf = (char*)malloc(len);
    memcpy(buf, arg, len);
    out->data = buf;
    out->len = len;
}

void vks_write_file_ffi(char* path_data, long long path_len, char* content_data, long long content_len) {
    char* path = (char*)malloc(path_len + 1);
    memcpy(path, path_data, path_len);
    path[path_len] = '\0';
    FILE* f = fopen(path, "w");
    if (f) {
        fwrite(content_data, 1, content_len, f);
        fclose(f);
    }
    free(path);
}

int vks_string_eq(char* l_data, long long l_len, char* r_data, long long r_len) {
    printf("[DEBUG] vks_string_eq(l_ptr=%p, l_len=%lld, r_ptr=%p, r_len=%lld)\n", l_data, l_len, r_data, r_len); fflush(stdout);
    if (l_len != r_len) return 0;
    if (l_len == 0) return 1;
    for (long long i = 0; i < l_len; i++) {
        if (l_data[i] != r_data[i]) return 0;
    }
    return 1;
}

int vks_string_cmp(char* l_data, long long l_len, char* r_data, long long r_len) {
    printf("[DEBUG] vks_string_cmp(l_ptr=%p, l_len=%lld, r_ptr=%p, r_len=%lld)\n", l_data, l_len, r_data, r_len); fflush(stdout);
    long long min_len = l_len < r_len ? l_len : r_len;
    for (long long i = 0; i < min_len; i++) {
        if (l_data[i] < r_data[i]) return -1;
        if (l_data[i] > r_data[i]) return 1;
    }
    if (l_len < r_len) return -1;
    if (l_len > r_len) return 1;
    return 0;
}

vks_string vks_toString_i32(int val) {
    char buf[64];
    sprintf(buf, "%d", val);
    long long len = strlen(buf);
    char* data = (char*)malloc(len);
    memcpy(data, buf, len);
    vks_string ret = { data, len };
    return ret;
}

vks_string vks_toString_f64(double val) {
    char buf[64];
    sprintf(buf, "%g", val);
    long long len = strlen(buf);
    char* data = (char*)malloc(len);
    memcpy(data, buf, len);
    vks_string ret = { data, len };
    return ret;
}

vks_string vks_toString_bool(char val) {
    if (val) {
        char* data = (char*)malloc(4);
        memcpy(data, "true", 4);
        vks_string ret = { data, 4 };
        return ret;
    } else {
        char* data = (char*)malloc(5);
        memcpy(data, "false", 5);
        vks_string ret = { data, 5 };
        return ret;
    }
}

void vks_toString_i32_ffi(int val, vks_string* out) {
    char buf[64];
    sprintf(buf, "%d", val);
    long long len = strlen(buf);
    char* data = (char*)malloc(len);
    memcpy(data, buf, len);
    out->data = data;
    out->len = len;
}

void vks_toString_f64_ffi(double val, vks_string* out) {
    char buf[64];
    sprintf(buf, "%g", val);
    long long len = strlen(buf);
    char* data = (char*)malloc(len);
    memcpy(data, buf, len);
    out->data = data;
    out->len = len;
}

void vks_toString_bool_ffi(char val, vks_string* out) {
    if (val) {
        char* data = (char*)malloc(4);
        memcpy(data, "true", 4);
        out->data = data;
        out->len = 4;
    } else {
        char* data = (char*)malloc(5);
        memcpy(data, "false", 5);
        out->data = data;
        out->len = 5;
    }
}

// ── Array Intercepts ───────────────────────────────────────────
void array_push_str(vks_array_i32* arr, vks_string s) {
    if (arr->length + s.len + 2 > arr->capacity) {
        while (arr->length + s.len + 2 > arr->capacity) arr->capacity *= 2;
        arr->data = (int*)realloc(arr->data, sizeof(int) * arr->capacity);
    }
    arr->data[arr->length++] = (s.len >> 8) & 0xff;
    arr->data[arr->length++] = s.len & 0xff;
    for (int i = 0; i < s.len; i++) {
        arr->data[arr->length++] = s.data[i] & 0xff;
    }
}

void array_push_i32(vks_array_i32* arr, int val) {
    if (arr->length + 4 > arr->capacity) {
        arr->capacity *= 2;
        arr->data = (int*)realloc(arr->data, sizeof(int) * arr->capacity);
    }
    arr->data[arr->length++] = (val >> 24) & 0xff;
    arr->data[arr->length++] = (val >> 16) & 0xff;
    arr->data[arr->length++] = (val >> 8) & 0xff;
    arr->data[arr->length++] = val & 0xff;
}

void array_push_u16(vks_array_i32* arr, int val) {
    if (arr->length + 2 > arr->capacity) {
        arr->capacity *= 2;
        arr->data = (int*)realloc(arr->data, sizeof(int) * arr->capacity);
    }
    arr->data[arr->length++] = (val >> 8) & 0xff;
    arr->data[arr->length++] = val & 0xff;
}

void array_push_u32(vks_array_i32* arr, unsigned int val) {
    if (arr->length + 4 > arr->capacity) {
        arr->capacity *= 2;
        arr->data = (int*)realloc(arr->data, sizeof(int) * arr->capacity);
    }
    arr->data[arr->length++] = (val >> 24) & 0xff;
    arr->data[arr->length++] = (val >> 16) & 0xff;
    arr->data[arr->length++] = (val >> 8) & 0xff;
    arr->data[arr->length++] = val & 0xff;
}

void array_push_f64(vks_array_i32* arr, double val) {
    if (arr->length + 8 > arr->capacity) {
        arr->capacity *= 2;
        arr->data = (int*)realloc(arr->data, sizeof(int) * arr->capacity);
    }
    unsigned long long bits;
    memcpy(&bits, &val, sizeof(double));
    arr->data[arr->length++] = (bits >> 56) & 0xff;
    arr->data[arr->length++] = (bits >> 48) & 0xff;
    arr->data[arr->length++] = (bits >> 40) & 0xff;
    arr->data[arr->length++] = (bits >> 32) & 0xff;
    arr->data[arr->length++] = (bits >> 24) & 0xff;
    arr->data[arr->length++] = (bits >> 16) & 0xff;
    arr->data[arr->length++] = (bits >> 8) & 0xff;
    arr->data[arr->length++] = bits & 0xff;
}

char write_binary_ffi(char* path_data, long long path_len, vks_array_i32* arr) {
    char* path = (char*)malloc(path_len + 1);
    memcpy(path, path_data, path_len);
    path[path_len] = '\0';
    
    FILE* f = fopen(path, "wb");
    if (!f) {
        free(path);
        return 0;
    }
    
    unsigned char* buf = (unsigned char*)malloc(arr->length);
    for (int i = 0; i < arr->length; i++) {
        buf[i] = (unsigned char)(arr->data[i] & 0xff);
    }
    
    fwrite(buf, 1, arr->length, f);
    fclose(f);
    free(buf);
    free(path);
    return 1;
}
void vks_array_push_str_ffi(vks_array_i32* arr, char* s_data, long long s_len) { if (arr->length + s_len + 2 > arr->capacity) { while (arr->length + s_len + 2 > arr->capacity) arr->capacity = arr->capacity == 0 ? 8 : arr->capacity * 2; arr->data = (int*)realloc(arr->data, sizeof(int) * arr->capacity); } arr->data[arr->length++] = (s_len >> 8) & 0xff; arr->data[arr->length++] = s_len & 0xff; for (int i = 0; i < s_len; i++) { arr->data[arr->length++] = s_data[i] & 0xff; } }


