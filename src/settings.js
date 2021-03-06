/**
 * settings.js
 *
 * manifest (webdeploy plugin)
 */

const { format } = require("util");
const { PluginError } = require("./error");

function format_context(context,key) {
    if (typeof key === "number") {
        return format("%s[%d]",context,key);
    }

    return format("%s.%s",context,key);
}

function check_val(context,key,val,...types) {
    let type;
    if (Array.isArray(val)) {
        type = "array";
    }
    else if (val instanceof RegExp) {
        type = "regex";
    }
    else {
        type = typeof val;
    }

    if (type === "undefined") {
        throw new PluginError(
            "invalid config: missing '%s'",
            format_context(context,key)
        );
    }

    if (types.indexOf(type) < 0) {
        throw new PluginError(
            "invalid config: '%s' must be %s",
            format_context(context,key),
            types.join(" or ")
        );
    }

    return val;
}

function lookup_key(context,settings,name,optional) {
    const regex = "^" + name + "$";
    const key = Object.keys(settings).find((key) => key.match(regex));
    if (!key) {
        if (optional) {
            return;
        }

        throw new PluginError(
            "invalid config: missing '%s'",
            format_context(context,name)
        );
    }

    return key;
}

function check(context,settings,name,...types) {
    const key = lookup_key(context,settings,name);
    return check_val(context,key,settings[key],...types);
}

function check_array_impl(context,val,...types) {
    return val.map((elem,index) => check_val(context,index,elem,...types));
}

function check_array(context,settings,name,...types) {
    const key = lookup_key(context,settings,name);
    const val = settings[key];

    if (!Array.isArray(val)) {
        throw new PluginError(
            "invalid config: '%s' must be array of %s",
            format_context(context,key),
            types.join(" or ")
        );
    }

    return check_array_impl(format_context(context,key),val,...types);
}

function check_array_ensure(context,settings,name,...types) {
    const key = lookup_key(context,settings,name);
    const val = settings[key];

    if (!Array.isArray(val)) {
        check_val(context,key,val,...types);
        return [val];
    }

    return check_array_impl(context,val,...types);
}

function check_optional(fn,context,settings,name,defval,...types) {
    const key = lookup_key(context,settings,name,true);

    if (typeof key === "undefined") {
        return defval;
    }

    return fn(context,settings,name,...types);
}

class ManifestSettings {
    constructor(settings) {
        this.type = check("manifest",settings,"type","string");
    }
}

class JsonManifestSettings extends ManifestSettings {
    constructor(settings) {
        super(settings);

        this.template = check_optional(check,"manifest",settings,"template",false,"string");
        this.prop = check_optional(check,"manifest",settings,"prop","manifest","string");
    }
}

class HTMLManifestSettings extends ManifestSettings {
    constructor(settings) {
        super(settings);
        this.template = check("manifest",settings,"template","string");
    }
}

class PHPManifestSettings extends ManifestSettings {
    constructor(settings) {
        super(settings);

        this.prefixed = check_optional(check,"manifest",settings,"prefixed",false,"boolean");
        this.extra = check_optional(check,"manifest",settings,"extra",null,"object");
    }
}

class PluginSettings {
    constructor(settings) {
        this.output = check("settings",settings,"output","string");
        this.manifest = check_optional(
            check,
            "settings",
            settings,
            "manifest",
            { type: "json" },
            "object"
        );
        check("manifest",this.manifest,"type","string");
        if (this.manifest.type == "json") {
            this.manifest = new JsonManifestSettings(this.manifest);
        }
        else if (this.manifest.type == "html") {
            this.manifest = new HTMLManifestSettings(this.manifest);
        }
        else if (this.manifest.type == "php") {
            this.manifest = new PHPManifestSettings(this.manifest);
        }
        else {
            throw new PluginError("manifest.type '%s' is not supported",this.manifest.type);
        }
        this.manifest.output = this.output;

        this.targets = check_optional(
            check,
            "settings",
            settings,
            "targets?",
            [],
            "string","array"
        );
        if (!Array.isArray(this.targets)) {
            this.targets = [this.targets];
        }
        check_array("settings",this,"targets","string");

        this.refs = check_optional(
            check_array,
            "settings",
            settings,
            "refs",
            [],
            "string","array","object"
        );

        this.groups = check_optional(
            check,
            "settings",
            settings,
            "groups",
            false,
            "object","array"
        );
        if (Array.isArray(this.groups)) {
            check_array("settings",this,"groups","object");
        }
        else {
            this.groups = [this.groups];
        }
        this.manifest.groups = this.groups;

        this.disableTracking = check_optional(
            check,
            "settings",
            settings,
            "disableTracking",
            false,
            "boolean"
        );

        // DEPRECATED
        this.disableCacheBusting = check_optional(
            check,
            "settings",
            settings,
            "disableCacheBusting",
            false,
            "boolean"
        );

        this.cacheBusting = check_optional(
            check,
            "settings",
            settings,
            "cacheBusting",
            [/\.js$/,/\.css$/],
            "boolean",
            "array"
        );

        if (Array.isArray(this.cacheBusting)) {
            this.cacheBusting = check_array(
                "settings",
                this,
                "cacheBusting",
                "string","regex"
            );
        }

        if (this.disableCacheBusting) {
            this.cacheBusting = false;
        }
        delete this.disableCacheBusting;

        this._normalizeRefs();
    }

    _normalizeRefs() {
        // Ensure "refs" is a list of lists (maximum of 1-level).

        for (let i = 0;i < this.refs.length;++i) {
            const ctx = format_context("settings.refs",i);
            let ref = this.refs[i];

            if (Array.isArray(ref)) {
                check_array(ctx,this.refs,i,"string");
                for (let j = 0;j < ref.length;++j) {
                    ref[j] = { file:ref[j], entry:ref[j], unlink:false };
                }

                this.refs[i] = { key:i, refs:ref };
            }
            else if (typeof ref === "object") {
                if (!ref.key || !ref.refs) {
                    throw new PluginError("'%s' missing 'key' and/or 'refs' properties",ctx);
                }

                if (typeof ref.key !== "string" || ref.key.match(/^[0-9]+$/)) {
                    throw new PluginError("'%s' is malformed: key '%s' is invalid",ctx,ref.key);
                }

                check_array(ctx,ref,"refs","string");

                let refs = [];
                for (let j = 0;j < ref.refs.length;++j) {
                    refs.push({ file:ref.refs[j], entry:ref.refs[j], unlink:false });
                }

                this.refs[i] = { key:ref.key, refs };
            }
            else {
                this.refs[i] = { key:i, refs:[{ file:ref, entry:ref, unlink:false }] };
            }
        }
    }
}

module.exports = {
    PluginSettings
};
