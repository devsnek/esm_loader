#include <node.h>
#include "module_wrap.h"

void Initialize(v8::Local<v8::Object> exports) {
  v8::Isolate* isolate = v8::Isolate::GetCurrent();
  v8::Local<v8::Context> context = isolate->GetCurrentContext();
  snek::loader::ModuleWrap::Initialize(context, exports);
}

NODE_MODULE(NODE_GYP_MODULE_NAME, Initialize)
