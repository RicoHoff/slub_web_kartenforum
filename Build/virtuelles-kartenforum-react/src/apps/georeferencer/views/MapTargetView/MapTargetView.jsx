/**
 * Created by jacob.mendt@pikobytes.de on 11.11.21.
 *
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.txt', which is part of this source code package.
 */
import React, { useRef, useEffect } from "react";
import { useRecoilState, useRecoilValue } from "recoil";
import PropTypes from "prop-types";
import DragZoom from "ol/src/interaction/DragZoom";
import Fullscreen from "ol/src/control/FullScreen";
import { defaults as defaultInteractions } from "ol/src/interaction";
import GeoJSON from "ol/src/format/GeoJSON";
import Map from "ol/src/Map";
import Tile from "ol/src/layer/Tile";
import View from "ol/src/View";
import Zoom from "ol/src/control/Zoom";
import ZoomToExtent from "ol/src/control/ZoomToExtent";
import XYZ from "ol/src/source/XYZ";
import "ol/ol.css";
import {
  rectifiedImageParamsState,
  targetViewParamsState,
} from "../../atoms/atoms";
import OlControlLayerSpy from "../../../../components/OlControlLayerSpy/OlControlLayerSpy";
import LayerRectifiedImage from "../../components/LayerRectifiedImage/LayerRectifiedImage";
import "./MapTargetView.scss";
import TileLayer from "ol/layer/Tile";

export const MapTargetView = (props) => {
  const { extent, urlNominatim, urlsOsmBaseMap } = props;
  const rectifiedImageParams = useRecoilValue(rectifiedImageParamsState);
  const [targetViewParams, setTargetViewParams] = useRecoilState(
    targetViewParamsState
  );
  const refMapContainer = useRef(null);

  // Effect for initial loading of the georeference map
  useEffect(() => {
    const performInit = async () => {
      // Create the base layer
      const baseLayer = new Tile({
        source: new XYZ({
          urls: urlsOsmBaseMap,
          crossOrigin: "*",
          maxZoom: 18,
        }),
      });

      // Create the map object
      const map = new Map({
        controls: [new Fullscreen(), new Zoom()],
        interactions: defaultInteractions().extend([new DragZoom()]),
        layers: [baseLayer],
        target: refMapContainer.current,
        view: new View({
          projection: "EPSG:3857",
          center: [871713, 6396955],
          zoom: 4.3,
        }),
      });

      setTargetViewParams({
        map: map,
      });

      // Set extent if set
      if (extent !== undefined) {
        const polygon = new GeoJSON().readGeometry(extent, {
          dataProjection: "EPSG:4326",
          featureProjection: "EPSG:3857",
        });

        // Get extent of target source features and focus map to it
        map.getView().fit(polygon.getExtent(), {
          padding: [100, 100, 100, 100],
        });

        // Add a zoom to extent control
        map.addControl(
          new ZoomToExtent({
            extent: polygon.getExtent(),
          })
        );
      }

      // Add a layer spy control
      map.addControl(
        new OlControlLayerSpy({
          spyLayer: new TileLayer({
            zIndex: 10,
            attribution: undefined,
            source: new XYZ({
              urls: urlsOsmBaseMap,
              crossOrigin: "*",
              attributions: [],
            }),
          }),
        })
      );
    };

    if (refMapContainer.current !== null) {
      performInit();
    }
  }, [setTargetViewParams]);

  return (
    <div className="vk-mapview-target">
      <div className="map-container" ref={refMapContainer} />
      {targetViewParams !== null && rectifiedImageParams !== null && (
        <LayerRectifiedImage
          key={rectifiedImageParams.wms_url}
          map={targetViewParams.map}
          layerName={rectifiedImageParams.layer_name}
          wmsUrl={rectifiedImageParams.wms_url}
        />
      )}
    </div>
  );
};

MapTargetView.propTypes = {
  extent: PropTypes.object,
  urlNominatim: PropTypes.string,
  urlsOsmBaseMap: PropTypes.arrayOf(PropTypes.string),
};

export default MapTargetView;
