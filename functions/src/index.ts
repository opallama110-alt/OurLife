// Cloud Functions barrel — each function lives in its own module under src/
// and is re-exported from here. Firebase deploy enumerates exports from the
// compiled lib/index.js entrypoint.

import { setGlobalOptions } from 'firebase-functions/v2';

// Region matches Firestore (asia-southeast1). maxInstances caps runaway scale
// to keep Blaze costs bounded; raise if real traffic justifies it.
setGlobalOptions({ region: 'asia-southeast1', maxInstances: 10 });

export { chatWithSystem } from './chatWithSystem';
