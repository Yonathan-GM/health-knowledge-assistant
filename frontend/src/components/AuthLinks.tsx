"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { getToken } from "@/lib/api";

const subscribe = () => () => {};

// Reads the saved login token without an effect; the server render always assumes "signed out".
function useSignedIn() {
  return useSyncExternalStore(
    subscribe,
    () => getToken() !== null,
    () => false
  );
}

export function HeaderLinks() {
  const signedIn = useSignedIn();
  if (signedIn) {
    return (
      <Link href="/dashboard" className="whitespace-nowrap text-sm font-medium text-teal-deep hover:text-teal">
        Open your library
      </Link>
    );
  }
  return (
    <div className="flex items-center gap-4 whitespace-nowrap sm:gap-5">
      <Link href="/login" className="text-sm font-medium text-ink hover:text-teal-deep">
        Log in
      </Link>
      <Link href="/signup" className="text-sm font-medium text-teal-deep hover:text-teal">
        Create account
      </Link>
    </div>
  );
}

export function HeroLinks() {
  const signedIn = useSignedIn();
  if (signedIn) {
    return (
      <Link href="/dashboard" className={btnPrimary}>
        Open your library
      </Link>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      <Link href="/signup" className={btnPrimary}>
        Create an account
      </Link>
      <Link href="/login" className={btnSecondary}>
        Log in
      </Link>
    </div>
  );
}
