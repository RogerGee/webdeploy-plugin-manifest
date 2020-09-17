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
        let target = context.lookupTarget(this.template);
        if (target) {
            return target;
        }

        return context.createTargetFromTree(this.options.template,false);
    }
}

module.exports = {
    ManifestBase
};
