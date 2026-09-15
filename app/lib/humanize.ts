export type HumanizeCase = "title" | "sentence" | "lower" | "upper";

export interface HumanizeOptions {
  readonly case?: HumanizeCase;
  readonly fallback?: string;
  readonly acronyms?: readonly string[];
}

export const DEFAULT_HUMANIZE_ACRONYMS = [
  "API",
  "CSV",
  "HTML",
  "HTTP",
  "HTTPS",
  "ID",
  "IP",
  "JSON",
  "PDF",
  "SKU",
  "SQL",
  "UI",
  "URI",
  "URL",
  "UUID",
  "UX",
  "VAT",
] as const;

type HumanizeValue = string | number | bigint | null | undefined;

/**
 * Converts identifiers and enum-like values into human-readable text.
 *
 * @example
 * humanize("lastLoginAt") // "Last Login At"
 * humanize("IN_PROGRESS") // "In Progress"
 * humanize("product-sku") // "Product SKU"
 * humanize("apiResponseID") // "API Response ID"
 */
export function humanize(value: HumanizeValue, options: Readonly<HumanizeOptions> = {}): string {
  const { case: outputCase = "title", fallback = "", acronyms = [] } = options;

  if (value === null || value === undefined) return fallback;

  const input = String(value).trim();
  if (!input) return fallback;

  const acronymSet = new Set(
    [...DEFAULT_HUMANIZE_ACRONYMS, ...acronyms].map((item) => item.toUpperCase()),
  );

  const words = input
    // HTTPResponse -> HTTP Response
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    // lastLogin / version2Value -> last Login / version2 Value
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    // snake_case, kebab-case, dotted.paths, and slash/paths
    .replace(/[._/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

  if (words.length === 0) return fallback;

  if (outputCase === "lower") {
    return words.map((word) => word.toLowerCase()).join(" ");
  }

  if (outputCase === "upper") {
    return words.map((word) => word.toUpperCase()).join(" ");
  }

  const formatWord = (word: string, index: number): string => {
    const upperWord = word.toUpperCase();
    if (acronymSet.has(upperWord)) return upperWord;

    const lowerWord = word.toLowerCase();
    const shouldCapitalize = outputCase === "title" || index === 0;

    return shouldCapitalize
      ? `${lowerWord.charAt(0).toUpperCase()}${lowerWord.slice(1)}`
      : lowerWord;
  };

  return words.map((word, index) => formatWord(word, index)).join(" ");
}
