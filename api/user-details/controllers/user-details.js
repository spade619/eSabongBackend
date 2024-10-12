"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  upsert: async (ctx) => {
    const { body } = ctx.request;

    const session = await strapi.connections.default.startSession();

    if (!body.user_id) {
      return ctx.badRequest("user_id is missing");
    }

    const findUser = await strapi
      .query("user-details")
      .findOne({ user_id: body.user_id }, null, { session });

    if (findUser) {
      try {
        await session.startTransaction();

        const data = {
          paymentMode: body.payment_mode,
          accountName: body.account_name,
          accountNumber: body.account_number,
          additionalAccountDetails: body.additional_account_details,
        };

        const userToBeUpdated = await strapi
          .query("user-details")
          .findOne({ user_id: body.user_id }, null, { session });

        const response = await strapi
          .query("user-details")
          .update({ id: userToBeUpdated.id }, data, { session });

        await session.commitTransaction();
        session.endSession();
        return response;
      } catch (error) {
        // If an error occurred, abort the whole transaction and
        // undo any changes that might have happened
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    } else {
      try {
        await session.startTransaction();

        const data = {
          user_id: body.user_id,
          paymentMode: body.payment_mode,
          accountName: body.account_name,
          accountNumber: body.account_number,
          additionalAccountDetails: body.additional_account_details,
        };

        const response = await strapi
          .query("user-details")
          .create(data, { session });

        await session.commitTransaction();
        session.endSession();
        return response;
      } catch (error) {
        // If an error occurred, abort the whole transaction and
        // undo any changes that might have happened
        await session.abortTransaction();
        session.endSession();
        throw error;
      }
    }
  },
  getByUserId: async (ctx) => {
    const { user_id } = ctx.params;

    if (!user_id) {
      return ctx.badRequest("param value is empty");
    }

    const find = await strapi.query("user-details").findOne({
      user_id,
    });

    return find;
  },
};
