/**
 * kernel.js
 *
 * manifest (webdeploy plugin)
 */

const fs = require("fs");
const path = require("path");
const minimatch = require("minimatch");
const merge_refs = require("./merge");
const { promisify } = require("util");
const { JsonManifest } = require("./json");
const { PluginError } = require("./error");
const { PluginSettings } = require("./settings");

const OUTPUT_CACHE_KEY = "manifest.output";

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

function flatten_refs(list) {
    let result = [];

    for (let i = 0;i < list.length;++i) {
        if (Array.isArray(list[i])) {
            result = result.concat(list[i]);
        }
        else {
            result.push(list[i]);
        }
    }

    return result;
}

function make_random_id(prefix,suffix) {
    prefix = prefix || "";
    suffix = suffix || "";

    return prefix+Math.floor(Math.random() * 10**20).toString(36)+suffix;
}

function apply_file_suffix(filePath,suffix) {
    const parsed = path.parse(filePath);
    parsed.name += suffix;
    return path.join(parsed.dir,parsed.name + parsed.ext);
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

        this.unlink = [];
        this.suffix = "." + make_random_id();
    }

    async exec() {
        let refs = this.settings.refs.slice();

        // Augment the extra refs with the target refs.

        refs = refs.concat(this.collectTargets());
        if (!this.settings.disableTracking) {
            refs = await this.preprocessOutput(refs,this.settings.output);
        }

        const saved = refs;

        refs = flatten_refs(refs);
        if (!this.settings.disableCacheBusting) {
            this.applyCacheBusting(refs);
        }

        refs = refs.map((record) => record.entry);

        const manifest = manifestFactory(refs,this.settings.manifest);
        const target = this.context.createTarget(this.settings.output);
        target.stream.end(await manifest.generate(this.context));

        await this.context.chain("write");
        if (!this.settings.disableTracking) {
            await this.postprocessOutput(saved,this.settings.output);
        }
    }

    collectTargets() {
        const targetRefs = [];
        if (this.settings.targets.length == 0) {
            return targetRefs;
        }

        this.context.forEachTarget((target) => {
            let targetPath = target.getSourceTargetPath();

            if (this.settings.targets.some((glob) => minimatch(targetPath,glob))) {
                // Each target implies its own singleton group of refs.
                targetRefs.push([{
                    file: targetPath,
                    entry: targetPath,
                    unlink: true,
                    target: target
                }]);
            }
        });

        return targetRefs;
    }

    async preprocessOutput(refs,manifest) {
        let newlist = refs;
        const prev = await this.context.readCacheProperty(OUTPUT_CACHE_KEY);

        if (prev && prev.refs && prev.refs.length > 0) {
            newlist = merge_refs(this.context,refs,prev.refs,this.unlink);
        }

        if (prev && prev.manifest && prev.manifest != manifest) {
            this.unlink.push(prev.manifest);
        }

        return newlist;
    }

    async postprocessOutput(refs,manifest) {
        const unlink = promisify(fs.unlink);
        for (let i = 0;i < this.unlink.length;++i) {
            const filepath = this.context.makeDeployPath(this.unlink[i]);
            try {
                await unlink(filepath);
                this.context.logger.log("Unlinked _" + filepath + "_");
            } catch (err) {
                if (err.code != "ENOENT") {
                    throw err;
                }
            }
        }

        await this.context.writeCacheProperty(OUTPUT_CACHE_KEY, {
            refs,
            manifest
        });
    }

    applyCacheBusting(refs) {
        for (let i = 0;i < refs.length;++i) {
            const ref = refs[i];

            if (ref.unlink) {
                if (ref.target) {
                    const newName = apply_file_suffix(
                        ref.target.getTargetName(),
                        this.suffix
                    );
                    const newTarget = this.context.passTarget(ref.target,newName);
                    ref.entry = newTarget.getSourceTargetPath();
                    delete ref.target;
                }
                else {
                    ref.entry = apply_file_suffix(ref.entry,this.suffix);
                }
            }
        }
    }
}

module.exports = {
    Kernel
};
