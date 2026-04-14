import fs from "fs/promises";
import path from "path";
import { ingestPDF } from "../ingest";
import { vectorStore } from "../vector-store";
import { buildGraph, saveGraph } from "../graph";
import { config } from "../config";

async function main() {
  const rawDir = config.paths.rawDocs;
  console.log(`\nScanning ${rawDir} for PDFs...\n`);
  let files: string[];
  try {
    files = (await fs.readdir(rawDir)).filter((f) => f.toLowerCase().endsWith(".pdf"));
  } catch {
    console.error(`Directory not found: ${rawDir}`);
    process.exit(1);
  }
  if (files.length === 0) { console.log("No PDFs found."); process.exit(0); }
  console.log(`Found ${files.length} PDF(s):\n`);

  for (const file of files) {
    const buffer = await fs.readFile(path.join(rawDir, file));
    console.log(`Processing: ${file}`);
    const result = await ingestPDF(buffer, file);
    console.log(`  Pages: ${result.totalPages} | Chunks: ${result.totalChunks}`);
    console.log(`  Embedding...`);
    await vectorStore.indexChunks(result.chunks, (done, total) => {
      process.stdout.write(`\r  ${done}/${total}`);
    });
    console.log(`\n  Done.\n`);
  }

  console.log("Rebuilding cross-reference graph...");
  await vectorStore.refresh();
  const graph = await buildGraph();
  await saveGraph(graph);
  console.log(`  Graph: ${graph.nodes.length} nodes, ${graph.edges.length} edges.\n`);

  console.log(`\nIngestion complete. Ready for queries.\n`);
}
main().catch((e) => { console.error(e); process.exit(1); });
