#include <stdio.h>
#include <string.h>
#include <stdlib.h>

void vks_print_i32(int x) { 
    printf("%d\n", x); 
}

void vks_print_f64(double x) { 
    printf("%f\n", x); 
}

void vks_print_str(char* s, long len) { 
    fwrite(s, 1, len, stdout); 
    printf("\n"); 
}

void vks_print_bool(int x) { 
    if (x) printf("true\n"); 
    else printf("false\n"); 
}

double vks_sqrt(double x) { 
    // basic sqrt placeholder if math.h is annoying
    double z = 1.0;
    for(int i=0; i<10; i++) {
        z -= (z*z - x) / (2*z);
    }
    return z;
}
