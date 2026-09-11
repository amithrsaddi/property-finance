window.APP_CONFIG = {
  apiBaseUrl: (() => {
    const host = window.location.hostname;
    const local =
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      /^(10|192\.168|172\.(1[6-9]|2\d|3[0-1]))\./.test(host);
    return local ? `${window.location.protocol}//${host}:3000` : "/api";
  })()
};
