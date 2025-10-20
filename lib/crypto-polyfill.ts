// Polyfill for crypto.randomUUID for browsers that don't support it
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  // @ts-expect-error - Polyfill for missing crypto.randomUUID
  crypto.randomUUID = function() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}

export {};
