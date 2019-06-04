'use strict';

/* eslint-disable no-await-in-loop */

const path = require('path');
const { stat, readFile } = require('fs').promises;
const { builtinModules } = require('module');

async function isAFile(pathname) {
  try {
    const s = await stat(pathname);
    return s.isFile();
  } catch {
    return false;
  }
}

// https://nodejs.org/api/modules.html#modules_all_together

async function LOAD_AS_FILE(X) {
  for (const ext of ['', '.mjs', '.js', '.json', '.wasm', '.node']) {
    const resolved = `${X}${ext}`;
    if (await isAFile(resolved)) {
      return resolved;
    }
  }
  return null;
}

async function LOAD_INDEX(X) {
  for (const file of ['index.mjs', 'index.js', 'index.json', 'index.wasm', 'index.node']) {
    const resolved = path.join(X, file);
    if (await isAFile(resolved)) {
      return resolved;
    }
  }
  return null;
}

async function LOAD_AS_DIRECTORY(X) {
  const pJsonPath = path.join(X, 'package.json');

  // 1. If X/package.json is a file,
  if (await isAFile(pJsonPath)) {
    // a. Parse X/package.json, and look for "main" field.
    const p = JSON.parse(await readFile(pJsonPath, 'utf8'));
    if (p.main) {
      // b. let M = X + (json main field)
      const M = path.join(X, p.main);

      // c. LOAD_AS_FILE(M)
      {
        const resolved = await LOAD_AS_FILE(M);
        if (resolved !== null) {
          return resolved;
        }
      }

      // d. LOAD_INDEX(M)
      {
        const resolved = await LOAD_INDEX(M);
        if (resolved !== null) {
          return resolved;
        }
      }
    }
  }

  // 2. LOAD_INDEX(X)
  return LOAD_INDEX(X);
}

function NODE_MODULES_PATHS(START) {
  START = path.resolve(START);

  if (START === '/') {
    return ['/node_modules'];
  }

  // 1. let PARTS = path split(START)
  const PARTS = START.split(path.sep);

  // 2. let I = count of PARTS - 1
  let I = PARTS.length - 1;

  // 3. let DIRS = [GLOBAL_FOLDERS]
  const DIRS = [];

  // 4. while I >= 0,
  while (I >= 0) {
    // a. if PARTS[I] = "node_modules" CONTINUE
    if (PARTS[I] === 'node_modules') {
      continue; // eslint-disable-line no-continue
    }

    // b. DIR = path join(PARTS[0 .. I] + "node_modules")
    const DIR = [...PARTS.slice(0, I + 1), 'node_modules'].join(path.sep);

    // c. DIRS = DIRS + DIR
    DIRS.push(DIR);

    // d. let I = I - 1
    I -= 1;
  }

  // 5. return DIRS
  return DIRS;
}

async function LOAD_NODE_MODULES(X, START) {
  // 1. let DIRS = NODE_MODULES_PATHS(START)
  const DIRS = NODE_MODULES_PATHS(START);

  // 2. for each DIR in DIRS:
  for (const DIR of DIRS) {
    // a. LOAD_AS_FILE(DIR/X)
    {
      const resolved = await LOAD_AS_FILE(path.join(DIR, X));
      if (resolved !== null) {
        return resolved;
      }
    }

    // b. LOAD_AS_DIRECTORY(DIR/X)
    {
      const resolved = await LOAD_AS_DIRECTORY(path.join(DIR, X));
      if (resolved !== null) {
        return resolved;
      }
    }
  }
  return null;
}

async function nodeResolve(X, Y) {
  // 1. If X is a core module,
  if (builtinModules.includes(X)) {
    // a. return the core module
    return `node:${X}`;
  }

  // 2. If X begins with '/'
  if (X.startsWith('/')) {
    // a. set Y to be the filesystem root
    Y = '/';
  }

  // 3. If X begins with './' or '/' or '../'
  if (/^\.{0,2}\//.test(X)) {
    // a. LOAD_AS_FILE(Y + X)
    {
      const resolved = await LOAD_AS_FILE(path.join(path.dirname(Y), X));
      if (resolved !== null) {
        return resolved;
      }
    }

    // b. LOAD_AS_DIRECTORY(Y + X)
    {
      const resolved = await LOAD_AS_DIRECTORY(path.join(Y, X));
      if (resolved !== null) {
        return resolved;
      }
    }
  }

  // 4. LOAD_NODE_MODULES(X, dirname(Y))
  {
    const resolved = await LOAD_NODE_MODULES(X, path.dirname(Y));
    if (resolved !== null) {
      return resolved;
    }
  }

  // 5. THROW "not found"
  return null;
}

module.exports = nodeResolve;
