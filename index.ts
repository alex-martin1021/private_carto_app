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

const INITIAL_VIEW_STATE = {
  latitude: 0,
  longitude: 0,
  zoom: 1,
  bearing: 0,
  pitch: 0,
};

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

    currentMapData = {
      title: mapData.title || "Untitled Map",
      layers: mapData.layers || [],
      popupSettings: mapData.popupSettings || null,
      initialViewState: mapData.initialViewState || INITIAL_VIEW_STATE,
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

    map.jumpTo({
      center: [currentMapData.initialViewState?.longitude || 0, currentMapData.initialViewState?.latitude || 0],
      zoom: currentMapData.initialViewState?.zoom || 1,
      bearing: currentMapData.initialViewState?.bearing || 0,
      pitch: currentMapData.initialViewState?.pitch || 0,
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
