import "./style.css";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Deck, Layer } from "@deck.gl/core";
import { fetchMap, FetchMapResult, LayerDescriptor } from "@carto/api-client";
import { BASEMAP } from "@deck.gl/carto";
import { LayerFactory } from "./utils";
import { createLegend } from "./legend";
import "./legend.css";
import { buildTooltip } from "./tooltip";
import { initAuth } from "./auth";

// Read URL parameters 'a' and 'b' and print them to the console
const urlParams = new URLSearchParams(window.location.search);
const paramA = urlParams.get('a');
const paramB = urlParams.get('b');
console.log('URL parameter a:', paramA);
console.log('URL parameter b:', paramB);

// Read map view parameters with defaults
function getNumberParam(param: string, defaultValue: number): number {
  const value = urlParams.get(param);
  return value !== null && !isNaN(Number(value)) ? Number(value) : defaultValue;
}

const defaultView = {
  latitude: 0,
  longitude: 0,
  zoom: 1,
  bearing: 0,
  pitch: 0
};

const INITIAL_VIEW_STATE = {
  latitude: getNumberParam('lat', defaultView.latitude),
  longitude: getNumberParam('long', defaultView.longitude),
  zoom: getNumberParam('zoom', defaultView.zoom),
  bearing: defaultView.bearing, // bearing not exposed in URL params
  pitch: getNumberParam('pitch', defaultView.pitch)
};

console.log('Map view params:', {
  latitude: INITIAL_VIEW_STATE.latitude,
  longitude: INITIAL_VIEW_STATE.longitude,
  zoom: INITIAL_VIEW_STATE.zoom,
  pitch: INITIAL_VIEW_STATE.pitch
});

let accessToken: string | undefined;

await initAuth().then((token) => {
  if (token) {
    accessToken = token;
  }
});

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

// Map config for a single map (replace with your actual map ID)
const MAP_ID = "838ff113-1b19-4b86-8712-106550b2fb06";

// Base options for fetchMap
const baseFetchMapOptions = {
  apiBaseUrl,
  accessToken,
};

const layerCountEl = document.querySelector<HTMLDListElement>("#layerCount");

// ...INITIAL_VIEW_STATE now set above...

let currentMapData: {
  title: string;
  layers: LayerDescriptor[];
  popupSettings: FetchMapResult["popupSettings"] | null;
  initialViewState?: Deck["props"]["initialViewState"];
} | null = null;

const deck = new Deck({
  canvas: "deck-canvas",
  initialViewState: INITIAL_VIEW_STATE,
  controller: true,
  onViewStateChange: ({ viewState }) => {
    const { longitude, latitude, ...rest } = viewState;
    map.jumpTo({ center: [longitude, latitude], ...rest });
  },
  getTooltip: ({ object, layer }) => {
    if (!layer) return null;
    return buildTooltip(object, layer, currentMapData);
  },
});

const map = new maplibregl.Map({
  container: "map",
  style: BASEMAP.VOYAGER,
  interactive: false,
});

async function initialize() {
  try {
    // Clear previous legend and layers
    const existingLegend = document.querySelector(".legend-wrapper");
    if (existingLegend) {
      existingLegend.remove();
    }
    deck.setProps({ layers: [] });
    currentMapData = null;

    const fetchOptions = { ...baseFetchMapOptions, cartoMapId: MAP_ID };
    const mapData = await fetchMap(fetchOptions);

    if (!mapData) {
      if (layerCountEl) layerCountEl.innerHTML = "Error loading map";
      return;
    }


    // Use URL params to override fetched initialViewState if present
    const fetchedView = mapData.initialViewState || {};
    const overrideView = {
      latitude: isNaN(INITIAL_VIEW_STATE.latitude) ? fetchedView.latitude : INITIAL_VIEW_STATE.latitude,
      longitude: isNaN(INITIAL_VIEW_STATE.longitude) ? fetchedView.longitude : INITIAL_VIEW_STATE.longitude,
      zoom: isNaN(INITIAL_VIEW_STATE.zoom) ? fetchedView.zoom : INITIAL_VIEW_STATE.zoom,
      bearing: fetchedView.bearing ?? 0,
      pitch: isNaN(INITIAL_VIEW_STATE.pitch) ? fetchedView.pitch : INITIAL_VIEW_STATE.pitch
    };

    currentMapData = {
      title: mapData.title || "Untitled Map",
      layers: mapData.layers || [],
      popupSettings: mapData.popupSettings || null,
      initialViewState: overrideView,
    };

    if (layerCountEl) {
      layerCountEl.innerHTML = currentMapData.layers.length.toString();
    }

    if (currentMapData.layers.length > 0) {
      const legendElement = createLegend(currentMapData.layers);
      document.body.appendChild(legendElement);

      legendElement.addEventListener("togglelayervisibility", (event: Event) => {
        const customEvent = event as CustomEvent<{ layerId: string; visible: boolean }>;
        const { layerId, visible } = customEvent.detail;

        const currentDeckLayers = (deck.props.layers || []).filter(
          (layer): layer is Layer => layer instanceof Layer
        );

        const newLayers = currentDeckLayers.map((layer) =>
          layer.id === layerId ? layer.clone({ visible }) : layer
        );

        deck.setProps({ layers: newLayers });
      });
    }

    deck.setProps({
      initialViewState: currentMapData.initialViewState,
      layers: LayerFactory(currentMapData.layers),
    });

    const view = (currentMapData.initialViewState || {}) as any;
    map.jumpTo({
      center: [view.longitude ?? 0, view.latitude ?? 0],
      zoom: view.zoom ?? 1,
      bearing: view.bearing ?? 0,
      pitch: view.pitch ?? 0,
    });
  } catch (error) {
    if (layerCountEl) layerCountEl.innerHTML = "Error";
    currentMapData = null;
    deck.setProps({ layers: [] });
    console.error("Error initializing map:", error);
  }
}

// Initialize once on page load
initialize();
