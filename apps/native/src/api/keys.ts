export const userKeys = {
  all: ["user"] as const,
  me: () => ["user", "me"] as const,
  byId: (id: string) => ["user", id] as const,
};

export const authKeys = {
  all: ["auth"] as const,
};
