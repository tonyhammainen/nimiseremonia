import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Tests import `describe`/`it`/`expect` explicitly rather than relying on
// globals, which also means Testing Library's automatic cleanup is not wired
// up for us — unmount here so one test's DOM never leaks into the next.
afterEach(cleanup);
