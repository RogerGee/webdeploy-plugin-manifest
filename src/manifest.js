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
            for (let i = 0;i < this.options.groups.length;++i) {
                for (let key in this.options.groups[i]) {
                    manifest[key] = [];
                }
            }

            const options = {
                dot: true
            };

            const refs = this.refs.slice();

            for (let i = 0;i < this.options.groups.length;++i) {
                for (let key in this.options.groups[i]) {
                    for (let j = 0;j < refs.length;++j) {
                        if (!refs[j]) {
                            continue;
                        }

                        const matchref = xpath.resolve("/",refs[j]).slice(1);
                        if (minimatch(matchref,this.options.groups[i][key],options)) {
                            manifest[key].push(refs[j]);
                            refs[j] = null;
                        }
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
