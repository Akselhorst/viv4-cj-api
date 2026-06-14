const TOKEN_BUFFER_MS = 24 * 60 * 60 * 1000; // refresh 1 day early

const defaultExpiresAt = () => Date.now() + 13 * 24 * 60 * 60 * 1000;

let tokens = {
  accessToken: null,
  refreshToken: null,
  expiresAt: 0,
};

module.exports = {
  getAccessToken: () => tokens.accessToken,
  getRefreshToken: () => tokens.refreshToken,

  saveTokens: (next = {}) => {
    const expiresAt = next.expiresAt || defaultExpiresAt();
    tokens = {
      accessToken: next.accessToken,
      refreshToken: next.refreshToken,
      expiresAt,
    };
  },

  isAccessTokenExpiring: () => {
    if (!tokens.accessToken || !tokens.expiresAt) return true;
    return Date.now() > (tokens.expiresAt - TOKEN_BUFFER_MS);
  },
};
