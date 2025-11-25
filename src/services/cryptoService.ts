import { db } from "../firebase";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { generateKyberKeyPair, encapsulate, decapsulate } from "../utils/kyber";
import { generateDilithiumKeyPair, sign, verify } from "../utils/dilithium";
import { encrypt, decrypt, deriveKey } from "../utils/aes";

// Firestore collection names
const USERS_COLLECTION = "users";
const MESSAGES_COLLECTION = "messages";

/**
 * Interface for user's cryptographic keys
 */
export interface UserKeys {
  kyberPublicKey: Uint8Array;
  kyberPrivateKey: Uint8Array;
  dilithiumPublicKey: Uint8Array;
  dilithiumPrivateKey: Uint8Array;
}

/**
 * Interface for encrypted message data
 */
interface EncryptedPayload {
  ciphertext: Uint8Array;
  iv: Uint8Array;
  tag: Uint8Array;
  encapsulatedKey: Uint8Array;
}

interface StoredEncryptedPayload {
  ciphertext: number[];
  iv: number[];
  tag: number[];
  encapsulatedKey: number[];
}

interface StoredEncryptedMessage {
  payloads: Record<string, StoredEncryptedPayload>;
  signature: number[];
  senderId: string;
  recipientId: string;
  timestamp: number;
  conversationId: string;
  visibleTo: string[];
}

/**
 * Deterministically build a conversation id from two user ids
 */
export function getConversationId(userA: string, userB: string): string {
  return [userA, userB].sort().join(":");
}

async function buildEncryptedPayload(
  message: string,
  publicKey: Uint8Array
): Promise<EncryptedPayload> {
  const { ciphertext: encapsulatedKey, sharedSecret } = await encapsulate(
    publicKey
  );
  const aesKey = await deriveKey(sharedSecret);
  const { ciphertext, iv, tag } = await encrypt(message, aesKey);

  return {
    ciphertext,
    iv,
    tag,
    encapsulatedKey,
  };
}

function serializePayload(payload: EncryptedPayload) {
  return {
    ciphertext: Array.from(payload.ciphertext),
    iv: Array.from(payload.iv),
    tag: Array.from(payload.tag),
    encapsulatedKey: Array.from(payload.encapsulatedKey),
  };
}

/**
 * Generates and stores cryptographic keys for a user
 * @param {string} userId - The user's ID
 * @returns {Promise<UserKeys>} The generated keys
 */
export async function initializeUserKeys(userId: string): Promise<UserKeys> {
  try {
    // Check if user already has keys
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (userDoc.exists() && userDoc.data().kyberPublicKey) {
      // Convert stored keys back to Uint8Array
      const data = userDoc.data();
      return {
        kyberPublicKey: new Uint8Array(data.kyberPublicKey),
        kyberPrivateKey: new Uint8Array(data.kyberPrivateKey),
        dilithiumPublicKey: new Uint8Array(data.dilithiumPublicKey),
        dilithiumPrivateKey: new Uint8Array(data.dilithiumPrivateKey),
      };
    }

    // Generate new key pairs
    const kyberKeys = await generateKyberKeyPair();
    const dilithiumKeys = await generateDilithiumKeyPair();

    // Store keys in Firestore
    await setDoc(doc(db, USERS_COLLECTION, userId), {
      kyberPublicKey: Array.from(kyberKeys.publicKey),
      kyberPrivateKey: Array.from(kyberKeys.privateKey),
      dilithiumPublicKey: Array.from(dilithiumKeys.publicKey),
      dilithiumPrivateKey: Array.from(dilithiumKeys.privateKey),
      createdAt: Date.now(),
    });

    return {
      kyberPublicKey: kyberKeys.publicKey,
      kyberPrivateKey: kyberKeys.privateKey,
      dilithiumPublicKey: dilithiumKeys.publicKey,
      dilithiumPrivateKey: dilithiumKeys.privateKey,
    };
  } catch (error) {
    console.error("Error initializing user keys:", error);
    throw new Error("Failed to initialize user keys");
  }
}

/**
 * Retrieves a user's public keys from Firestore
 * @param {string} userId - The user's ID
 * @returns {Promise<{kyberPublicKey: Uint8Array, dilithiumPublicKey: Uint8Array}>} The user's public keys
 */
