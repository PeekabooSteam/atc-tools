import { Dropdown } from "controls/dropdown";
import { Map } from "map/map";
import { Airbase } from "mission/airbase";

export type TStripData = {
    airbase: Airbase,
    assignedAlt?: number;
    assignedSpeed?: number;
    position: number;
    runwayDropdown?: Dropdown;
    stripElement: HTMLElement;
    unitID: number;
}

export class Strip {
    #airbase: Airbase;
    #assignedAlt: number = -1;
    #assignedSpeed: number = -1;
    #element!: HTMLElement;
    #map: Map;
    #polyline!: L.Polyline;
    #position!: number;
    #runway!: string;
    #runwayDropdown?: Dropdown;
    #unitID: number;

    constructor(map: Map, stripData: TStripData) {
        this.#airbase = stripData.airbase;
        this.#element = stripData.stripElement;
        this.#map = map;
        this.#position = stripData.position;
        this.#runwayDropdown = stripData.runwayDropdown;
        this.#unitID = stripData.unitID;
    }

    delete() {
        this.#element.remove();
        this.#polyline.remove();
    }

    getAssignedAltitude() {
        return this.#assignedAlt;
    }

    getAssignedSpeed() {
        return this.#assignedSpeed;
    }

    getElement(): HTMLElement {
        return this.#element;
    }

    getMap() {
        return this.#map;
    }

    getPolyline() {
        return this.#polyline;
    }

    getPosition() {
        return this.#position;
    }

    getUnitID() {
        return this.#unitID;
    }

    removePolyline() {
        this.getPolyline().remove();
    }

    setAssignedAltitude(altitude: number) {
        this.#assignedAlt = altitude;
    }

    setAssignedSpeed(speed: number) {
        this.#assignedSpeed = speed;
    }

    setPolyline(polyline: L.Polyline) {
        this.#polyline = polyline;
    }

    setPosition(position: number) {
        this.#position = position;
    }

    setRunway(runway: string) {
        this.#runway = runway;
    }

    setRunwayDropdown(runwayDropdown: Dropdown) {
        this.#runwayDropdown = runwayDropdown;
    }
}