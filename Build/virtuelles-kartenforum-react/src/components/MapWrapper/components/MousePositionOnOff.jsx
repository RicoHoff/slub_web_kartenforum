/**
 * Created by nicolas.looschen@pikobytes.de on 26/10/21.
 *
 * This file is subject to the terms and conditions defined in
 * file 'LICENSE.txt', which is part of this source code package.
 */
import React from "react";
import { Control } from "ol/control";
import { round, translate } from "../../../util/util";
import { transform } from "ol/proj";
import { SettingsProvider } from "../../../index";

export class MousePositionOnOff extends Control {
  targetEl = undefined;

  constructor(opt_options) {
    const options = opt_options || {};

    const element = document.createElement("div");
    element.className = "mouse-position ol-unselectable";

    const anchor = document.createElement("a");
    anchor.href = "#mouse-position";
    anchor.innerHTML = "M";
    anchor.className = "ol-has-tooltip";

    const tooltip = document.createElement("span");
    tooltip.role = "tooltip";
    tooltip.innerHTML = translate("mouseposition-title");

    anchor.appendChild(tooltip);

    element.appendChild(anchor);

    super({ element, target: options.target });

    anchor.addEventListener("click", this.toggleMousePosition, false);
  }

  updatePosition = (event) => {
    const settings = SettingsProvider.getSettings();

    const targetEl = this.targetEl;
    const map = this.getMap();
    const coordinate = transform(
      map.getEventCoordinate(event),
      settings.MAPVIEW_PARAMS["projection"],
      "EPSG:4326"
    );
    const roundPos = 3;

    targetEl.innerHTML =
      "Lon: " +
      round(coordinate[0], roundPos) +
      ", Lat: " +
      round(coordinate[1], roundPos);
  };

  toggleMousePosition = (event) => {
    event.preventDefault();

    const activeClass = "active";
    const isActive = event["target"].classList.contains(activeClass);
    const map = this.getMap();

    // toggle activation on anchor
    event["target"].classList.toggle(activeClass);

    // initialize container for mouseposition display
    let targetEl = this.targetEl;
    if (this.targetEl === undefined) {
      const viewport = map.getViewport();
      targetEl = document.createElement("div");
      targetEl.className = "mouse-position-box";
      targetEl.innerHTML = "";

      viewport.appendChild(targetEl);
      this.targetEl = targetEl;
    } else {
      targetEl.innerHTML = "";
    }

    // register / unregister mouse event listener
    if (!isActive) {
      map.getViewport().addEventListener("mousemove", this.updatePosition);
    } else {
      map.getViewport().removeEventListener("mousemove", this.updatePosition);
    }

    // activate behavior
    this.updatePosition(event);
    targetEl.classList.toggle(activeClass);
  };
}
