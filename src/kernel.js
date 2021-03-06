/**
 * kernel.js
 *
 * manifest (webdeploy plugin)
 */

const fs = require("fs");
const url = require("url");
const path = require("path");
const minimatch = require("minimatch");
const merge_refs = require("./merge");
const { promisify } = require("util");
const { JsonManifest } = require("./json");
const { HTMLManifest } = require("./html");
const { PHPManifest } = require("./php");
const { PluginError } = require("./error");
const { PluginSettings } = require("./settings");

const OUTPUT_CACHE_KEY = "manifest.output";

function manifestFactory(refs,options) {
    if (options.type == "json") {
        return new JsonManifest(refs,options);
    }

    if (options.type == "html") {
        return new HTMLManifest(refs,options);
    }

    if (options.type == "php") {
        return new PHPManifest(refs,options);
    }

    throw new PluginError("invalid manifest type '%s'",options.type);
}

function flatten_matrix(list) {
    let result = [];

    for (let i = 0;i < list.length;++i) {
        result = result.concat(list[i].refs);
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

function is_url(ref) {
    try {
        const result = new url.URL(ref);
    } catch (ex) {
        return false;
    }

    return true;
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
        let matrix = this.settings.refs.slice();
        this.buildMatrix(matrix);

        // Just write out if there's no manifest to generate.
        if (matrix.length == 0 && !(await this.isManifestOutOfDate())) {
            return this.context.chain("write");
        }

        // Augment the refs with previous output tracking information.
        if (!this.settings.disableTracking) {
            matrix = await this.preprocessOutput(matrix,this.settings.output);
        }

        // Generate the manifest.
        const list = flatten_matrix(matrix).map((record) => record.entry);
        const manifest = manifestFactory(list,this.settings.manifest);
        const target = this.context.createTarget(this.settings.output);
        target.stream.end(await manifest.generate(this.context));

        // Handle output.
        await this.context.chain("write");
        if (!this.settings.disableTracking) {
            await this.postprocessOutput(matrix,this.settings.output);
        }
    }

    buildMatrix(matrix) {
        const found = new Set();
        const isDev = this.context.isDevDeployment();

        // Process initial refs in matrix. Apply cache busting if configured.
        flatten_matrix(matrix).forEach((ref) => {
            // Do not process URLs.
            if (is_url(ref.file)) {
                return;
            }

            let target = this.context.lookupTarget(ref.file);
            if (target) {
                if (!isDev && this.checkCacheBusting(target)) {
                    const newName = apply_file_suffix(
                        target.getTargetName(),
                        this.suffix
                    );

                    target = this.context.passTarget(target,newName);
                    ref.entry = target.getSourceTargetPath();
                }

                ref.unlink = true;
                found.add(ref.entry);
            }
        });

        // Add in refs from matched targets. Apply cache busting if configured.
        if (this.settings.targets.length > 0) {
            this.context.forEachTarget((target) => {
                let targetPath = target.getSourceTargetPath();
                if (found.has(targetPath)) {
                    return;
                }

                if (this.settings.targets.some((glob) => minimatch(targetPath,glob))) {
                    let entry;
                    let originalPath = targetPath;
                    if (!isDev && this.checkCacheBusting(target)) {
                        const newName = apply_file_suffix(
                            target.getTargetName(),
                            this.suffix
                        );

                        const newTarget = this.context.passTarget(target,newName);
                        targetPath = newTarget.getSourceTargetPath();
                    }

                    // Each target implies its own singleton group of refs.
                    matrix.push({
                        key: matrix.length,
                        refs: [
                            {
                                file: originalPath,
                                entry: targetPath,
                                unlink: true
                            }
                        ]
                    });

                    found.add(targetPath);
                }
            });
        }
    }

    async loadPrevOutput(currentRefs) {
        const output = await this.context.readCacheProperty(OUTPUT_CACHE_KEY);
        if (!output
            || !output.refs
            || !Array.isArray(output.refs)
            || typeof output.manifest !== "string")
        {
            return null;
        }

        for (let i = 0;i < output.refs.length;++i) {
            const entry = output.refs[i];

            if (Array.isArray(entry)) {
                let key;

                // Try to match with row in current refs.

                const currentEntry = currentRefs.find((cur) => {
                    return cur.refs.some((a) => entry.some((b) => a.file === b.file));
                });

                if (currentEntry) {
                    key = currentEntry.key;
                }
                else {
                    key = i;
                }

                // Transform old array format into object format.
                output.refs[i] = {
                    key,
                    refs: entry
                };
            }
        }

        return output;
    }

    async preprocessOutput(refs,manifest) {
        let newlist = refs;
        const prev = await this.loadPrevOutput(refs);

        if (prev && prev.refs.length > 0) {
            newlist = merge_refs(this.context,refs,prev.refs,this.unlink);
        }

        if (prev && prev.manifest && prev.manifest != manifest) {
            this.unlink.push(prev.manifest);
        }

        return newlist;
    }

    async postprocessOutput(matrix,manifest) {
        const unlink = promisify(fs.unlink);
        for (let i = 0;i < this.unlink.length;++i) {
            const filepath = this.context.makeDeployPath(this.unlink[i]);
            try {
                await unlink(filepath);
                this.context.graph.removeConnectionGivenProduct(this.unlink[i]);
                this.context.logger.log("Unlinked _" + filepath + "_");
            } catch (err) {
                if (err.code != "ENOENT") {
                    throw err;
                }
            }
        }

        // Keep all non-empty rows from the ref matrix.
        let refs = [];
        for (let i = 0;i < matrix.length;++i) {
            if (matrix[i].refs.length > 0) {
                refs.push(matrix[i]);
            }
        }

        await this.context.writeCacheProperty(OUTPUT_CACHE_KEY, {
            refs,
            manifest
        });
    }

    async isManifestOutOfDate() {
        // We can only check manifests that have templates.
        if (!this.settings.manifest.template) {
            return false;
        }

        const prev = await this.context.readCacheProperty(OUTPUT_CACHE_KEY);
        if (!prev.manifest) {
            return false;
        }

        return this.context.isTargetOutOfDate(
            this.settings.manifest.template,
            this.settings.output
        );
    }

    checkCacheBusting(target) {
        if (!this.settings.cacheBusting) {
            return false;
        }

        if (this.settings.cacheBusting === true) {
            return true;
        }

        const source = target.getSourceTargetPath();

        let i = 0;
        while (i < this.settings.cacheBusting.length) {
            const entry = this.settings.cacheBusting[i++];

            if (entry instanceof RegExp) {
                if (source.match(entry)) {
                    return true;
                }
            }
            else if (minimatch(source,entry)) {
                return true;
            }
        }

        return false;
    }
}

module.exports = {
    Kernel
};
