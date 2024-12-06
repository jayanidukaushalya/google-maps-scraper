export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const waitSafely = async (timeout: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, timeout));
};
