"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Approving or denying a device login. Better Auth checks the session and that this user
// claimed the code; when it refuses (expired, already used), the page shows the code's state.

function userCode(formData: FormData) {
  const value = formData.get("user_code");
  return typeof value === "string" ? value : "";
}

async function decide(formData: FormData, decision: "approve" | "deny") {
  const code = userCode(formData);
  const request = { body: { userCode: code }, headers: await headers() };
  try {
    if (decision === "approve") await auth.api.deviceApprove(request);
    else await auth.api.deviceDeny(request);
  } catch (error) {
    if (!isAPIError(error)) throw error;
    redirect(`/device?user_code=${encodeURIComponent(code)}`);
  }
  redirect(`/device?result=${decision === "approve" ? "approved" : "denied"}`);
}

export async function approveDevice(formData: FormData) {
  await decide(formData, "approve");
}

export async function denyDevice(formData: FormData) {
  await decide(formData, "deny");
}
