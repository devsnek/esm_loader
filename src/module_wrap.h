#ifndef SRC_MODULE_WRAP_H_
#define SRC_MODULE_WRAP_H_

#include <v8.h>
#include <string>
#include <vector>
#include <unordered_map>  // std::unordered_map

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

#define THROW_EXCEPTION(isolate, message)                                     \
  (void) isolate->ThrowException(v8::Exception::Error(                        \
        v8::String::NewFromUtf8(isolate, message, v8::NewStringType::kNormal).ToLocalChecked()))

class ModuleWrap {
 public:
  static void Initialize(v8::Local<v8::Context> context,
                         v8::Local<v8::Object> target);
  static void HostInitializeImportMetaObjectCallback(
      v8::Local<v8::Context> context,
      v8::Local<v8::Module> module,
      v8::Local<v8::Object> meta);

 private:
  ModuleWrap(v8::Isolate* isolate,
             v8::Local<v8::Object> object,
             v8::Local<v8::Module> module);
  ~ModuleWrap();

  inline v8::Isolate* isolate() const { return isolate_; }

  inline v8::Local<v8::Object> object() const { return object_.Get(isolate_); }

  static void New(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Link(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Instantiate(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void Evaluate(const v8::FunctionCallbackInfo<v8::Value>& args);
  static void GetNamespace(const v8::FunctionCallbackInfo<v8::Value>& args);

  static void SetImportModuleDynamicallyCallback(
      const v8::FunctionCallbackInfo<v8::Value>& args);
  static void SetInitializeImportMetaObjectCallback(
      const v8::FunctionCallbackInfo<v8::Value>& args);
  static v8::MaybeLocal<v8::Module> ResolveCallback(
      v8::Local<v8::Context> context,
      v8::Local<v8::String> specifier,
      v8::Local<v8::Module> referrer);
  static v8::MaybeLocal<v8::Promise> ImportModuleDynamically(
      v8::Local<v8::Context> context,
      v8::Local<v8::ScriptOrModule> referrer,
      v8::Local<v8::String> specifier);
  static ModuleWrap* GetFromModule(v8::Local<v8::Module>);

  static v8::Persistent<v8::Function> host_initialize_import_meta_object_callback;
  static v8::Persistent<v8::Function> host_import_module_dynamically_callback;

  v8::Persistent<v8::Object> object_;
  v8::Persistent<v8::Module> module_;
  v8::Persistent<v8::Context> context_;
  v8::Isolate* isolate_;
  std::unordered_map<std::string, v8::Persistent<v8::Promise>> resolve_cache_;
};

static std::unordered_multimap<uint32_t, ModuleWrap*> module_to_module_wrap_map;

#endif  // SRC_MODULE_WRAP_H_
