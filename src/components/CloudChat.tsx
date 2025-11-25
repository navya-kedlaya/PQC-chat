import React, { useEffect, useMemo, useRef, useState } from "react";
import { signInAnonymously, updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { auth, db, firebaseDiagnostics } from "../firebase";
import { useAuth } from "../hooks/useAuth";
import { SecureChat } from "./SecureChat";

interface Profile {
  id: string;
  displayName: string;
  updatedAt?: number;
}

const CloudChat: React.FC = () => {
  const { user, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [profileReady, setProfileReady] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedRecipient, setSelectedRecipient] = useState<string | null>(
    null
  );
  const [savingProfile, setSavingProfile] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [initError, setInitError] = useState<string | null>(null);
  const signInAttemptRef = useRef(false);

  useEffect(() => {
    console.log("[CloudChat] Render", {
      hasUser: Boolean(user),
      loading,
      profileReady,
      profilesCount: profiles.length,
      selectedRecipient,
    });
  });

  // Bootstrap anonymous auth so each browser session gets a stable user id
  useEffect(() => {
    if (user) {
      signInAttemptRef.current = false;
      return;
    }
    if (signInAttemptRef.current) {
      console.log("[CloudChat] Waiting for previous sign-in attempt to finish");
      return;
    }
    signInAttemptRef.current = true;
    console.log("[CloudChat] Attempting anonymous sign-in", {
      loading,
    });
    signInAnonymously(auth)
      .then(() => {
        console.log("[CloudChat] signInAnonymously resolved");
      })
      .catch((err) => {
        console.error("Failed to sign in anonymously:", err);
        setInitError(
          `Anonymous sign-in failed: ${err?.code || err?.message || err}`
        );
        signInAttemptRef.current = false;
      });
  }, [user, loading]);

  // Load or create the current user's profile document
  useEffect(() => {
    if (!user) return;

    const profileRef = doc(db, "profiles", user.uid);
    getDoc(profileRef)
      .then((snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as Profile;
          setDisplayName(data.displayName || "");
          console.log("[CloudChat] Loaded existing profile", {
            userId: user.uid,
            displayName: data.displayName,
          });
        }
        setProfileReady(true);
      })
      .catch((err) => {
        console.error("Failed to load profile:", err);
        setInitError(err.message || "Failed to load profile");
        setProfileReady(true);
      });
  }, [user]);

  // Subscribe to the directory of available users
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      collection(db, "profiles"),
      (snapshot) => {
        const loaded: Profile[] = [];
        snapshot.forEach((docSnap) => {
          loaded.push({
            id: docSnap.id,
            ...(docSnap.data() as Profile),
          });
        });
        console.log("[CloudChat] Profiles snapshot", {
          count: loaded.length,
        });
        setProfiles(loaded);
      },
      (error) => {
        console.error("[CloudChat] profiles snapshot error", error);
        setInitError(
          error.message || "Failed to subscribe to profiles collection"
        );
      }
    );

    return () => unsubscribe();
  }, [user]);

  const filteredProfiles = useMemo(
    () => profiles.filter((profile) => profile.id !== user?.uid),
    [profiles, user]
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !displayName.trim()) return;

    setSavingProfile(true);
    try {
      const normalizedName = displayName.trim();
      try {
        await updateProfile(user, { displayName: normalizedName });
      } catch (err) {
        console.warn("Unable to update Firebase auth profile:", err);
      }

      await setDoc(
        doc(db, "profiles", user.uid),
        {
          displayName: normalizedName,
          updatedAt: Date.now(),
        },
        { merge: true }
      );
      console.log("[CloudChat] Saved profile", { userId: user.uid });
    } catch (err) {
      console.error("Failed to save profile:", err);
      alert("We could not save your profile. Please try again.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCopyId = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.uid);
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy id:", err);
    }
  };

  if (firebaseDiagnostics.missingKeys.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-700 p-4 text-center">
        <div>
          <p className="font-semibold text-lg mb-2">
            Firebase configuration is incomplete.
          </p>
          <p>
            Missing keys: {firebaseDiagnostics.missingKeys.join(", ")}. Check
            your environment variables on Vercel (they must start with
            REACT_APP_).
          </p>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 text-red-700 p-6 text-center">
        <div>
          <p className="font-semibold text-lg mb-2">
            Unable to initialize secure cloud session.
          </p>
          <p>{initError}</p>
        </div>
      </div>
    );
  }

  if (loading || !profileReady || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-600">
        Initializing secure cloud session...
      </div>
    );
  }

  if (!displayName.trim()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <form
          onSubmit={handleSaveProfile}
          className="bg-white shadow-lg rounded-xl p-8 w-full max-w-md space-y-4"
        >
          <h1 className="text-2xl font-semibold text-gray-900">
            Choose a display name
          </h1>
          <p className="text-sm text-gray-600">
            This name will be shown to anyone you chat with through the cloud
            relay.
          </p>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="e.g. QuantumFox"
            className="w-full border border-gray-200 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={savingProfile}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {savingProfile ? "Saving..." : "Save & continue"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-10 px-4 space-y-6">
        <header>
          <p className="text-sm uppercase tracking-wide text-blue-600 font-semibold">
            Cloud Relay
          </p>
          <h1 className="text-3xl font-bold text-gray-900 mt-1">
            Chat anywhere with PQ-grade security
          </h1>
          <p className="text-gray-600 mt-2">
            Share your device ID with a partner, add them from the directory, and
            every message will be stored and synced through Firebase so both of
            you can stay connected from any machine.
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-3">
          <section className="bg-white rounded-2xl shadow-sm p-6 space-y-6">
            <div>
              <h2 className="font-semibold text-gray-800">Your device ID</h2>
              <p className="text-sm text-gray-500 mt-1">
                Share this ID with another person so they can start a conversation
                with you.
              </p>
              <div className="mt-3 flex items-center space-x-2">
                <input
                  value={user.uid}
                  readOnly
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono bg-gray-50"
                />
                <button
                  onClick={handleCopyId}
                  className="px-3 py-2 text-sm font-semibold rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                  {copyState === "copied" ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold text-gray-800 mb-2">Contacts</h3>
              {filteredProfiles.length === 0 && (
                <p className="text-sm text-gray-500">
                  No other profiles yet. Ask someone to open the app and save
                  their display name.
                </p>
              )}
              <ul className="space-y-2">
                {filteredProfiles.map((profile) => (
                  <li key={profile.id}>
                    <button
                      onClick={() => setSelectedRecipient(profile.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border transition ${
                        selectedRecipient === profile.id
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-gray-200 hover:border-blue-300"
                      }`}
                    >
                      <p className="font-semibold">{profile.displayName}</p>
                      <p className="text-xs text-gray-500 break-all">
                        {profile.id}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section className="md:col-span-2 bg-white rounded-2xl shadow-sm overflow-hidden min-h-[500px]">
            {selectedRecipient ? (
              <SecureChat recipientId={selectedRecipient} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8 text-center space-y-4">
                <p className="text-lg font-semibold">
                  Select someone from the contacts list
                </p>
                <p className="text-sm">
                  Once you pick a contact, we will spin up a shared, encrypted
                  conversation and sync it through the cloud.
                </p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default CloudChat;

