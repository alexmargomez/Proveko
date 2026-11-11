const j = globalThis.__PLATFORM_JSX_RUNTIME__;
if (!j) {
  throw new Error('Platform JSX runtime is not initialized');
}
export const Fragment = j.Fragment;
export const jsx = j.jsx;
export const jsxs = j.jsxs;
export default j;
