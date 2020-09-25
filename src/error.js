/**
 * error.js
 *
 * manifest (webdeploy plugin)
 */

const { format } = require("util");

class PluginError extends Error {
    constructor(formatStr,...args) {
        super("manifest: " + format(formatStr,...args));
    }
}

module.exports = {
    PluginError
};
