/**
 * html.js
 *
 * manifest (webdeploy plugin)
 */

const mark = require("markup-js");
const { ManifestBase } = require("./manifest");
const { PluginError } = require("./error");

class HTMLManifest extends ManifestBase {
    async generate(context) {
        const manifest = this.createManifest();
        const target = await this.getTemplate(context);
        const content = await target.loadContent();

        return mark.up(content,{ manifest });
    }
}

module.exports = {
    HTMLManifest
};
