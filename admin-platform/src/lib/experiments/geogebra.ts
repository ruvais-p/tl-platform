export type GeoGebraApi = {
  deleteObject?: (name: string) => void;
  evalCommand: (command: string) => boolean;
  getValue: (name: string) => number;
  getValueString: (name: string) => string;
  getXcoord?: (name: string) => number;
  getYcoord?: (name: string) => number;
  registerObjectUpdateListener?: (name: string, listener: string) => void;
  reset: () => void;
  recalculateEnvironments?: () => void;
  setAxesVisible?: (view: number, xVisible: boolean, yVisible: boolean, zVisible?: boolean) => void;
  setAxisLabels?: (view: number, xLabel: string, yLabel: string, zLabel?: string) => void;
  setCaption?: (name: string, caption: string) => void;
  setColor?: (name: string, red: number, green: number, blue: number) => void;
  setCoords?: (name: string, x: number, y: number, z?: number) => void;
  setCoordSystem?: {
    (xMin: number, xMax: number, yMin: number, yMax: number): void;
    (xMin: number, xMax: number, yMin: number, yMax: number, zMin: number, zMax: number, verticalY?: boolean): void;
  };
  setFilling?: (name: string, filling: number) => void;
  setFixed?: (name: string, fixed: boolean, selectionAllowed?: boolean) => void;
  setGridVisible?: {
    (visible: boolean): void;
    (view: number, visible: boolean): void;
  };
  setLabelStyle?: (name: string, style: number) => void;
  setLabelVisible?: (name: string, visible: boolean) => void;
  setLayer?: (name: string, layer: number) => void;
  setLineStyle?: (name: string, style: number) => void;
  setLineThickness?: (name: string, thickness: number) => void;
  setPointSize?: (name: string, size: number) => void;
  setPointStyle?: (name: string, style: number) => void;
  setPerspective?: (perspective: string) => void;
  setSize?: (width: number, height: number) => void;
  setValue?: (name: string, value: number) => void;
  setVisible?: (name: string, visible: boolean) => void;
  unregisterObjectUpdateListener?: (name: string) => void;
};

export type GeoGebraConstructor = new (
  parameters: Record<string, unknown>,
  useBrowserForJS?: boolean,
) => { inject: (id: string) => void };

declare global {
  interface Window { GGBApplet?: GeoGebraConstructor }
}

let loader: Promise<GeoGebraConstructor> | null = null;

export function loadGeoGebra() {
  if (window.GGBApplet) return Promise.resolve(window.GGBApplet);
  if (loader) return loader;
  loader = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>("script[data-tella-geogebra]");
    const script = existing || document.createElement("script");
    const loaded = () => window.GGBApplet ? resolve(window.GGBApplet) : reject(new Error("GeoGebra did not initialise."));
    const failed = () => { loader = null; reject(new Error("GeoGebra could not be loaded.")); };
    script.addEventListener("load", loaded, { once: true });
    script.addEventListener("error", failed, { once: true });
    if (!existing) {
      script.src = "https://www.geogebra.org/apps/deployggb.js";
      script.async = true;
      script.dataset.tellaGeogebra = "true";
      document.head.appendChild(script);
    }
  });
  return loader;
}
