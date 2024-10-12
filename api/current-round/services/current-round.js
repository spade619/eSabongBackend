'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

// var io = require("socket.io")( strapi.server, {
//     cors: {
//       origin: "http://localhost:3000",
//       // origin: [
//       //   "https://sglive-tjper.ondigitalocean.app",
//       //   "https://www.s-warrior.live",
//       //   "https://s-warrior.live",
//       // ],
//       methods: ["GET", "POST"],
//       allowedHeaders: ["my-custom-header"],
//       credentials: true,
//     },
//   });
  
  
//   io.setMaxListeners(20);
     
//   io.on("connection", async function (socket) {
//     socket.heartbeatTimeout = 60000;


//       socket.on("getTotalBets", (data) => {
//   console.log('worker threads', data)

//   if(data !== null){
//             console.log('holyshit please work!')
//   }

//   // try {
//   //   // const roundStatus = await strapi.query("arenas").findOne({
//   //   //   id: data.arena_id,
//   //   // });
//   //   const teamWala =  strapi.query("current-round").find({
//   //     arena_id: data.arena_id,
//   //     team: "wala",
//   //   });
//   //   const teamMeron = strapi.query("current-round").find({
//   //     arena_id: data.arena_id,
//   //     team: "meron",
//   //   });
//   //   const addAllIntegers = (array) => {
//   //     let sum = 0;
//   //     array.forEach((element) => {
//   //       sum += Number(element.amount);
//   //     });
//   //     return sum;
//   //   };
//   //   const allWalaTotal = addAllIntegers(teamWala);
//   //   const allMeronTotal = addAllIntegers(teamMeron);

//   //   io.emit('recieve_all_bets', allMeronTotal, allWalaTotal)
 
//   // }catch (error){
//   //   console.log(error)
//   // }

// })








//     // io.emit('recieve_all_bets', allMeronTotal, allWalaTotal)


//       })



//     //   io.listen(1338);




module.exports = {
   
   
      
         
};
