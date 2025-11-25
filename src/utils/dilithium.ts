import {
  generateDilithiumKeyPair as generateDilithiumKeyPairJs,
  sign as signJs,
  verify as verifyJs,
} from "./dilithium.js";

type DilithiumKeyPair = {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
};

export async function generateDilithiumKeyPair(): Promise<DilithiumKeyPair> {
  return generateDilithiumKeyPairJs();
}

export async function sign(
  message: Uint8Array,
  privateKey: Uint8Array
): Promise<Uint8Array> {
  return signJs(message, privateKey);
}

export async function verify(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  return verifyJs(message, signature, publicKey);
}
