# ts-module-export-map

### What is it

ts-module-export-map is a small tool to determine what your TypeScript module exports.

Ofcourse you could `require('module')` or `import * as myModule from 'module'` and iterate over the enumerable properties, 
but that would only include symbols (exports) that are available runtime.

This tool also includes TypeScript specific entities such as `enum`, `interface` and `types`.

This tool also provides insights in the intermediate files between the declaration of the symbol (export) and the entrypoint.
This feature is particularly useful if you have (a lot of) files that re-export such as 
`export * from './directory/module'`

### Features

- Only follows symbols that are available in the entry point (it respects partial exports such as `export { iAmReExported } from './partial-export';`, where more symbols are exported in `'./partial-export'`)
- Supports most (if not all) [ways of declaring an export](https://developer.mozilla.org/en-US/docs/web/javascript/reference/statements/export#syntax)
- Supports exported functions, interfaces, enums, vars, lets, consts
- Supports `tsConfig.compilerOptions.paths` aliases (if you use `--tsConfigJson`)
- Supports both `.ts` and `.tsx` files

### Limitations

- Anything that is re-exported from a node_module package is ignored
- Only takes a single entry point
- Reports back paths, not aliases
- Has only been tested on `typescript` version `3.5.3`. It might work on other versions, but I haven't tested it.
- Symbols with the same name are ignored (if `const foo` is declared in multiple files you'll get weird results)

### Usage

This project has NOT been published to NPM yet.

If you'd like to use this in your own project, the best approach would be to copy the files under [./src](./src) to your own project
and run it using [ts-node](https://www.npmjs.com/package/ts-node). The other required dependencies are `yargs` and `typescript`.

In the `tsconfig.json` make sure to add this configuration or the script will not run:
```json
  "ts-node": {
    "compilerOptions": {
      "module": "commonjs"
    }
  }
```

Then on the command line run the script (the location of `main.ts` and `tsconfig.json` and the `entry-module.ts` may be different):

`$ ts-node ./src/main.ts --tsConfigJson=./tsconfig.json ./entry-module.ts`

If you want to write the results to a JSON file you can do so using `--outputJson`. Note: make sure the directory already exists!

`$ ts-node ./src/main.ts --tsConfigJson=./tsconfig.json --outputJson=./tmp/output.json /entry-module.ts`

If you do not want any output to the console you can add the `--silent` flag.

For best performance, first run `yarn build` and then use the compiled js version

`$ node ./dist/main.js --tsConfigJson=./tsconfig.json --outputJson=./tmp/output.json /entry-module.ts`

### Example

Given this directory structure (see [./test](./test))
```
| - entry.ts
| - nothing-exported.ts
| - barrel/
| --- index.ts
| --- partial-export/
| ------ index.ts
```

The output would be:

```json
{
  "iAmReExported": {
      "originalLocation": "/test/barrel/partial-export/index.ts",
      "reExportPath": [
        "test/entry.ts",
        "test/barrel/index.ts",
        "/test/barrel/partial-export/index.ts"
      ],
      "kind": "VariableStatement"
    },
  "baz": {
      "originalLocation": "test/entry.ts",
      "reExportPath": [
        "test/entry.ts"
      ],
      "kind": ""
    },
    "foo": {
      "originalLocation": "/test/barrel2/inner/foo.ts",
      "reExportPath": [
        "test/entry.ts",
        "/test/barrel2/index.ts",
        "/test/barrel2/inner/index.ts",
        "/test/barrel2/inner/foo.ts"
      ],
      "kind": "VariableStatement"
    },
  "a": {
      "originalLocation": "test/entry.ts",
      "reExportPath": [
        "test/entry.ts"
      ],
      "kind": "VariableStatement"
    },
    "bAlias": {
      "originalLocation": "test/entry.ts",
      "reExportPath": [
        "test/entry.ts"
      ],
      "kind": "VariableStatement"
    }
}


```
