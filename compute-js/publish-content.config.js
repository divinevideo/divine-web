/*
 * Configuration for @fastly/compute-js-static-publish.
 */

/** @type {import('@fastly/compute-js-static-publish').PublishContentConfig} */
const config = {
  kvStoreName: "divine-web-content",
  rootDir: "../dist",
  server: {
    spaFile: "/index.html",
    autoIndex: ["index.html"],
    notFoundPageFile: "/404.html",
  },
};

export default config;
