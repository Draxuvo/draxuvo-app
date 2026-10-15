import { api } from "./client";
import { fileField, type PhotoFile } from "./orders";
import type { User } from "./types";

export interface ProfileChanges {
  first_name: string;
  last_name: string;
  phone: string;
}

export const getProfile = () => api.get<User>("/api/v1/profile");

export const updateProfile = (changes: ProfileChanges) => api.patch<User>("/api/v1/profile", { body: { profile: changes } });

export const uploadAvatar = (file: PhotoFile) => {
  const form = new FormData();
  form.append("avatar", fileField(file));
  return api.post<User>("/api/v1/profile/avatar", { form });
};

export const removeAvatar = () => api.delete<User>("/api/v1/profile/avatar");
