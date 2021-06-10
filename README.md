# {Project-name}

### What is it

{Project-name} is a small tool to determine what your TypeScript module exports.

Ofcourse you could `require('module')` or `import * as myModule from 'module'` and iterate over the enumerable properties, 
but that would only include symbols (exports) that are available runtime.

This tool also includes TypeScript specific entities such as `enum`, `interface` and `types`.

This tool also provides insights in the intermediate files between the declaration of the symbol (export) and the entrypoint.
This feature is particularly useful if you have (a lot of) files that re-export such as 
`export * from './directory/module'`

### Features

- Only follows symbols that are available in the entry point (it respects partial exports such as `export { iAmReExported } from './partial-export';`, where more exports are defined in `'./partial-export'`)
- Supports most (if not all) [ways of declaring an export](https://developer.mozilla.org/en-US/docs/web/javascript/reference/statements/export#syntax)
- Supports exported functions, interfaces, enums, vars, lets, consts
- Supports `tsConfig.compilerOptions.paths` aliases (if you use `--tsConfigJson`)

### Limitations

- Anything that is re-exported from a node_module package is ignored
- Only takes a single entry point
- Reports back paths, not aliases

### Usage

`yarn ts-module-export-map --tsConfigJson=./tsconfig.json ./entry-module.ts`

### Example

Given this directory structure (see [./src/test](./src/test))
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
    "originalLocation": "/src/test/barrel/partial-export/index.ts",
    "reExportPath": [
      "/src/test/entry.ts",
      "/src/test/barrel/index.ts",
      "/src/test/barrel/partial-export/index.ts"
    ]
  },
  "baz": {
    "originalLocation": "/src/test/entry.ts",
    "reExportPath": [
      "/src/test/entry.ts"
    ]
  },
  "foo": {
    "originalLocation": "/src/test/entry.ts",
    "reExportPath": [
      "/src/test/entry.ts"
    ]
  },
  "a": {
    "originalLocation": "/src/test/entry.ts",
    "reExportPath": [
      "/src/test/entry.ts"
    ]
  },
  "bAlias": {
    "originalLocation": "/src/test/entry.ts",
    "reExportPath": [
      "/src/test/entry.ts"
    ]
  }
}


```
