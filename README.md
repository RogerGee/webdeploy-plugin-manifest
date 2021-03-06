# manifest (webdeploy plugin)

> Deploy plugin to generate manifests from output file references

## Synopsis

The manifest deploy plugin is used for generating application or library manifests (e.g. JSON or HTML file). A manifest is designed to provide references to files required by an application at runtime. These files typically are the product of a previous deployment step.

The plugin automatically tracks manifest files to allow for incremental deployments, unlinking old files with different names.

## Install

~~~
npm install --save-dev @webdeploy/plugin-manfiest
~~~

## Config

### `output`

- Type: `string`
- Required

Denotes the path and name of the output target that will be created for the manifest. The manifest target is not created if the list of refs is empty.

### `manifest`

- Type: `{ type: string, ...typeSpecificOptions }`
- Default: `{ type: "json" }`

Denotes the manifest type to generate. The following options are supported:
- `json`: Generates a `.json` file containing the file references
- `html`: Generates a `.html` file from a template
- `php`: Generates a `.php` file that returns an array representing the manifest

#### `{ type: "json" [, template: "<file>", prop: "manifest"] }`

The `json` manifest type generates a JSON representation of the manifest. Optionally, you can specify a `template` to use for the top-level object, in which case the manifest will be generated as a property on this object. The property name for the manifest may be specified via `prop` and defaults to `manifest`.

#### `{ type: "html", template: "<file>" }`

The `html` manifest type generates an HTML page representation of the manifest. You must specify a `template` target that will be evaluated using [Markup.js](https://github.com/adammark/Markup.js/). Your template should use the `manifest` variable to write out references. This is a list of refs if `groups` is undefined; otherwise it's a dictionary keyed by groups.

Example template (using grouped manifest):

~~~html
<!doctype>
<html>
  <head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="ID=edge,chrome=1">
    <title>A Title</title>
    {{manifest.styles}}<link rel="stylesheet" href="{{.}}">{{/manifest.styles}}
  </head>
  <body>
    <div id="app"></div>
    {{manifest.scripts}}<script src="{{.}}"></script>{{/manifest.scripts}}
    <script>
       var app = new MyApp();
       app.run();
    </script>
  </body>
</html>
~~~

#### `{ type: "php", prefixed: false, extra: {} }`

The `php` manifest type generates a PHP source code file that returns manifest as a PHP array. The array structure is indexed if no `groups` are defined and associative when `groups` are present. You can use the manifest like so:

~~~php
$manifest = require "path/to/manifest.php";
~~~

Each value in the array is a file reference. The value is keyed by groups if `groups` are defined.

If `prefixed` is `true`, then each manifest entry will be keyed by file name structure under a nested structure by path. For example, the reference `a/b/c.file.js` will appear in the manifest under `$manifest['a']['b']['c']`. If a reference has a URL structure (e.g. begins with `https://`), then it will be stored as an indexed element in the top-level bucket. Prefixed entries work exactly the same when `groups` are defined, except the top-level bucket is stored under the group bucket (e.g. `$manifest['group']['a']['b']['c']`).

You can inject custom values into a PHP manifest using the `extra` property. The plugin will do its best to render each property as a PHP value in the array.

Example (grouped, prefixed, with extra):

~~~javascript
{ type: "php", prefixed: true, extra: { numbers:[1,2,3,4,5] }
~~~

~~~php
return array(
  'numbers' => array(1, 2, 3, 4, 5),
  'scripts' => array(
    'dist' => array(
      'scripts' => array(
        'app' => 'dist/scripts/app.min.js',
      ),
    ),
  ),
  'styles' => array(
    'dist' => array(
      'styles' => array(
        'app' => 'dist/styles/app.min.css',
      ),
    ),
  ),
);
~~~

### `targets`, `target`

- Type: `string | string[]`
- Default: `false`

Enables target matching using glob patterns. Matched targets are included in the manifest.

### `refs`

- Type: `<string|object|string[]>[]`
- Default: `false`

Note: this option is designed to be used by other deploy plugins; you should avoid using it directly in your `webdeploy.config.js` file.

Provides a way to include extra refs in the manifest. The list of extra refs is denoted using a 2D matrix. Each row in the matrix represents a group of refs that are dependent on one another or otherwise grouped. If you specify a string for a row, then it will be automatically converted into a singleton group.

When a row is updated from a previous deployment, any refs not found in the current version of the row are removed from the manifest. If a ref refers to an output target generated by `webdeploy` and has a different name, it is unlinked under the deploy path as well. (This is useful for removing old files that have been removed from a deployment or that had a name update due to cache-busting.)

Rows from a previous deployment are matched by original file name. A row of refs is selected for comparison if any ref in the current row matches a ref in the previous row. To allow for a more precise selection, you may pass an `object` having the structure `{ key, refs }` for a row. When a `key` is provided, the row is only matched with a previous row that has the same key. This allows for selection irregardless of the ref file names themselves.

If a ref is up for removal and did _not_ refer to a target generated by `webdeploy`, then it will not be unlinked from the file system. It will only be removed from future manifests.

### `groups`

- Type: `object|object[]`
- Default: `false`

Defines manifest groups used to organize refs in a manifest. If this property is omitted, then the manifest is simply a list of refs. Otherwise, the manifest is a dictionary mapping group to list of refs.

Membership in a group is determined by the value of each property in `groups`. The value can be either a scalar or list of glob patterns to use to match the selected manifest refs. If you provide an array of objects for `groups`, then the groups defined by each object are evaluated in array order.

When a ref is assigned to a group, it is consumed and cannot be assigned to another group.

### `disableTracking`

- Type: `boolean`
- Default: `false`

Disables the behavior where manifest file references are tracked and previous manifest files having different file names are automatically unlinked. This is useful when chaining from a plugin that already implements its own tracking behavior.

### `cacheBusting`

- Type: `Array<string|RegExp>|boolean`
- Default: `[/\.js$/,/\.css$/]`

The plugin can rewrite file names of output targets for the purposes of cache busting. The buster works by injecting a random sequence before the file extension. For example, `app.js` becomes `app.64vx62yf66400.js`. Only manifest references that refer to actual output targets are modified. Additional refs (e.g. URLs to external assets) are not modified.

This property is used to denote which output targets get cache-busting applied. By default, any target ending in `.css` or `.js` is modified. You can supply an array of patterns to match or `true` to match all targets. Passing `false` disables cache-busting. Patterns may either be a `RegExp` (for regular expression matching) or a `string` (for glob matching via `minimatch`).

### `disableCacheBusting` (DEPRECATED)

<mark>This property is deprecated as of `1.1.0` and will be removed in the next major version. Use `cacheBusting` instead.</mark>

- Type: `boolean`
- Default: `false`

By default, the plugin will modify file names when running a production deployment (via `webdeploy deploy`). The buster works by injecting a random sequence before the file extension. For example, `app.js` becomes `app.64vx62yf66400.js`.

### Example:

~~~javascript
{
  id: "manifest",
  type: "json",
  targets: "dist/**",
  refs: ["node_modules/@org/package/dist/styles.css"],
  groups: {
    scripts: "**/*.js",
    styles: "**/*.css"
  }
}
~~~

