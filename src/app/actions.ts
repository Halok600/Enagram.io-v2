"use server";

import { signOut } from "@/auth";

export async function disconnect() {
  await signOut();
}
