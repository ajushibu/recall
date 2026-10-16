/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  async rewrites() {
    return {
      // The app is a plain page in /public; Next.js only adds the API routes.
      beforeFiles: [
        { source: "/", destination: "/index.html" },
        { source: "/config.js", destination: "/api/config" },
      ],
    };
  },
  async headers() {
    return [
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/index.html", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/:file(app.js|styles.css)", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};
