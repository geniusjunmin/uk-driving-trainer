type MockContext = Record<string, unknown>;

const createWebGLContext = (): MockContext => ({
  canvas: null,
  drawingBufferHeight: 150,
  drawingBufferWidth: 300,
  getExtension: () => null,
  getParameter: () => null,
  getShaderPrecisionFormat: () => null,
  createBuffer: () => ({}),
  createProgram: () => ({}),
  createShader: () => ({}),
  bindBuffer: () => undefined,
  bufferData: () => undefined,
  clear: () => undefined,
  clearColor: () => undefined,
  compileShader: () => undefined,
  enable: () => undefined,
  linkProgram: () => undefined,
  shaderSource: () => undefined,
  viewport: () => undefined
});

const createCanvas = () => ({
  width: 300,
  height: 150,
  style: {},
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  getContext: (contextId: string) =>
    contextId === 'webgl' || contextId === 'webgl2' || contextId === 'experimental-webgl'
      ? createWebGLContext()
      : null
});

if (!('document' in globalThis)) {
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: (tagName: string) => (tagName === 'canvas' ? createCanvas() : { style: {} }),
      createElementNS: (_namespace: string, tagName: string) =>
        tagName === 'canvas' ? createCanvas() : { style: {} },
      querySelector: () => null
    }
  });
}

if (!('window' in globalThis)) {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: globalThis
  });
}

if (!('requestAnimationFrame' in globalThis)) {
  Object.defineProperty(globalThis, 'requestAnimationFrame', {
    configurable: true,
    value: (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16)
  });
}

if (!('cancelAnimationFrame' in globalThis)) {
  Object.defineProperty(globalThis, 'cancelAnimationFrame', {
    configurable: true,
    value: (handle: number) => clearTimeout(handle)
  });
}
