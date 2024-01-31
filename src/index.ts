import { ATCPlugin } from "./atcplugin";

globalThis.getOlympusPlugin = () => {
    return new ATCPlugin();
}