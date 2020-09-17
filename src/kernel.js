/**
 * kernel.js
 *
 * manifest (webdeploy plugin)
 */

const minimatch = require("minimatch");
const { JsonManifest } = require("./json");
const { PluginError } = require("./error");
const { PluginSettings } = require("./settings");

function manifestFactory(refs,options) {
    if (options.type == "json") {
        return new JsonManifest(refs,options);
    }

    if (options.type == "html") {
        return; //TODO
    }

    if (options.type == "php") {
        return; //TODO
    }

    throw new PluginError("invalid manifest type '%s'",options.type);
}

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
        const refs = this.settings.refs.slice();
        this.collectTargets(refs);

        const manifest = manifestFactory(refs,this.settings.manifest);
        const target = this.context.createTarget(this.settings.output);
        target.stream.end(await manifest.generate(this.context));

        await this.context.chain("write");
    }

    collectTargets(refs) {
        this.context.forEachTarget((target) => {
            let targetPath = target.getSourceTargetPath();

            if (this.settings.targets.some((glob) => minimatch(targetPath,glob))) {
                refs.push(targetPath);
            }
        });
    }
}

module.exports = {
    Kernel
};
