/**
 * Created by nicolas.looschen@pikobytes.de on 23.09.21.
 *
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.txt', which is part of this source code package.
 */

import { atom } from "recoil";

export const activeBasemapIdState = atom({
    key: "activeBasemapId",
    default: null,
});

export const currentApplicationStateState = atom({
    key: "currentApplicationState",
    default: undefined,
});

export const displayedLayersCountState = atom({
    key: "displayedLayersCount",
    default: 0,
});

export const elementsScreenSizeState = atom({
    key: "elementScreenSize",
    default: {
        map: { height: 0, width: 0 },
        layermanagement: { height: 0, width: 0 },
        padding: { height: 15, width: 15 },
        offset: { height: 15, width: 0 },
        spatialtemporalsearch: { height: 0, width: 0 },
    },
});

export const facetState = atom({
    key: "facetState",
    default: { facets: [], georeference: false },
});

export const mapSearchOverlayLayerState = atom({
    key: "mapSearchOverlayLayer",
    default: undefined,
    dangerouslyAllowMutability: true,
});

export const mapState = atom({
    key: "mapState",
    default: undefined,
    dangerouslyAllowMutability: true,
});

export const map3dState = atom({
    key: "map3dState",
    default: false,
});

export const olcsMapState = atom({
    key: "olcsMapState",
    default: undefined,
    dangerouslyAllowMutability: true,
});

export const searchIsLoadingState = atom({
    key: "searchIsLoadingState",
    default: false,
});

export const searchResultDescriptorState = atom({
    key: "searchResultDescriptorState",
    default: { mapCount: 10, id: Date.now() },
});

export const selectedFeaturesState = atom({
    key: "selectedFeatureState",
    default: [],
    dangerouslyAllowMutability: true,
});

export const selectedOriginalMapIdState = atom({
    key: "selectedOriginalMapIdState",
    default: undefined,
});

export const timeExtentState = atom({
    key: "timeExtentState",
    default: [1850, 1970],
});

export const defaultTimeRange = [1850, 1970];
export const timeRangeState = atom({
    key: "timeRangeState",
    default: defaultTimeRange,
});
