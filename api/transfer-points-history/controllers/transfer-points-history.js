"use strict";
const { sanitizeEntity } = require("strapi-utils");

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  transferUser: async (ctx) => {
    const { body } = ctx.request;

    const session = await strapi.connections.default.startSession();

    try {
      await session.startTransaction();

      const senderData = await strapi
        .query("user", "users-permissions")
        .findOne({ id: body.sender_id }, null, { session });

      const receiverData = await strapi
        .query("user", "users-permissions")
        .findOne({ id: body.receiver_id }, null, { session });

      // Check if the user exists
      if (!senderData || !receiverData) {
        return ctx.badRequest(null, "User not found");
      }

      // Check if the user has enough balance
      if (Number(senderData.points) < Number(body.amount)) {
        return ctx.badRequest(null, "Insufficient balance");
      }

      const senderWallet = (senderData.points -= body.amount);
      const receiverWallet = +receiverData.points + +body.amount;

      //   Record the transaction
      const history = await strapi.query("transfer-points-history").create(
        {
          sender_id: senderData.id,
          receiver_id: receiverData.id,
          amount: body.amount,
          credited_at: body.credited_at,
        },
        { session }
      );

      // Save the user
      await strapi
        .query("user", "users-permissions")
        .update({ id: senderData.id }, { points: senderWallet }, { session });

      await strapi
        .query("user", "users-permissions")
        .update(
          { id: receiverData.id },
          { points: receiverWallet },
          { session }
        );

      await session.commitTransaction();
      session.endSession();
      return history;
    } catch (error) {
      // If an error occurred, abort the whole transaction and
      // undo any changes that might have happened
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  },

  superadminTransfer: async (ctx) => {
    const { body } = ctx.request;

    const session = await strapi.connections.default.startSession();

    try {
      await session.startTransaction();

      const senderData = await strapi
        .query("user", "users-permissions")
        .findOne({ id: body.sender_id }, null, { session });

      const receiverData = await strapi
        .query("user", "users-permissions")
        .findOne({ id: body.receiver_id }, null, { session });

      // Check if the user exists
      if (!senderData || !receiverData) {
        return ctx.badRequest(null, "User not found");
      }

      // Check if the user has enough balance
      if (parseInt(senderData.points) < body.amount) {
        return ctx.badRequest(null, "Insufficient balance");
      }

      const senderWallet = (senderData.points -= body.amount);
      const receiverWallet = +receiverData.points + +body.amount;

      //   Record the transaction
      const history = await strapi.query("transfer-points-history").create(
        {
          sender_id: senderData.id,
          receiver_id: receiverData.id,
          amount: body.amount,
          credited_at: "superadmin",
        },
        { session }
      );

      // Save the user
      await strapi
        .query("user", "users-permissions")
        .update({ id: senderData.id }, { points: senderWallet }, { session });

      await strapi
        .query("user", "users-permissions")
        .update(
          { id: receiverData.id },
          { points: receiverWallet },
          { session }
        );

      await session.commitTransaction();
      session.endSession();
      return history;
    } catch (error) {
      // If an error occurred, abort the whole transaction and
      // undo any changes that might have happened
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  },

  myHistory: async (ctx) => {
    const { senderId } = ctx.params;

    const find = await strapi.query("transfer-points-history").find({
      sender_id: senderId,
    });

    return find;
  },
};
