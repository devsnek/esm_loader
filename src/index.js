'use strict';

const CJSModule = require('module');
const { fileURLToPath, pathToFileURL } = require('url');
const path = require('path');
const { readFile } = require('fs').promises;
const {
  ModuleWrap,
  setInitializeImportMetaObjectCallback,
  setImportModuleDynamicallyCallback,
} = require('bindings')('module_wrap');
const WASI = require('wasi');
const nodeResolve = require('./node_resolve');

const resolvedPromise = Promise.resolve();
const importMetaCallbackMap = new WeakMap();

class ModuleMap extends Map {
  constructor(...args) {
    super(...args);
    this.delete = undefined;
  }

  set(k, v) {
    if (this.has(k)) {
      throw new TypeError(`key '${k}' already set`);
    }
    return super.set(k, v);
  }
}

const moduleMap = new ModuleMap();

const createDynamicModule = (imports, exports, url, evaluate) => {
  const source = `
${imports.map((i, index) => {
    const p = JSON.stringify(i);
    return `import * as $import_${index} from ${p};
import.meta.imports[${p}] = $import_${index};`;
  }).join('\n')}
${exports.map((e) => `let $${e};
export { $${e} as ${e} };
import.meta.exports.${e} = {
  get: () => $${e},
  set: (v) => { $${e} = v; },
};`).join('\n')}
import.meta.done();
`;

  const m = new ModuleWrap(source, url);

  const reflect = {
    imports: Object.create(null),
    exports: Object.create(null),
  };

  importMetaCallbackMap.set(m, (meta, wrap) => {
    meta.url = wrap.url;
    meta.imports = reflect.imports;
    meta.exports = reflect.exports;
    meta.done = () => {
      evaluate(reflect);
    };
  });

  return m;
};

const loadESM = async (url) => {
  const source = await readFile(fileURLToPath(url), 'utf8');
  return new ModuleWrap(source, url);
};

const loadCJS = async (url) => {
  const pathname = url.startsWith('node:') ? url.slice(5) : fileURLToPath(url);
  return createDynamicModule([], ['default'], url, (reflect) => {
    const cache = CJSModule._cache[pathname];
    const exports = cache ? cache.savedExports : require(pathname);
    reflect.exports.default.set(exports);
  });
};

const loadJSON = async (url) => {
  const pathname = fileURLToPath(url);
  const source = await readFile(pathname);
  return createDynamicModule([], ['default'], url, (reflect) => {
    const json = JSON.parse(source);
    reflect.exports.default.set(json);
  });
};

const loadWASM = async (url) => {
  const pathname = fileURLToPath(url);
  const buffer = await readFile(pathname);
  let compiled;
  try {
    compiled = await WebAssembly.compile(buffer);
  } catch (err) {
    err.message = `${pathname}: ${err.message}`;
    throw err;
  }

  let usesWasi = false;
  const imports = WebAssembly.Module
    .imports(compiled)
    .reduce((a, { module }) => {
      if (module === 'wasi_unstable') {
        usesWasi = true;
      } else {
        a.push(module);
      }
      return a;
    }, []);

  const exports = WebAssembly.Module
    .exports(compiled)
    .map(({ name }) => name);

  return createDynamicModule(imports, exports, url, (reflect) => {
    let wasi;
    if (usesWasi) {
      wasi = new WASI({
        // https://github.com/WebAssembly/WASI/issues/5
        preopenDirectories: { '.': '.' },
        args: process.argv.slice(1),
        env: process.env,
      });
      reflect.imports.wasi_unstable = wasi.exports;
    }

    const instance = new WebAssembly.Instance(compiled, reflect.imports);
    exports.forEach((e) => {
      reflect.exports[e].set(instance.exports[e]);
    });

    if (usesWasi) {
      wasi.setMemory(instance.exports.memory);
      instance.exports._start();
    }
  });
};

const loaderMap = new Map([
  ['cjs', loadCJS],
  ['json', loadJSON],
  ['native', loadCJS],
  ['builtin', loadCJS],
  ['esm', loadESM],
  ['wasm', loadWASM],
]);

const extensionMap = new Map([
  ['.js', 'cjs'],
  ['.json', 'json'],
  ['.node', 'native'],
  ['.mjs', 'esm'],
  ['.wasm', 'wasm'],
]);

