const trie = require("@ethereumjs/trie");
const util = require("ethereumjs-util");
const ethers = require("ethers");

async function fetchAccountProof(msgHash, slot, safeAddress, provider) {
  const paddedMsgHash = ethers.utils.hexZeroPad(msgHash, 32);
  const paddedSlot = ethers.utils.hexZeroPad(slot, 32);
  const concatenated = ethers.utils.concat([paddedMsgHash, paddedSlot]);

  const storageKey = ethers.utils.keccak256(concatenated);

  const fetch = (await import("node-fetch")).default;
  const response = await fetch(provider, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "eth_getProof",
      params: [safeAddress, [storageKey], "latest"],
      id: 1,
    }),
  });

  const data = await response.json();
  return data.result;
}

async function main() {
  const arguments = process.argv.slice(2);
  const safeAddress = arguments[0];
  const msgHash = arguments[1];
  const provider = arguments[2];
  const slot = "0x7"; // position of signedMessages mapping

  try {
    const ethProof = await fetchAccountProof(
      msgHash,
      slot,
      safeAddress,
      provider,
    );
    const storageTrie = new trie.Trie({
      root: util.toBuffer(ethProof.storageHash),
      useKeyHashing: true,
    });

    await storageTrie.fromProof(
      ethProof.storageProof[0].proof.map((p) => util.toBuffer(p)),
    ); // add proof to trie

    const paddedSlot = ethers.utils.hexZeroPad(slot, 32);
    const concatenated = ethers.utils.concat([msgHash, paddedSlot]); // concat for right storage position
    const storageKey = ethers.utils.keccak256(concatenated);

    const isSignedVa = await storageTrie.get(util.toBuffer(storageKey), true); // try to get signedValue from trie
    const isSignedValue = ethers.utils.RLP.decode(util.bufferToHex(isSignedVa));

    console.log("SAFE Address: ", safeAddress);
    console.log("MsgHash: ", msgHash);
    console.log("Is signed :", isSignedValue);
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
