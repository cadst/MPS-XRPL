const KEY = 'mps:accessToken';

export const getAccessToken = () =>
  (typeof window === 'undefined' ? null : sessionStorage.getItem(KEY));

export const setAccessToken = (t: string) => {
  if (typeof window !== 'undefined') sessionStorage.setItem(KEY, t);
};

export const clearAccessToken = () => {
  if (typeof window !== 'undefined') sessionStorage.removeItem(KEY);
};