async function resolve(specifier, referrer) {
  let fileReferrer;
  try {
    fileReferrer = fileURLToPath(referrer);
  } catch {
    fileReferrer = referrer;
  }
  const resolved = await nodeResolve(specifier, fileReferrer);
  if (resolved !== null) {
    const type = resolved.startsWith('node:')
      ? 'builtin'
      : extensionMap.get(path.extname(resolved));
    if (!type) {
      throw new Error(`Could not resolve type for ${resolved}`);
    }
    const loader = loaderMap.get(type);
    return {
      url: type === 'builtin' ? resolved : `${pathToFileURL(resolved)}`,
      loader,
    };
  }
  throw new Error(`Cannot resolved module "${specifier}" from "${referrer}"`);
}

class ModuleJob {
  constructor(url, loader) {
    this.url = url;
    this.modulePromise = loader(url);
    this.module = undefined;

    const dependencyJobs = [];
    this.linked = (async () => {
      this.module = await this.modulePromise;

      const promises = this.module.link(async (specifier) => {
        const jobPromise = ModuleJob.create(specifier, this.url);
        dependencyJobs.push(jobPromise);
        return (await jobPromise).modulePromise;
      });

      await Promise.all(promises);
      return Promise.all(dependencyJobs);
    })();
    this.linked.catch(() => undefined);

    this.instantiated = undefined;
  }

  async instantiate() {
    if (this.instantiated === undefined) {
      this.instantiated = this._instantiate();
    }
    await this.instantiated;
  }

  async _instantiate() {
    const jobsInGraph = new Set();
    const addJobsToDependencyGraph = async (moduleJob) => {
      if (jobsInGraph.has(moduleJob)) {
        return undefined;
      }
      jobsInGraph.add(moduleJob);
      const dependencyJobs = await moduleJob.linked;
      return Promise.all(dependencyJobs.map(addJobsToDependencyGraph));
    };

    await addJobsToDependencyGraph(this);

    this.module.instantiate();

    jobsInGraph.forEach((job) => {
      job.instantiated = resolvedPromise;
    });
  }

  async run() {
    await this.instantiate();
    const result = this.module.evaluate();
    return { result, __proto__: null };
  }

  static async create(specifier, referrer) {
    const { url, loader } = await resolve(specifier, referrer);

    if (moduleMap.has(url)) {
      return moduleMap.get(url);
    }

    const job = new ModuleJob(url, loader);
    moduleMap.set(url, job);

    return job;
  }
}

const loader = {
  async import(specifier, referrer) {
    const job = await ModuleJob.create(specifier, referrer);
    await job.run();
    return job.module.getNamespace();
  },
};

module.exports = {
  import: loader.import,

  loaderMap,
  extensionMap,

  get [Symbol.toStringTag]() {
    return 'ESM Loader';
  },
};

Object.defineProperty(module.exports, Symbol.toStringTag, { enumerable: false });
Object.freeze(module.exports);

const CJSLoad = CJSModule.prototype.load;
CJSModule.prototype.load = function load(filename) {
  Reflect.apply(CJSLoad, this, [filename]);

  this.savedExports = this.exports;

  const url = `${pathToFileURL(filename)}`;
  if (!moduleMap.has(url)) {
    const job = new ModuleJob(url, loaderMap.get('cjs'));
    moduleMap.set(url, job);
  }
};

Object.values(CJSModule._cache).forEach((c) => {
  c.savedExports = c.exports;
});

setImportModuleDynamicallyCallback(
  (specifier, referrer) => loader.import(specifier, referrer),
);

setInitializeImportMetaObjectCallback((meta, wrap) => {
  if (importMetaCallbackMap.has(wrap)) {
    importMetaCallbackMap.get(wrap)(meta, wrap);
    importMetaCallbackMap.delete(wrap);
    return;
  }
  meta.url = wrap.url;
});

const ModuleLoad = CJSModule._load;
CJSModule._load = (request, parent, isMain) => {
  if (isMain) {
    const r = require.resolve(request);
    if (r.endsWith('.mjs') || r.endsWith('.wasm')) {
      return module.exports
        .import(r)
        .catch((e) => {
          console.error(e); // eslint-disable-line no-console
          process.exit(1);
        });
    }
  }
  return ModuleLoad.call(CJSModule, request, parent, isMain);
};
