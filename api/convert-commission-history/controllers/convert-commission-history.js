"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  transfer: async (ctx) => {
    const { body } = ctx.request;

    if (!body.user_id) {
      return ctx.badRequest(
        null,
        "The 'user_id' field is missing or undefined"
      );
    }

    if (!body.amount) {
      return ctx.badRequest(null, "The 'amount' field is missing or undefined");
    }

    const session = await strapi.connections.default.startSession();

    try {
      await session.startTransaction();

      const user = await strapi
        .query("user", "users-permissions")
        .findOne({ id: body.user_id }, null, { session });

      // Check if the user exists
      if (!user) {
        return ctx.badRequest(null, "User not found");
      }

      // Check if the user has enough balance
      if (Number(user.points) < Number(body.amount)) {
        return ctx.badRequest(null, "Insufficient balance");
      }

      const commisionResult = (user.commision -= body.amount);
      const walletResult = +user.points + +body.amount;

      const updatedWallet = {
        points: walletResult,
        commision: commisionResult,
      };

      await strapi
        .query("user", "users-permissions")
        .update({ id: user?.id }, updatedWallet, { session });

      //   Record the transaction
      const history = await strapi.query("convert-commission-history").create(
        {
          user_id: body.user_id,
          amount: body.amount,
        },
        { session }
      );

      await session.commitTransaction();
      await session.endSession();
      return history;
    } catch (error) {
      // If an error occurred, abort the whole transaction and
      // undo any changes that might have happened
      await session.abortTransaction();
      await session.endSession();
      throw error;
    }
  },

  findByUser: async (ctx) => {
    const { user_id } = ctx.params;

    if (!user_id) {
      return ctx.badRequest(
        null,
        "The 'user_id' field is missing or undefined"
      );
    }

    const find = await strapi.query("convert-commission-history").find({
      user_id,
    });

    return find;
  },

  find: async (ctx) => {
    // const { user_id } = ctx.params;
   
  
    // if (!user_id) {
    //   return ctx.badRequest(
    //     null,
    //     "The 'user_id' field is missing or undefined"
    //   );
    // }
  
    const find = await strapi.query("convert-commission-history").find({
      // user_id,
    });
  
    return find;
  },
  
}



