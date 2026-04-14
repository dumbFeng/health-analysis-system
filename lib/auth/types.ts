export type AuthIdentityType = "phone" | "email" | "wechat";

export type AuthUser = {
  id: string;
  identityType: AuthIdentityType;
  identityEncrypted: string;
  identityHash: string;
  identityMasked: string;
  username: string;
  avatarUrl: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  userId: string;
  username: string;
  identityType: AuthIdentityType;
  identityMasked: string;
};

export type PendingSignupSession = {
  email: string;
  identityType: "email";
  adminLogin: boolean;
};
