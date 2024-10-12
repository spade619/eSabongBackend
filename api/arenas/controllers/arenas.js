"use strict";

const { sanitizeEntity } = require("strapi-utils");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  getLiveArenas: async (ctx) => {
    const arena = await strapi.query("arenas").find().populate("game_history");

    // const arenas = await strapi.query("arenas").find();

    // const arenaIds = arenas.map((arena) => arena.id);

    // const gameHistory = await strapi.query("game-history").find({
    //   arena_id_in: arenaIds,
    // });

    // const gameHistoryByArenaId = {};
    // gameHistory.forEach((item) => {
    //   if (!gameHistoryByArenaId[item.arena_id]) {
    //     gameHistoryByArenaId[item.arena_id] = [];
    //   }
    //   gameHistoryByArenaId[item.arena_id].push(item);
    // });

    // const result = arenas.map((arena) => {
    //   return {
    //     ...arena,
    //     game_history: gameHistoryByArenaId[arena.id]
    //       ? gameHistoryByArenaId[arena.id]
    //       : [],
    //   };
    // });

    return arena;
  },
};
