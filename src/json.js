/**
 * json.js
 *
 * manifest (webdeploy plugin)
 */

const { ManifestBase } = require("./manifest");
const { PluginError } = require("./error");

class JsonManifest extends ManifestBase {
    async generate(context) {
        let json;
        const manifest = this.createManifest();

        if (this.options.template) {
            const target = await this.getTemplate(context);

            let content = await target.loadContent();
            try {
                json = JSON.parse(content);
            } catch (ex) {
                throw new PluginError("cannot parse JSON from '%s'",this.options.template);
            }

            json[this.options.prop] = manifest;
        }
        else {
            json = manifest;
        }

        return JSON.stringify(json);
    }
}

module.exports = {
    JsonManifest
};
