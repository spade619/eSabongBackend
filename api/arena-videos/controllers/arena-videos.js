"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  customCreate: async (ctx) => {
    const { body } = ctx.request;

    try {
      const arenaNameExist = await strapi
        .query("arena-videos")
        .findOne({ videoName: body.videoName });

      if (!arenaNameExist) {
        const arenaVideo = await strapi.query("arena-videos").create(body);

        return arenaVideo;
      } else {
        return ctx.badRequest({
          status: 400,
          message: "Video Name Already Exist",
        });
      }
    } catch (error) {
      // If an error occurred, abort the whole transaction and
      // undo any changes that might have happened
      console.log(error);
      throw error;
    }
  },
};
