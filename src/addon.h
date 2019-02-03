#ifndef SRC_ADDON_H_
#define SRC_ADDON_H_

#ifdef __GNUC__
#define LIKELY(expr) __builtin_expect(!!(expr), 1)
#define UNLIKELY(expr) __builtin_expect(!!(expr), 0)
#define PRETTY_FUNCTION_NAME __PRETTY_FUNCTION__
#else
#define LIKELY(expr) expr
#define UNLIKELY(expr) expr
#define PRETTY_FUNCTION_NAME ""
#endif

#define STRINGIFY_(x) #x
#define STRINGIFY(x) STRINGIFY_(x)

#define CHECK(expr)                                                           \
  do {                                                                        \
    if (UNLIKELY(!(expr))) {                                                  \
      fprintf(stderr, "%s:%s Assertion `%s' failed.\n",                       \
          __FILE__, STRINGIFY(__LINE__), #expr);                              \
      abort();                                                                \
    }                                                                         \
  } while (0)

#define CHECK_EQ(a, b) CHECK((a) == (b))
#define CHECK_GE(a, b) CHECK((a) >= (b))
#define CHECK_GT(a, b) CHECK((a) > (b))
#define CHECK_LE(a, b) CHECK((a) <= (b))
#define CHECK_LT(a, b) CHECK((a) < (b))
#define CHECK_NE(a, b) CHECK((a) != (b))


#define THROW_EXCEPTION(isolate, message) \
  (void) isolate->ThrowException(v8::Exception::Error(v8::String::NewFromUtf8(isolate, message)))

#endif  // SRC_ADDON_H_
