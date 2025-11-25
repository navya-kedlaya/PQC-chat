import { useState, useEffect } from "react";
import { auth } from "../firebase";
import { User } from "firebase/auth";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(
      (user) => {
        console.log("[useAuth] Auth state changed", {
          hasUser: Boolean(user),
          uid: user?.uid,
        });
        setUser(user);
        setLoading(false);
      },
      (error) => {
        console.error("[useAuth] Failed to observe auth state", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
