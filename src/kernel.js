/**
 * kernel.js
 *
 * manifest (webdeploy plugin)
 */

const { PluginError } = require("./error");
const { PluginSettings } = require("./settings");

class Kernel {
    constructor(context,settings) {
        this.context = context;
        if (settings.__audited) {
            this.settings = settings.__audited;
        }
        else {
            this.settings = new PluginSettings(settings);
        }

    }

    async exec() {

    }
}

module.exports = {
    Kernel
};
