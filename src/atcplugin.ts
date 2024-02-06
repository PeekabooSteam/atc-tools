import { Airbase } from "mission/airbase";
import { AirbaseChartRunwayData, OlympusPlugin } from "interfaces";
import { ContextMenu } from "contextmenus/contextmenu";
import { Dropdown } from "controls/dropdown";
import { OlympusApp } from "olympusapp";
import { SVGInjector } from "@tanem/svg-injector"
import { Unit } from "unit/unit";
import { Utilities } from "other/utilities";
import Sortable, { SortableEvent } from "sortablejs";
import { Panel } from "panels/panel";
import { Strip } from "./strip";
import { TemplateManager } from "template/templatemanager";

export class ATCPlugin implements OlympusPlugin {
    #airbaseDropdown!: Dropdown;
    #airbases!: { [key: string]: Airbase };
    #app!: OlympusApp;
    #contextName = "atc";
    #element!: HTMLElement;
    #imagePath = "/plugins/atcplugin/images/";
    #leaflet!: any;
    #panel!: Panel;
    #runwayDisplay!: HTMLElement;
    #selectedAirbase: Airbase | null = null;
    #stripboard!: HTMLElement;
    #strips: { [key: string]: { [key: string]: Strip } } = {};
    #templateManager!: TemplateManager;
    #templates: { [key: string]: string } = {
        "panel": `
            <div id="atc-panel-header">
                <h2>ATC</h2>
                <div>
                    <button data-on-click="atcCentreOnAirbase"><img src="${this.#imagePath}arrows-to-dot-solid.svg" /></button>
                    <div id="atc-airbase-select" class="ol-select narrow">
                        <div class="ol-select-value">Select an airbase</div>
                        <div class="ol-select-options"></div>
                    </div>
                </div>
            </div>
            <ul id="atc-runway-data">
            </ul>
            <div id="atc-panel-content">                
                <ul id="atc-stripboard" class="ol-scrollable"></ul>
            </div>
        `,
        "runways": `
            <% runways.forEach( runway => { %>
                <li>
                    <div class="atc-runway">
                        <% runway.headings.forEach( heading => { %>
                            <% for( const[ name, data ] of Object.entries(heading)) { %>
                                <div class="heading"><% if (data.ILS) { %><abbr title="<%= data.ILS %>">ILS</abbr><% } %><abbr title="Mag heading: <%= data.magHeading %>"><%= name.replace("(CLOSED)", "(C)") %></abbr></div>
                            <% } %>
                        <% }) %>
                    </div>
                </li>
            <% }) %>
        `,
        "strip": `
            <div class="atc-strip-top-bar">
                <div class="atc-strip-handle"><img src="${this.#imagePath}sort-solid.svg" /><span class="atc-aircraft-name"><%= unit.getUnitName() %></span></div>
                <div class="atc-strip-buttons">
                    <button data-on-click="atcDeclareEmergency" data-on-click-params='{"unitID":"<%= unit.ID %>"}'><img src="${this.#imagePath}triangle-exclamation-solid.svg" /></button>
                    <button data-on-click="atcDeleteStrip" data-on-click-params='{"unitID":"<%= unit.ID %>"}'><img src="${this.#imagePath}delete-left-solid.svg" /></button>
                </div>
            </div>

            <div class="atc-strip-info">
                <div class="bearing-range info-cell">
                    <abbr title="Bearing, Range">BR</abbr>
                    <div data-purpose="bearing-range">?</div>
                </div>
                <div class="assigned-actual altitude">
                    <div class="assigned info-cell">
                        <abbr title="ASSIGNED altitude (allows ± 200ft)">Asn. Alt</abbr>
                        <input type="number" min="0" max="50000" step="500" data-purpose="assigned altitude" placeholder="-----" />
                    </div>
                    <div class="actual info-cell">
                        <abbr title="Altitude ACTUAL">Alt</abbr>
                        <div data-purpose="actual altitude">?</div>
                    </div>
                </div>

                <div class="assigned-actual speed">
                    <div class="assigned info-cell">
                        <abbr title="ASSIGNED speed (allows ± 2%)">Asn. Spd</abbr>
                        <input type="number" min="0" max="600" step="25" data-purpose="assigned speed" placeholder="---" />
                    </div>
                    <div class="actual info-cell">
                        <abbr title="Speed ACTUAL">Spd</abbr>
                        <div data-purpose="actual speed">?</div>
                    </div>
                </div>

                <div class="atc-strip-runway">
                    <div class="ol-select narrow" data-purpose="runway">
                        <div class="ol-select-value">RWY</div>
                        <div class="ol-select-options"></div>
                    </div>
                </div>
            </div>
        `
    };
    #unitContextMenu!: ContextMenu;
    #updatesInterval!: any;
    #utilities!: Utilities;

    constructor() {
    }

    initialize(app: OlympusApp) {
        this.#app = app;
        this.#templateManager = this.#app.getTemplateManger();
        this.#leaflet = this.#app.getMap().getLeaflet();
        this.#utilities = this.#app.getUtilities();

        //  Airbase spawn context menu
        const airbaseSpawnContextMenu = document.createElement("div");
        airbaseSpawnContextMenu.id = "atc-airbase-context-menu";
        airbaseSpawnContextMenu.className = "ol-context-menu no-airbase";
        airbaseSpawnContextMenu.innerHTML = `
            <div class="ol-panel">
                <h3>ATC Airbase CM</h3>
                <div class="atc-airbase-chart-data"></div>
                <button id="atc-control-this-airbase" data-on-click="atcControlThisAirbase">Control this airbase</button>
            </div>
        `;
        document.body.appendChild(airbaseSpawnContextMenu);

        //  Unit context menu
        const unitContextMenu = document.createElement("div");
        unitContextMenu.id = "atc-unit-context-menu";
        unitContextMenu.className = "ol-context-menu no-airbase";
        unitContextMenu.innerHTML = `
            <div class="ol-panel">
                <h3>ATC Unit CM</h3>
                <p class="no-airbase">No airbase selected</p>
                <div class="atc-airbase-chart-data"></div>
                <button id="atc-add-to-approach" data-on-click="atcAddToApproach">Add to approach</button>
            </div>
        `;
        document.body.appendChild(unitContextMenu);

        const contextManager = this.#app.getContextManager();
        contextManager.add(this.#contextName, {
            "allowUnitCopying": false,
            "allowUnitPasting": false,
            "contextMenus": {
                "airbase": {
                    "id": "atc-airbase-context-menu",
                    "onBeforeShow": (menu: ContextMenu) => {
                        const airbase = this.getSelectedAirbase();
                        const el = menu.getContainer()?.querySelector(".atc-airbase-chart-data");

                        if (el instanceof HTMLElement) {
                            if (airbase) {
                                menu.getContainer()?.classList.remove("no-airbase");
                                el.innerHTML = this.#templateManager.renderTemplate("airbaseChartData", {
                                    "airbase": airbase
                                });
                            } else {
                                menu.getContainer()?.classList.add("no-airbase");
                            }
                        }
                    }
                },
                "map": false,
                "unit": {
                    "id": "atc-unit-context-menu",
                    "onBeforeShow": (menu: ContextMenu) => {
                        const airbase = this.getSelectedAirbase();
                        const el = menu.getContainer()?.querySelector(".atc-airbase-chart-data");

                        if (el instanceof HTMLElement) {
                            if (airbase) {
                                menu.getContainer()?.classList.remove("no-airbase");
                            } else {
                                menu.getContainer()?.classList.add("no-airbase");
                            }
                        }
                    }
                }
            },
            "onSet": () => {
                //  TODO: highlight airbase being controlled
            },
            "onUnset": () => {
                this.#resetView();
            },
            "useUnitControlPanel": false,
            "useUnitInfoPanel": false
        });

        this.#unitContextMenu = contextManager.get(this.#contextName).getContextMenuManager().get("unit");

        this.#element = document.createElement("div");
        this.#element.id = "atc-panel";
        this.#element.className = "ol-panel hide";
        this.#element.innerHTML = this.#templates.panel;
        document.body.appendChild(this.#element);

        this.#injectSVGs(this.#element);

        this.#panel = this.#app.getMap().createPanel(this.#element.id)

        const openFunction = (ev: MouseEvent) => {
            if (contextManager.currentContextIs(this.#contextName)) {
                closeFunction(ev);
            } else {
                this.startUpdates();
                this.#element.classList.remove("hide");
                contextManager.setContext(this.#contextName);
            }
        };

        //  Stripboard
        this.#stripboard = <HTMLElement>document.getElementById("atc-stripboard");

        new Sortable(this.#stripboard, {
            "animation": 250,
            "handle": ".atc-strip-handle",
            "easing": "cubic-bezier(1, 0, 0, 1)",
            "onSort": (ev: SortableEvent) => {
                this.getStripboard().querySelectorAll(":scope > li:not(.hide)").forEach((el: Element, i) => {
                    if (!this.#selectedAirbase) return;
                    if (el.hasAttribute("data-unit-id")) {
                        const strip = this.#strips[this.#selectedAirbase.getName()][el.getAttribute("data-unit-id") + ""];
                        if (strip) strip.setPosition(i);
                    }
                });
            }
        });

        //  Element for displaying the runways
        this.#runwayDisplay = <HTMLElement>this.getElement().querySelector("#atc-runway-data");

        //  Close function
        const closeFunction = (ev: MouseEvent) => {
            this.#element.classList.add("hide");
            contextManager.setContext("olympus");
            this.stopUpdates();
        };

        document.getElementById("atc-close")?.addEventListener("click", closeFunction);

        //  Insert to plugin toolbar
        const item = this.#app.getPluginsManager().createPluginToolbarItem(this, {
            "innerHTML": `<button title="ATC tools"><img src="${this.#imagePath}tower-observation-solid.svg" /></button>`
        });

        const element = item.insert();
        element.querySelector("button")?.addEventListener("click", openFunction);

        //  Listen for "add to approach" event
        document.addEventListener("atcAddToApproach", (ev: CustomEventInit) => {
            this.#app.getUnitsManager().getSelectedUnits().forEach((unit: Unit) => {
                if (["Aircraft", "Helicopter"].includes(unit.getCategory()) && unit.getAlive()) this.addUnit(unit.ID);
            });
            this.#unitContextMenu.hide();
        });

        this.#populateAirbases();

        document.addEventListener("atcCentreOnAirbase", (ev: CustomEventInit) => {
            const airbase = this.getSelectedAirbase();
            if (airbase) this.#app.getMap().setView(airbase.getLatLng());
        });

        document.addEventListener("atcDeleteStrip", (ev: CustomEventInit) => {
            const airbase = this.getSelectedAirbase();
            if (!airbase) return false;
            const strip = this.#strips[airbase.getName()][ev.detail.unitID];
            if (strip instanceof Strip) {
                strip.delete();
                delete this.#strips[airbase.getName()][ev.detail.unitID];
            }
        });

        document.addEventListener("atcDeclareEmergency", (ev: CustomEventInit) => {
            const strip = this.getStripByUnitID(ev.detail.unitID);
            if (strip) strip.getElement().toggleAttribute("data-declare-emergency");
        });

        return true;
    }

    addUnit(unitID: number) {
        const airbase = this.getSelectedAirbase();
        if (!airbase) return false;

        const airbaseName = airbase.getName();

        if (!this.#strips[airbaseName]) this.#strips[airbaseName] = {};
        else if (this.#strips[airbaseName][unitID]) return false;

        this.#createStrip(unitID);
    }

    #createStrip(unitID: number) {
        const unit = this.#app.getUnitsManager().getUnitByID(unitID);
        if (!unit) return false;

        const airbase = this.getSelectedAirbase();
        if (!airbase) return false;

        const stripsAtThisAirbase = this.#strips[airbase.getName()];

        const stripElement = document.createElement("li");
        stripElement.className = "atc-strip";
        stripElement.innerHTML += this.#templateManager.renderTemplateString(this.#templates.strip, {
            "unit": unit
        });
        stripElement.setAttribute("data-unit-id", unitID + "");

        const strip = new Strip(this.#app.getMap(), {
            "airbase": airbase,
            "position": Object.keys(stripsAtThisAirbase).length,
            "stripElement": stripElement,
            "unitID": unitID
        });

        const runway = stripElement.querySelector(`.ol-select[data-purpose="runway"]`);

        if (runway instanceof HTMLElement) {
            let runwayHeadings = this.getRunwayHeadings();
            if (!runwayHeadings) {
                runwayHeadings = ["No data"];
            } else {
                runwayHeadings.unshift("---");
            }
            strip.setRunwayDropdown(this.#panel.createDropdown({
                "ID": runway,
                "callback": (value: string) => {
                    const airbase = this.getSelectedAirbase();
                    if (!airbase) return;
                    this.#strips[airbase.getName()][unitID].setRunway(value);
                },
                "defaultText": "---",
                "options": runwayHeadings
            }));
        }

        stripElement.querySelectorAll("input[data-purpose]").forEach(input => {
            input.addEventListener("input", (ev) => {
                if (input instanceof HTMLInputElement === false) return;
                const purpose = input.getAttribute("data-purpose");
                const value = (input.value === "") ? -1 : parseInt(input.value);
                if (purpose === "assigned altitude") {
                    strip.setAssignedAltitude(value);
                }
                if (purpose === "assigned speed") {
                    strip.setAssignedSpeed(value);
                }
            });

        });

        this.getStripboard().appendChild(stripElement);
        this.#injectSVGs(stripElement);

        stripElement.addEventListener("mouseover", (ev: MouseEvent) => {
            unit.setHighlighted(true);
            this.drawPolyline(strip, airbase, unit);
        });

        stripElement.addEventListener("mouseout", (ev: MouseEvent) => {
            unit.setHighlighted(false);
            strip.removePolyline();
        });

        this.#strips[airbase.getName()][unitID] = strip;

        return strip;

    }

    doUpdate() {
        const airbase = this.getSelectedAirbase();
        if (!airbase) return;

        const units = this.#app.getUnitsManager().getUnits();
        const strips = this.getAirbaseStrips();

        if (!strips) return;

        Object.values(strips).forEach(strip => {
            const unit = units[strip.getUnitID()];

            if (!unit) return;      //  TODO: make it put an alert on the stripboard

            const stripElement = strip.getElement();
            const actualAlt = Math.round(this.#utilities.mToFt(unit.getPosition().alt || 1) / 100) * 100;
            const actualSpeed = Math.round(this.#utilities.msToKts(unit.getSpeed()));
            const assignedAlt = strip.getAssignedAltitude();
            const assignedSpeed = strip.getAssignedSpeed();
            const altitudeLeeway = 200;   //  Amount
            const speedLeeway = 0.02;  //  Percentage

            const bearing = this.#utilities.zeroPrepend(Math.round(this.#utilities.bearing(airbase.getLatLng(), unit.getLatLng())), 3);
            const range = Math.round(this.#utilities.mToNm(this.#utilities.distance(airbase.getLatLng(), unit.getLatLng())));

            stripElement.querySelectorAll(`[data-purpose="bearing-range"]`).forEach((el: Element) => {
                if (el instanceof HTMLElement) el.innerText = `${bearing} / ${range}`;
            });

            stripElement.querySelectorAll(`[data-purpose="actual altitude"]`).forEach((el: Element) => {
                if (el instanceof HTMLElement) el.innerText = actualAlt + "";
            });

            stripElement.querySelectorAll(`[data-purpose="actual speed"]`).forEach((el: Element) => {
                if (el instanceof HTMLElement) el.innerText = actualSpeed + "";
            });

            stripElement.toggleAttribute("data-altitude-warning", (assignedAlt > 0 && (actualAlt <= assignedAlt - altitudeLeeway || actualAlt >= assignedAlt + altitudeLeeway)));

            const speedDelta = assignedSpeed * speedLeeway;
            stripElement.toggleAttribute("data-speed-warning", (assignedSpeed > 0 && (actualSpeed <= assignedSpeed - speedDelta || actualSpeed >= assignedSpeed + speedDelta)));

            if (strip.getPolyline()) strip.removePolyline();

            if (unit.getHighlighted()) this.drawPolyline(strip, airbase, unit);
        });
    }

    drawPolyline(strip: Strip, airbase: Airbase, unit: Unit) {
        if (strip.getPolyline()) strip.removePolyline();

        const polyline = this.#leaflet.polyline([airbase.getLatLng(), unit.getLatLng()], {
            "color": "#ffea00",
            "weight": 3
        });
        polyline.addTo(this.#app.getMap());
        strip.setPolyline(polyline);
    }

    getElement() {
        return this.#element;
    }

    getAirbaseStrips() {
        return (this.#selectedAirbase) ? this.#strips[this.#selectedAirbase.getName()] : false;
    }

    getName() {
        return this.#contextName;
    }

    getRunwayDisplay() {
        return this.#runwayDisplay;
    }

    getRunwayHeadings(airbase?: Airbase | null) {
        airbase = airbase || this.#selectedAirbase;
        if (!airbase) return false;

        const headings = airbase.getChartData().runways.reduce((acc, runway: AirbaseChartRunwayData) => {
            acc = acc.concat(Object.keys(runway.headings[0]))
            return acc;
        }, [] as string[]);

        headings.sort();

        return headings;
    }

    getSelectedAirbase() {
        return this.#selectedAirbase;
    }

    getStripByUnitID(unitID: number) {
        const airbase = this.getSelectedAirbase();
        return (airbase) ? this.#strips[airbase.getName()][unitID] : false;
    }

    getStripboard(): HTMLElement {
        return this.#stripboard;
    }

    #injectSVGs(container: HTMLElement) {
        SVGInjector(container.querySelectorAll(`img[src$=".svg"]`));
    }

    #populateAirbases() {

        new Promise<void>((resolve, reject) => {
            const interval = setInterval(() => {
                this.#airbases = this.#app.getMissionManager().getAirbases();
                if (Object.values(this.#airbases).length > 0) {
                    clearInterval(interval);
                    resolve();
                }
            }, 1000);
        }).then(() => {

            const airbaseOptions = Object.keys(this.#airbases).sort().reduce((output, key: string) => {
                output.push(this.#airbases[key].getName());
                return output;
            }, [] as string[]);

            this.#airbaseDropdown = this.#panel.createDropdown({
                "ID": "atc-airbase-select",
                "callback": (value: string) => {
                    //  Hide all
                    this.getStripboard().querySelectorAll(":scope > li").forEach(el => el.classList.add("hide"));
                    this.getRunwayDisplay().innerHTML = "";
                    const airbaseName = value;
                    this.#selectedAirbase = (airbaseName === "") ? null : this.#airbases[airbaseName];
                    this.#resetView();
                    if (!this.#selectedAirbase) return;

                    this.#selectedAirbase.getElement()?.classList.add("atc-controlled");

                    const activeStripsAtThisAirbase = this.#strips[this.#selectedAirbase.getName()];
                    if (activeStripsAtThisAirbase) {
                        Object.values(activeStripsAtThisAirbase).sort((stripA: Strip, stripB: Strip) => {
                            return (stripA.getPosition() > stripB.getPosition()) ? 1 : -1
                        }).forEach(strip => strip.getElement().classList.remove("hide"));
                    }
                },
                "options": airbaseOptions,
                "defaultText": "Select an airbase"
            })

        });

    }

    #resetView() {
        document.querySelectorAll(".atc-controlled").forEach(icon => icon.classList.remove("atc-controlled"));
    }

    startUpdates() {
        console.log("ATC: starting updates");
        this.#updatesInterval = setInterval(() => {
            this.doUpdate();
        }, 2000);
    }

    stopUpdates() {
        console.log("ATC: stopping updates");
        clearInterval(this.#updatesInterval);
    }

}