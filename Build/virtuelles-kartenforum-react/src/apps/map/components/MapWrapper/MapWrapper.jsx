/**
 * Created by nicolas.looschen@pikobytes.de on 16.09.21.
 *
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.txt', which is part of this source code package.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { Map } from "ol";
import View from "ol/View";
import VectorLayer from "ol/layer/Vector";
import VectorSource from "ol/source/Vector";
import { defaults, DragRotateAndZoom } from "ol/interaction";
import OLCesium from "olcs/OLCesium";
import { useRecoilState, useSetRecoilState, useRecoilValue } from "recoil";
import olcsCore from "olcs/core";
import clsx from "clsx";
import { useWindowWidth } from "@react-hook/window-size";
import Overlay from "ol/Overlay";
import RasterSynchronizer from "olcs/RasterSynchronizer";
import VectorSynchronizer from "olcs/VectorSynchronizer";

import { createBaseMapLayer } from "../../../../util/geo";
import { getDefaultControls, isDefined } from "../../../../util/util";
import {
  activeBasemapIdState,
  map3dState,
  mapState,
  olcsMapState,
  selectedFeaturesState,
} from "../../atoms/atoms";
import {
  createHistoricMapForFeature,
  generateLimitCamera,
  setOptimizedCesiumSettings,
} from "./util";
import { getMapClassNameForLayout } from "../../layouts/util";
import { useSetElementScreenSize } from "../../../../util/hooks";
import GeoJsonLayer from "../CustomLayers/GeoJsonLayer";
import DialogEditFeature from "./components/DialogEditFeature/DialogEditFeature";
import CustomOverlaySynchronizer from "./components/customOverlaySynchronizer/customOverlaySynchronizer";
import customFeatureConverter from "./components/customFeatureConverter/customFeatureConverter";
import { LAYER_TYPES } from "../CustomLayers/LayerTypes";
import "./MapWrapper.scss";

export function MapWrapper(props) {
  const {
    baseMapUrl,
    ChildComponent,
    enable3d,
    enableTerrain,
    layout,
    mapViewSettings = {
      center: [1528150, 6630500],
      projection: "EPSG:3857",
      zoom: 2,
    },
    terrainTilesUrl,
  } = props;

  // state
  const [activeBasemapId, setActiveBasemapId] =
    useRecoilState(activeBasemapIdState);
  const [hideOverlayContents, setHideOverlayContents] = useState(true);
  const [is3dActive, set3dActive] = useRecoilState(map3dState);
  const [map, setMap] = useRecoilState(mapState);
  const setOlcsMap = useSetRecoilState(olcsMapState);
  const [selectedFeature, setSelectedFeature] = useState(undefined);
  const selectedFeatures = useRecoilValue(selectedFeaturesState);
  const width = useWindowWidth();

  // refs
  const controlsRef = useRef();
  const mapElement = useRef();
  const olcsMapRef = useRef();
  const overlayRef = useRef();
  const overlayContainerRef = useRef();
  const timeoutRef = useRef();

  // publish elements size to global state
  useSetElementScreenSize(mapElement, "map");

  ////
  // Handler section
  ////

  // update active basemap
  const handleBasemapChange = (newBasemapLayer) => {
    setActiveBasemapId(newBasemapLayer.id);
  };

  // toggle viewmode from 2d to 3d and vice versa
  const handleChangeViewMode = (new3dStateGenerator) => {
    let new3dState;
    set3dActive((oldState) => {
      new3dState = new3dStateGenerator(oldState);
      return new3dState;
    });

    const ol3d = olcsMapRef.current;

    if (ol3d !== undefined) {
      if (new3dState) {
        const scene = ol3d.getCesiumScene(),
          camera = scene.camera,
          bottom = olcsCore.pickBottomPoint(scene),
          angle = Cesium.Math.toRadians(50),
          transform = Cesium.Matrix4.fromTranslation(bottom);

        if (ol3d.getEnabled()) return;
        // 2d -> 3d transition
        ol3d.setEnabled(true);

        // take care that every time the view is reset when zoom out
        olcsCore.rotateAroundAxis(camera, -angle, camera.right, transform, {
          duration: 500,
        });
      } else {
        const scene = ol3d.getCesiumScene(),
          camera = scene.camera,
          bottom = olcsCore.pickBottomPoint(scene),
          transform = Cesium.Matrix4.fromTranslation(bottom),
          angle = olcsCore.computeAngleToZenith(scene, bottom);

        if (!ol3d.getEnabled()) return;

        // 3d -> 2d transition
        olcsCore.rotateAroundAxis(camera, -angle, camera.right, transform, {
          callback: function () {
            ol3d.setEnabled(false);
            const view = ol3d.getOlMap().getView();
            const resolution = view.getResolution();
            const rotation = view.getRotation();

            // constraints apply on setting them
            view.setResolution(resolution);
            view.setRotation(rotation);
          },
        });
      }
    }
  };

  // deletes a feature from the map and closes the overlay afterwards
  const handleFeatureDelete = (feature) => {
    map.getLayers().forEach((layer) => {
      const source = layer.getSource();
      if (source instanceof VectorSource) {
        const features = source.getFeatures();
        const containsFeature = features.includes(feature);
        if (containsFeature) {
          source.removeFeature(feature);
        }
      }
    });

    handleOverlayClose();
  };

  // open overlay on map click and supply it with the first feature under the cursor
  const handleMapClick = useCallback(
    (e) => {
      const overlay = overlayRef.current;
      const pixel = e.pixel;

      let newSelectedFeature;

      // handle selection process depending on viewmode
      if (!is3dActive) {
        // use ol api for 2d
        newSelectedFeature = map.forEachFeatureAtPixel(
          pixel,
          (feature) => feature
        );
      } else {
        // use cesium api for 3d
        const pickedFeature = olcsMapRef.current
          .getCesiumScene()
          .pick(new Cesium.Cartesian2(pixel[0], pixel[1]));

        if (pickedFeature !== undefined)
          newSelectedFeature = pickedFeature.primitive.olFeature;
      }

      clearTimeout(timeoutRef.current);
      if (isDefined(newSelectedFeature)) {
        // fade in overlay after short delay
        setHideOverlayContents(true);
        timeoutRef.current = setTimeout(() => {
          setHideOverlayContents(false);
        }, 5);

        setSelectedFeature(newSelectedFeature);
        overlay.setPosition(e.coordinate);
      } else {
        // hide overlay
        setSelectedFeature(undefined);
        overlay.setPosition(undefined);
      }
    },
    [is3dActive, map]
  );

  // Close the map overlay
  const handleOverlayClose = () => {
    overlayRef.current.setPosition(undefined);
    setSelectedFeature(undefined);
  };

  ////
  // Effect section
  ////

  // initialize map on first render - logic formerly put into componentDidMount
  useEffect(() => {
    const view = new View(mapViewSettings);

    // create and add vector source layer
    const initalFeaturesLayer = new VectorLayer({
      source: new VectorSource(),
    });

    const overlay = new Overlay({
      element: overlayContainerRef.current,
    });

    // make overlay accessible
    overlayRef.current = overlay;

    // create map
    const initialMap = new Map({
      controls: [],
      layers: [
        createBaseMapLayer({
          id: "slub-osm",
          type: "xyz",
          urls: baseMapUrl,
        }),

        initalFeaturesLayer,
      ],
      interactions: defaults().extend([new DragRotateAndZoom()]),
      overlays: [overlay],
      renderer: "canvas",
      target: mapElement.current,
      view,
    });

    setMap(initialMap);

    if (enable3d && enableTerrain) {
      //
      // Some code regarding the 3d capabilities is based on the work of https://github.com/geoadmin/mf-geoadmin3
      //

      //// initialize the globe
      const ol3d = new OLCesium({
        createSynchronizers: (map, scene) => [
          new RasterSynchronizer(map, scene),
          new VectorSynchronizer(map, scene, new customFeatureConverter(scene)),
          new CustomOverlaySynchronizer(map, scene),
        ],
        map: initialMap,
        sceneOptions: {
          scene3DOnly: true,
        },
      });

      // update terrain Exaggeration
      ol3d.getCesiumScene().globe.terrainExaggeration = 3.0;

      ol3d.enableAutoRenderLoop();

      // initialize a terrain map
      const scene = ol3d.getCesiumScene();

      // set the terrain provider
      scene.terrainProvider = new Cesium.CesiumTerrainProvider({
        url: terrainTilesUrl,
        requestVertexNormals: true,
      });

      setOptimizedCesiumSettings(scene);
      // setShadowsActivated(scene);

      scene.postRender.addEventListener(generateLimitCamera(mapViewSettings));

      setOlcsMap(ol3d);
      olcsMapRef.current = ol3d;

      // preload 3d mode in order to improve start up time
      ol3d.warmUp(ol3d.getCamera().getAltitude(), 5000);
    }
  }, []);

  useEffect(() => {
    selectedFeatures.forEach((selectedFeature) => {
      const {
        displayedInMap = false,
        feature,
        isVisible = true,
        opacity = 1,
        type,
      } = selectedFeature;

      if (!displayedInMap && feature.get("has_georeference")) {
        const layer =
          type === LAYER_TYPES.GEOJSON
            ? new GeoJsonLayer({ feature })
            : createHistoricMapForFeature(feature);

        layer.allowUseInLayerManagement = true;

        layer.setOpacity(opacity);
        layer.setVisible(isVisible);
        map.addLayer(layer);
        selectedFeature.displayedInMap = true;
      }
    });
  }, [selectedFeatures]);

  useEffect(() => {
    if (isDefined(controlsRef.current)) {
      controlsRef.current.forEach((control) => {
        const updateFn = control.handleExternal3dStateUpdate;
        if (updateFn !== undefined) {
          updateFn(is3dActive);
        }
      });
    }
  }, [is3dActive]);

  // update controls on layout change
  useEffect(() => {
    if (isDefined(map)) {
      if (isDefined(controlsRef.current)) {
        controlsRef.current.forEach((control) => {
          map.removeControl(control);
        });
      }

      const newControls = getDefaultControls({
        baseMapUrl,
        initialBasemapId: activeBasemapId,
        is3dActive,
        layout,
        onBasemapChange: handleBasemapChange,
        onViewModeChange: handleChangeViewMode,
      });

      newControls.forEach((control) => {
        map.addControl(control);
      });

      controlsRef.current = newControls;
    }
  }, [layout, map]);

  // fit map to viewport after resize (e.g switch from landscape to portrait mode)
  useEffect(() => {
    if (map !== undefined) {
      const timeout = setTimeout(() => {
        map.updateSize();
      }, 200);
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [map, width]);

  // bind click handler to map
  useEffect(() => {
    if (map !== undefined) {
      map.on("click", handleMapClick);

      return () => {
        map.un("click", handleMapClick);
      };
    }
  }, [handleMapClick, map]);

  return (
    <div className="map-container">
      <div
        className={clsx(
          "vkf-map-overlay",
          !hideOverlayContents && "animation-show"
        )}
        ref={overlayContainerRef}
      >
        {selectedFeature !== undefined && (
          <DialogEditFeature
            onClose={handleOverlayClose}
            onDelete={handleFeatureDelete}
            feature={selectedFeature}
          />
        )}
      </div>
      <div
        ref={mapElement}
        className={clsx("map-div", "olMap", getMapClassNameForLayout(layout))}
        tabIndex={0}
      >
        {isDefined(map) && <ChildComponent />}
      </div>
    </div>
  );
}

MapWrapper.propTypes = {
  baseMapUrl: PropTypes.arrayOf(PropTypes.string),
  ChildComponent: PropTypes.func,
  enable3d: PropTypes.bool,
  enableTerrain: PropTypes.bool,
  layout: PropTypes.string,
  mapViewSettings: PropTypes.shape({
    center: PropTypes.arrayOf(PropTypes.number),
    projection: PropTypes.string,
    zoom: PropTypes.number,
  }),
  terrainTilesUrl: PropTypes.string,
};

export default MapWrapper;
