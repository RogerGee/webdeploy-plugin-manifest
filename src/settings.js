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

    return check_array_impl(context,val,...types);
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
            "string"
        );

        this.groups = check_optional(
            check,
            "settings",
            settings,
            "groups",
            false,
            "object"
        );
        this.manifest.groups = this.groups;

        this.disableTracking = check_optional(
            check,
            "settings",
            settings,
            "disableTracking",
            false,
            "boolean"
        );
    }
}

module.exports = {
    PluginSettings
};
