import { readFile, writeFile } from "node:fs/promises";

const { repository, ref } = JSON.parse(await readFile("openapi/api-source.json", "utf8"));
if (repository !== "thawatchaiUdjan/stock-flow-api" || !/^[a-f0-9]{40}$/.test(ref)) {
  throw new Error("api:sync: api-source.json must name stock-flow-api and a full commit SHA");
}
const url = `https://raw.githubusercontent.com/${repository}/${ref}/openapi.yaml`;

const response = await fetch(url);
if (!response.ok) {
  throw new Error(`api:sync: ${url} answered ${response.status}`);
}
await writeFile("openapi/openapi.yaml", await response.text());