export async function getUserPublicKeys(userId: string): Promise<{
  kyberPublicKey: Uint8Array;
  dilithiumPublicKey: Uint8Array;
}> {
  try {
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (!userDoc.exists()) {
      throw new Error("User not found");
    }

    const data = userDoc.data();
    return {
      kyberPublicKey: new Uint8Array(data.kyberPublicKey),
      dilithiumPublicKey: new Uint8Array(data.dilithiumPublicKey),
    };
  } catch (error) {
    console.error("Error getting user public keys:", error);
    throw new Error("Failed to get user public keys");
  }
}

/**
 * Sends an encrypted message to a recipient
 * @param {string} message - The plaintext message
 * @param {string} senderId - The sender's ID
 * @param {string} recipientId - The recipient's ID
 * @param {UserKeys} senderKeys - The sender's keys
 * @returns {Promise<string>} The ID of the sent message
 */
export async function sendEncryptedMessage(
  message: string,
  senderId: string,
  recipientId: string,
  senderKeys: UserKeys
): Promise<string> {
  try {
    // Get recipient's public keys
    const recipientKeys = await getUserPublicKeys(recipientId);

    const conversationId = getConversationId(senderId, recipientId);
    // Create payloads for recipient and sender so both can decrypt from any device
    const recipientPayload = await buildEncryptedPayload(
      message,
      recipientKeys.kyberPublicKey
    );
    const senderPayload = await buildEncryptedPayload(
      message,
      senderKeys.kyberPublicKey
    );
    // Sign the plaintext message
    const messageBytes = new TextEncoder().encode(message);
    const signature = await sign(messageBytes, senderKeys.dilithiumPrivateKey);

    // Create the message document
    const messageData: EncryptedMessage = {
      payloads: {
        [recipientId]: recipientPayload,
        [senderId]: senderPayload,
      },
      signature,
      senderId,
      recipientId,
      timestamp: Date.now(),
      conversationId,
      visibleTo: [senderId, recipientId],
    };

    // Store the encrypted message in Firestore
    const messageRef = await addDoc(collection(db, MESSAGES_COLLECTION), {
      ...messageData,
      payloads: Object.fromEntries(
        Object.entries(messageData.payloads).map(([userId, payload]) => [
          userId,
          serializePayload(payload),
        ])
      ),
      visibleTo: messageData.visibleTo,
      signature: Array.from(signature),
    });

    return messageRef.id;
  } catch (error) {
    console.error("Error sending encrypted message:", error);
    throw new Error("Failed to send encrypted message");
  }
}

/**
 * Decrypts and verifies a received message
 * @param {EncryptedMessage} encryptedMessage - The encrypted message data
 * @param {UserKeys} recipientKeys - The recipient's keys
 * @returns {Promise<{message: string, senderId: string}>} The decrypted message and sender ID
 */
export async function decryptMessage(
  encryptedMessage: StoredEncryptedMessage,
  recipientKeys: UserKeys,
  viewerId: string
): Promise<{ message: string; senderId: string }> {
  try {
    const payload = encryptedMessage.payloads?.[viewerId];
    if (!payload) {
      throw new Error("No encrypted payload available for this user");
    }

    // Convert payload arrays back to Uint8Array
    const normalizedPayload: EncryptedPayload = {
      ciphertext: new Uint8Array(payload.ciphertext),
      iv: new Uint8Array(payload.iv),
      tag: new Uint8Array(payload.tag),
      encapsulatedKey: new Uint8Array(payload.encapsulatedKey),
    };

    const senderKeys = await getUserPublicKeys(encryptedMessage.senderId);

    // Decapsulate the shared secret
    const sharedSecret = await decapsulate(
      normalizedPayload.encapsulatedKey,
      recipientKeys.kyberPrivateKey
    );

    // Derive the AES key
    const aesKey = await deriveKey(sharedSecret);

    // Decrypt the message
    const decryptedMessage = await decrypt(
      normalizedPayload.ciphertext,
      aesKey,
      normalizedPayload.iv,
      normalizedPayload.tag
    );

    // Verify the signature
    const messageBytes = new TextEncoder().encode(decryptedMessage);
    const isValid = await verify(
      messageBytes,
      new Uint8Array(encryptedMessage.signature),
      senderKeys.dilithiumPublicKey
    );

    if (!isValid) {
      throw new Error("Invalid signature");
    }

    return {
      message: decryptedMessage,
      senderId: encryptedMessage.senderId,
    };
  } catch (error) {
    console.error("Error decrypting message:", error);
    throw new Error("Failed to decrypt message");
  }
}
