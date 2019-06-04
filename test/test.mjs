import fs from 'fs';

export const a = 5;
export const { url } = import.meta;

import * as mutex from './mutex';

console.log(mutex);

import('./test.mjs').then(console.log, console.error);
