"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

module.exports = {
  commissionRequest: async (ctx) => {
    const { body } = ctx.request;

    const session = await strapi.connections.default.startSession();

    try {
      await session.startTransaction();

      const requestor = await strapi
        .query("user", "users-permissions")
        .findOne({ id: body.user_id }, null, { session });

      // // Check if the user exists
      if (!requestor) {
        return ctx.badRequest(null, "User is not found");
      }

      if (Number(requestor.commision) < Number(body.amount)) {
        return ctx.badRequest(null, "Insufficient balance");
      }

      const requestorPointsUpdated = (requestor.commision -= body.amount);

      await strapi
        .query("user", "users-permissions")
        .update(
          { id: requestor.id },
          { commision: requestorPointsUpdated },
          { session }
        );

      const createdRequest = await strapi.query("commission-request").create(
        {
          status: body.status,
          amount: body.amount,
          user_id: body.user_id,
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();
      return createdRequest;
    } catch (error) {
      // If an error occurred, abort the whole transaction and
      // undo any changes that might have happened
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  },

  processRequest: async (ctx) => {
    const { body } = ctx.request;

    const session = await strapi.connections.default.startSession();

    try {
      await session.startTransaction();

      if (!body.status) {
        return ctx.badRequest(null, "Status is empty please try again.");
      }

      if (!body.request_id) {
        return ctx.badRequest(null, "RequestId is empty please try again.");
      }

      if (body.status === "Approved") {
        const aprrover = await strapi
          .query("user", "users-permissions")
          .findOne({ id: body.approver_id }, null, { session });

        const receiver = await strapi
          .query("user", "users-permissions")
          .findOne({ id: body.reciever_id }, null, { session });

        // // Check if the user exists
        if (!aprrover) {
          return ctx.badRequest(null, "Approver not found please try again.");
        }

        if (!receiver) {
          return ctx.badRequest(null, "Receiver not found please try again.");
        }

        // // // Check if the user has enough balance
        // if (parseInt(aprrover.commision) < body.amount) {
        //   return ctx.badRequest(null, "Insufficient balance");
        // }

        // const aprroverComms = (aprrover.commision -= body.amount);
        // const receiverComms = +receiver.commision + +body.amount;

        const aprroverComms = +aprrover.commision + +body.amount;

        await strapi
          .query("commission-request")
          .update({ id: body.request_id }, { status: "Approved" });

        // Save the user
        await strapi
          .query("user", "users-permissions")
          .update(
            { id: aprrover.id },
            { commision: aprroverComms },
            { session }
          );

        // await strapi
        //   .query("user", "users-permissions")
        //   .update(
        //     { id: receiver.id },
        //     { commision: receiverComms },
        //     { session }
        //   );

        const logs = `Agent ${aprrover.username} approve a ${body.amount} points cashout request from ${receiver.username}.`;

        //   Record the transaction
        const history = await strapi.query("commission-logs").create({
          user_id: body.reciever_id,
          assign_to: body.approver_id,
          amount: body.amount,
          details: logs,
          status: body.status,
        });

        await session.commitTransaction();
        session.endSession();
        return history;
      } else {
        const aprrover = await strapi
          .query("user", "users-permissions")
          .findOne({ id: body.approver_id }, null, { session });

        const receiver = await strapi
          .query("user", "users-permissions")
          .findOne({ id: body.reciever_id }, null, { session });

        // // Check if the user exists
        if (!aprrover) {
          return ctx.badRequest(null, "Approver not found please try again.");
        }

        if (!receiver) {
          return ctx.badRequest(null, "Receiver not found please try again.");
        }

        const receiverComms = +receiver.commision + +body.amount;

        await strapi
          .query("user", "users-permissions")
          .update(
            { id: receiver.id },
            { commision: receiverComms },
            { session }
          );

        await strapi
          .query("commission-request")
          .update({ id: body.request_id }, { status: "Rejected" });

        const logs = `Agent ${aprrover.username} denied a ${body.amount} points cashout request from ${receiver.username}.`;

        //   Record the transaction
        const history = await strapi.query("commission-logs").create({
          user_id: body.reciever_id,
          assign_to: body.approver_id,
          amount: body.amount,
          details: logs,
          status: body.status,
        });

        await session.commitTransaction();
        session.endSession();
        return history;
      }
    } catch (error) {
      // If an error occurred, abort the whole transaction and
      // undo any changes that might have happened
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  },
};
