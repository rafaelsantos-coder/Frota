"use client";

import type { MapLayerOptions } from "@frota/shared";

type Props = {
  layers: MapLayerOptions;
  onChange: (layers: MapLayerOptions) => void;
  extra?: React.ReactNode;
};

export function MapLayerControls({ layers, onChange, extra }: Props) {
  function toggle(key: keyof MapLayerOptions) {
    onChange({ ...layers, [key]: !layers[key] });
  }

  return (
    <div className="map-layer-controls">
      <label>
        <input type="checkbox" checked={layers.showTrail} onChange={() => toggle("showTrail")} />
        Rastro
      </label>
      <label>
        <input
          type="checkbox"
          checked={layers.connectPoints}
          onChange={() => toggle("connectPoints")}
        />
        Conectar pontos
      </label>
      <label>
        <input
          type="checkbox"
          checked={layers.showGeofences}
          onChange={() => toggle("showGeofences")}
        />
        Cercas
      </label>
      <label>
        <input type="checkbox" checked={layers.showAddress} onChange={() => toggle("showAddress")} />
        Endereço
      </label>
      {extra}
    </div>
  );
}
