import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from "@mysten/sui/jsonRpc";

const NETWORK = (process.env.SUI_NETWORK ?? "testnet") as
  | "mainnet"
  | "testnet"
  | "devnet"
  | "localnet";

async function main() {
  const client = new SuiJsonRpcClient({
    url: getJsonRpcFullnodeUrl(NETWORK),
    network: NETWORK,
  });

  const [chainId, latest, refGas] = await Promise.all([
    client.getChainIdentifier({}),
    client.getLatestCheckpointSequenceNumber({}),
    client.getReferenceGasPrice({}),
  ]);
  const checkpoint = await client.getCheckpoint({ id: latest });

  console.log(JSON.stringify({
    network: NETWORK,
    chainId,
    latestCheckpoint: latest,
    checkpointTimestampMs: checkpoint.timestampMs,
    referenceGasPrice: refGas.toString(),
  }, null, 2));
}

main().catch((err) => {
  console.error("[book] fatal:", err);
  process.exit(1);
});
