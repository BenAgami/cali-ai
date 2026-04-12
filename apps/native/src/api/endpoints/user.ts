import { apiClient } from "../client";
import type { UserProfile, UpdateProfileValues, UpsertGoalValues } from "@repo/common";

export const userApi = {
  getMe: (): Promise<UserProfile> =>
    apiClient.get<UserProfile>("/api/users/me"),

  updateProfile: (data: UpdateProfileValues): Promise<UserProfile> =>
    apiClient.patch<UserProfile>("/api/users/me", data),

  getAvatarUploadUrl: (): Promise<{ uploadUrl: string; publicUrl: string }> =>
    apiClient.post<{ uploadUrl: string; publicUrl: string }>(
      "/api/users/me/avatar-upload-url",
      {},
    ),

  uploadAvatarToS3: async (uploadUrl: string, fileUri: string): Promise<void> => {
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: { uri: fileUri, type: "image/jpeg", name: "avatar.jpg" } as unknown as BodyInit,
      headers: { "Content-Type": "image/jpeg" },
    });
    if (!res.ok) throw new Error("Avatar upload failed");
  },

  upsertGoal: (data: UpsertGoalValues): Promise<void> =>
    apiClient.post("/api/users/me/goals", data),
};
