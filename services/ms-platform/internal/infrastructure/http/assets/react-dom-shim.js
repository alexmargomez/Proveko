const R = globalThis.__PLATFORM_REACT_DOM__;
if (!R) {
  throw new Error('Platform ReactDOM runtime is not initialized');
}
export default R;
export const { createPortal, flushSync, unmountComponentAtNode, version } = R;
