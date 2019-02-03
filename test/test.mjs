import fs from 'fs';

export const a = 5;
export const { url } = import.meta;

import('./test.mjs').then(console.log, console.error);
