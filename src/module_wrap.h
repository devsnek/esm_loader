#ifndef SRC_MODULE_WRAP_H_
#define SRC_MODULE_WRAP_H_

#include <v8.h>
#include <string>
#include <vector>
#include <unordered_map>  // std::unordered_map

namespace snek {
namespace loader {

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

}  // namespace loader
}  // namespace snek

#endif  // SRC_MODULE_WRAP_H_
