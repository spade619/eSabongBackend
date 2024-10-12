"use strict";

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

const { Server } = require("socket.io");
const { createServer } = require("http");

module.exports = {
  initialize() {
    this.io = new Server(createServer());
    this.io.on("connection", (socket) => {
      console.log(`Socket ${socket.id} connected`);
    });

    this.watchDatabaseUpdates();
  },

  async watchDatabaseUpdates() {
    const handler = createSocketHandler(this.io);
    strapi.query("arenas").watch(handler);
  },

  async updateArenas(id, data) {
    // Update the arenas in the database
    const updatedArenas = await strapi.query("arenas").update({ id }, data);

    // Emit a Socket.IO event to all connected clients
    this.io.emit("databaseUpdate", { model: "arenas", entry: updatedArenas });

    return updatedArenas;
  },
};

function createSocketHandler(io) {
  return async (model, entry) => {
    // Emit a Socket.IO event to all connected clients
    io.emit("databaseUpdate", { model, entry });
  };
}
