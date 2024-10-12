"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

// const User = require("../models/User.settings.json");

module.exports = {
  login: async (ctx) => {
    const { identifier, password } = ctx.request.body;
    const loginUserIp = ctx.request.ip;

    const session = await strapi.connections.default.startSession();

    try {
      await session.startTransaction();

      function validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
      }

      const isEmail = validateEmail(identifier);
      const query = {};

      if (isEmail) {
        query.email = identifier;
      } else {
        query.username = identifier;
      }

      console.log(query);

      const user = await strapi
        .query("user", "users-permissions")
        .findOne(query);

      if (!user) {
        return ctx.unauthorized(`Invalid login credentials`);
      }

      if (user.status === "approval") {
        return ctx.unauthorized(`Your Account needs approval`);
      }

      if (user.status === "deactivated") {
        return ctx.unauthorized(`Your Account has been deactivated`);
      }

      const isValid = await strapi.plugins[
        "users-permissions"
      ].services.user.validatePassword(password, user.password);

      if (!isValid) {
        return ctx.unauthorized(`Invalid login credentials`);
      }

      const { issue } = strapi.plugins["users-permissions"].services.jwt;
      const token = issue({ id: user.id });

      const data = {
        jwt: token,
        user,
      };

      await strapi.query("login-logs").create({
        user_id: user.id,
        event: "Login Event",
        ipAddress: loginUserIp,
      });

      await session.commitTransaction();
      session.endSession();

      return ctx.send(data);
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

    //   const { email, password } = ctx.request.body;
    //   const loginUserIp = ctx.request.ip;
    //   const session = await strapi.connections.default.startSession();
    //   try {
    //     await session.startTransaction();
    //     // Find the user with the provided email
    //     const user = await strapi
    //       .query("user", "users-permissions")
    //       .findOne({ email });
    //     // If no user is found, return a 401 error
    //     if (!user) {
    //       return ctx.unauthorized(`Email or password is invalid`);
    //     }
    //     // check user status if approved
    //     if (user.status === "approval") {
    //       return ctx.unauthorized(`Your Account needs approval`);
    //     }
    //     // check user status if deactivated
    //     if (user.status === "deactivated") {
    //       return ctx.unauthorized(`Your Account has been deactivated`);
    //     }
    //     // Check if the provided password matches the hashed password in the database
    //     const isValid = await strapi.plugins[
    //       "users-permissions"
    //     ].services.user.validatePassword(password, user.password);
    //     // If the password is invalid, return a 401 error
    //     if (!isValid) {
    //       return ctx.unauthorized(`Email or password is invalid`);
    //     }
    //     const { issue } = strapi.plugins["users-permissions"].services.jwt;
    //     const token = issue({ id: user.id });
    //     const data = {
    //       jwt: token,
    //       user,
    //     };
    //     //  Record the login history
    //     await strapi.query("login-logs").create({
    //       user_id: user.id,
    //       event: "Login Event",
    //       ipAddress: loginUserIp,
    //     });
    //     await session.commitTransaction();
    //     session.endSession();
    //     // If the email and password are valid, return the authenticated user
    //     return ctx.send(data);
    //   } catch (error) {
    //     // If an error occurred, abort the whole transaction and
    //     // undo any changes that might have happened
    //     await session.abortTransaction();
    //     session.endSession();
    //     throw error;
    //   }
    // },
  },

  cashin: async (ctx) => {
    const { user_id, amount } = ctx.request.body;

    const session = await strapi.connections.default.startSession();

    try {
      await session.startTransaction();

      const userData = await strapi
        .query("user", "users-permissions")
        .findOne({ id: user_id }, null, { session });

      // check if user is superadmin
      if (userData.role.type !== "superadmin") {
        return ctx.badRequest(null, "The 'user_id' should be superadmin");
      }

      const cashinTotal = +userData.points + +amount;

      await strapi.query("user", "users-permissions").update(
        { id: user_id },
        {
          points: cashinTotal,
        },
        { session }
      );

      const history = await strapi.query("cashin").create(
        {
          user_id: user_id,
          amount: amount,
        },
        { session }
      );

      await session.commitTransaction();
      session.endSession();

      // If the email and password are valid, return the authenticated user
      return ctx.send(history);
    } catch (error) {
      // If an error occurred, abort the whole transaction and
      // undo any changes that might have happened
      await session.abortTransaction();
      session.endSession();
      throw error;
    }
  },
};