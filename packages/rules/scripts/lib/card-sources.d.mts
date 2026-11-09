/** Types for `card-sources.mjs` (zero-dependency source scan shared by scripts and tests). */
export declare const PKG_DIR: string;
export declare const REPO_ROOT: string;
export declare const CARDS_DIR: string;
export declare function walkTs(dir: string): string[];
export interface CustomIdSource {
  id: string;
  kind: "condition" | "effect";
  files: string[];
}
export declare function scanCardSources(dir?: string): {
  files: string[];
  names: Map<string, string[]>;
  customIds: Map<string, CustomIdSource>;
};
export declare function scanCustomIds(files: string[]): Array<{ id: string; kind: "condition" | "effect"; file: string }>;
