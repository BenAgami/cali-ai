import type {
  BodyMetricInput,
  SaveBodyMetricResponse,
  UserProfile,
  UpdateProfileValues,
  UpsertGoalValues,
} from "@repo/common";

import { apiClient } from "../client";
import { USER_ROUTES } from "@src/constants/routes";

// React Native's fetch polyfill accepts this file-descriptor shape as a
// request body directly (uploading by URI without reading the file into
// memory first), which the standard BodyInit type doesn't model.
type RNFileBody = { uri: string; type: string; name: string };

export const userApi = {
  getMe: (): Promise<UserProfile> => apiClient.get<UserProfile>(USER_ROUTES.me),

  updateProfile: (data: UpdateProfileValues): Promise<UserProfile> =>
    apiClient.patch<UserProfile>(USER_ROUTES.me, data),

  getAvatarUploadUrl: (): Promise<{ uploadUrl: string; publicUrl: string }> =>
    apiClient.post<{ uploadUrl: string; publicUrl: string }>(
      USER_ROUTES.avatarUploadUrl,
      {},
    ),

  uploadAvatarToS3: async (
    uploadUrl: string,
    fileUri: string,
  ): Promise<void> => {
    const fileBody: RNFileBody = {
      uri: fileUri,
      type: "image/jpeg",
      name: "avatar.jpg",
    };
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: fileBody as unknown as BodyInit,
      headers: { "Content-Type": "image/jpeg" },
    });
    if (!res.ok) throw new Error("Avatar upload failed");
  },

  upsertGoal: (data: UpsertGoalValues): Promise<void> =>
    apiClient.post(USER_ROUTES.goals, data),

  saveBodyMetrics: (data: BodyMetricInput): Promise<SaveBodyMetricResponse> =>
    apiClient.post<SaveBodyMetricResponse>(USER_ROUTES.bodyMetrics, data),
};
