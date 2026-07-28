import "@testing-library/jest-dom/vitest";

// jsdom implements no layout, so it has no `scrollTo` and logs a "Not implemented" notice for
// every call. The sheet scrolls to the top on a page change; stub it so that notice does not
// bury real output.
window.scrollTo = () => {};
