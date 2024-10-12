module.exports = ({ env }) => ({
  defaultConnection: "default",
  connections: {
    default: {
      connector: "mongoose",
      settings: {
        // host: env("DATABASE_HOST", "cluster0.l63dw.mongodb.net"),
        // srv: env.bool("DATABASE_SRV", true),
        // port: env.int("DATABASE_PORT", 27017),
        // database: env("DATABASE_NAME", "SGLiveBackend"),
        // username: env("DATABASE_USERNAME", "emman24"),
        // password: env("DATABASE_PASSWORD", "password1234"),

        // host: env("DATABASE_HOST", "cluster0.l63dw.mongodb.net"),
        // srv: env.bool("DATABASE_SRV", true),
        // port: env.int("DATABASE_PORT", 27017),
        // database: env("DATABASE_NAME", "MyTestStrapiV3"),
        // username: env("DATABASE_USERNAME", "emman24"),
        // password: env("DATABASE_PASSWORD", "password1234"),

        host: env(
          "DATABASE_HOST",
        "sglive-mongodb-cluster-93e2628e.mongo.ondigitalocean.com"
        ),
        srv: env.bool("DATABASE_SRV", true),
        port: env.int("DATABASE_PORT", 27017),
        database: env("DATABASE_NAME", "SGLive"),
        username: env("DATABASE_USERNAME", "doapps-c11b67e0-7e19-4fe3-bc1c-553ab40aa07e"),
        password: env("DATABASE_PASSWORD", "Z97KbC64Ig25G80z"),
      },
      options: {
        authenticationDatabase: env("AUTHENTICATION_DATABASE", "admin"),
        ssl: env.bool("DATABASE_SSL", true),
        ca: env("CA_CERT"),
        // debug:true
      },

    },
  },
});
