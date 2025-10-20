// Client-side crypto polyfill that runs immediately
(function() {
  if (typeof window !== 'undefined' && typeof window.crypto !== 'undefined') {
    if (!window.crypto.randomUUID) {
      window.crypto.randomUUID = function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
    }
  }
})();
