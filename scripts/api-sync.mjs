// Refreshes openapi/openapi.yaml from stock-flow-api's main (ADR 0004).
import { writeFile } from "node:fs/promises";

const url = "https://raw.githubusercontent.com/thawatchaiUdjan/stock-flow-api/main/openapi.yaml";

const response = await fetch(url);
if (!response.ok) {
  throw new Error(`api:sync: ${url} answered ${response.status}`);
}
await writeFile("openapi/openapi.yaml", await response.text());
