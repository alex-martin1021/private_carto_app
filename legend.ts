import { LayerDescriptor, Scale } from '@carto/api-client';
import './legend.css';

function extractLayerColor(layer: LayerDescriptor): string {
  const fillScale: Scale | undefined = layer.scales?.fillColor;
  if (fillScale?.range && fillScale.range.length > 0) {
    const firstColor = fillScale.range[0];
    if (typeof firstColor === 'string') {
      return firstColor;
    } else if (Array.isArray(firstColor)) {
      const [r, g, b, a = 255] = firstColor;
      return `rgba(${r}, ${g}, ${b}, ${a / 255})`;
    }
  }

  const fill = (layer.props as any)?.getFillColor;
  if (Array.isArray(fill) && fill.length >= 3) {
    const [r, g, b] = fill;
    return `rgb(${r}, ${g}, ${b})`;
  }

  return '#333';
}

export function createLegend(layers: LayerDescriptor[]): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'legend-wrapper';

  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'legend-toggle-btn';
  toggleBtn.id = 'legend-toggle';
  toggleBtn.setAttribute('aria-label', 'Toggle legend');
  toggleBtn.innerHTML = `
    <svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z" /></svg>
    <span>Layers</span>
  `;

  const container = document.createElement('div');
  container.className = 'legend-container';

  let legendVisible = false;
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.transform = 'translateY(20px)';

  toggleBtn.addEventListener('click', () => {
    legendVisible = !legendVisible;
    container.style.opacity = legendVisible ? '1' : '0';
    container.style.pointerEvents = legendVisible ? 'auto' : 'none';
    container.style.transform = legendVisible ? 'translateY(0)' : 'translateY(20px)';
    toggleBtn.classList.toggle('open', legendVisible);
  });

  layers.forEach((layer, index) => {
    const layerId = ((layer.props as any)?.id || `layer-${index}`) as string;
    const layerLabel = ((layer.props as any)?.cartoLabel || `Layer ${index + 1}`) as string;
    const visible = (layer.props as any)?.visible !== false;
    const layerColor = extractLayerColor(layer);

    const layerDiv = document.createElement('div');
    layerDiv.className = 'legend-layer';

    const titleContainer = document.createElement('div');
    titleContainer.className = 'legend-title-container';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `layer-toggle-${layerId}`;
    checkbox.checked = visible;
    checkbox.className = 'layer-visibility-toggle';

    const nameLabel = document.createElement('label');
    nameLabel.className = 'legend-title';
    nameLabel.textContent = layerLabel;
    nameLabel.htmlFor = checkbox.id;
    nameLabel.style.color = layerColor;

    checkbox.addEventListener('change', () => {
      const event = new CustomEvent('togglelayervisibility', {
        detail: { layerId, visible: checkbox.checked }
      });
      wrapper.dispatchEvent(event);
    });

    titleContainer.appendChild(checkbox);
    titleContainer.appendChild(nameLabel);
    layerDiv.appendChild(titleContainer);
    container.appendChild(layerDiv);
  });

  wrapper.appendChild(container);
  wrapper.appendChild(toggleBtn);
  return wrapper;
}
