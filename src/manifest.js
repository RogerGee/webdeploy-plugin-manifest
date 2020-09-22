/**
 * manifest.js
 *
 * manifest (webdeploy plugin)
 */

const minimatch = require("minimatch");

class ManifestBase {
    constructor(refs,options) {
        this.refs = refs;
        this.options = options;
    }

    // async generate()

    createManifest() {
        if (this.options.groups) {
            const manifest = {};
            for (let key in this.options.groups) {
                manifest[key] = [];
            }

            for (let i = 0;i < this.refs.length;++i) {
                for (let key in this.options.groups) {
                    if (minimatch(this.refs[i],this.options.groups[key])) {
                        manifest[key].push(this.refs[i]);
                    }
                }
            }

            return manifest;
        }

        return this.refs;
    }

    async getTemplate(context) {
        let target = context.lookupTarget(this.options.template);
        if (target) {
            // Remove the target from the context.
            context.removeTargets(target);

            // Add a simple dependency connection.
            context.graph.addConnection(this.options.template,this.options.output);
        }
        else {
            target = context.createTargetFromTree(this.options.template,false);
        }

        return target;
    }
}

module.exports = {
    ManifestBase
};
