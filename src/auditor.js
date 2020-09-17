/**
 * auditor.js
 *
 * manifest (webdeploy plugin)
 */

const { PluginSettings } = require("./settings");

class Auditor {
    constructor(context,settings) {
        this.context = context;
        this.settings = settings;
    }

    async exec() {
        // Validate settings. Store validated settings object on '__audited'
        // property for future access.
        const settings = new PluginSettings(this.settings);
        this.settings.__audited = settings;
        this.settings = settings;
    }
}

module.exports = {
    Auditor
};
