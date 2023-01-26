import { build, BuildOptions } from "esbuild";
import { solidPlugin } from "esbuild-plugin-solid";
import { minify } from "terser";
import { worker } from "workerpool";
import fsExtra from "fs-extra";
const { writeFile, unlink, readFile } = fsExtra;

/**
 */
export async function postBuild(filePath: string) {
  // build the tsx file with esbuild and terser
  await Promise.all([buildFile(filePath, "esm"), buildFile(filePath, "cjs")]);

  // remove the tsx file
  await unlink(filePath);
}

const esbuildOptions: BuildOptions = {
  bundle: true,
  minify: false,
  sourcemap: true,
  target: "es2021",
  write: true,
};

async function buildFile(filePath: string, format: "esm" | "cjs") {
  const outFile = filePath.replace(".ts", format === "esm" ? ".js" : ".cjs");
  const mapFile = outFile + ".map";

  const buildResult = await build({
    ...{ ...esbuildOptions, entryPoints: [filePath] },
    format,
    outfile: outFile,
    plugins: [solidPlugin({ babel: { compact: true } })],
  });

  if (buildResult.errors.length > 0) {
    throw new Error(buildResult.errors.join("\n"));
  }

  // minify the generated file using terser
  const builtContent = await readFile(outFile, "utf-8");
  const { code, map } = await minify(builtContent, {
    sourceMap: {
      filename: mapFile,
    },
    module: true,
    compress: {
      ecma: 2020,
      toplevel: true,
      hoist_vars: false,
      hoist_funs: true,
      pure_getters: true,
      unsafe: true,
      unsafe_arrows: true,
      unsafe_comps: true,
      unsafe_Function: true,
      unsafe_math: true,
      unsafe_symbols: true,
      unsafe_methods: true,
      unsafe_proto: true,
      unsafe_regexp: true,
      unsafe_undefined: true,
      passes: 1,
    },
    mangle: true,
    parse: {
      ecma: 2020,
    },
  });

  if (!code || typeof map !== "string") {
    throw new Error("No minified code or map");
  }

  await writeFile(outFile, code);
  await writeFile(mapFile, map);
}

worker({
  postBuild,
});
