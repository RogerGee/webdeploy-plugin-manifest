/**
 * manifest.js
 *
 * manifest (webdeploy plugin)
 */

const xpath = require("path").posix;
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

            const options = {
                dot: true
            };

            for (let i = 0;i < this.refs.length;++i) {
                for (let key in this.options.groups) {
                    const matchref = xpath.resolve("/",this.refs[i]).slice(1);
                    if (minimatch(matchref,this.options.groups[key],options)) {
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
