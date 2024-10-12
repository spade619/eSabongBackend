"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  async getTotalSales() {
    const result = await strapi
      .query("commission-history")
      .model.query((qb) => {
        qb.sum("commission");
      })
      .fetch();

    const sum = result[0].sum;

    return sum;
  },
  arenaByDate: async (ctx) => {
    const { arena_id } = ctx.params;

    const Arena = strapi.connections.default.models.Arenas;
    const CommissionHistory =
      strapi.connections.default.models.CommissionHistory;
    const GameHistory = strapi.connections.default.models.GameHistory;

    const arenaByDate = await CommissionHistory.find({
      "game_history_id.arena_id": arena_id,
    }).populate({
      path: "game_history_id",
      model: GameHistory,
      populate: [
        {
          path: "arena_id",
          model: Arena,
        },
      ],
    });
    return arenaByDate;
  },
};
