"use strict";
const {Worker, isMainThread, parentPort } = require('worker_threads')
const path = require('path');
const workerPath = path.resolve(__dirname, 'worker.js');


/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */



module.exports = {




  getCurrentPayout: async (ctx) => {

        // console.log('diretory nbamne', __dirname)

    // -------------------------------------------------------------------------------------------------------------
    const { user_id, arena_id } = ctx.params;
    // console.log('current-round', user_id, arena_id)
    const roundStatus = await strapi.query("arenas").findOne({
      id: arena_id,
    });
    const currentRoundBet = await strapi.query("current-round").findOne({
      user_id: user_id,
      arena_id: arena_id,
      round: roundStatus.round,
    });

    // console.log('alniltesting123', currentRoundBet)
    if (!currentRoundBet) {
     
      const returnData = {
        totalPayout: 0,
        team: null,
        betAmount: 0,
      };
      return returnData;
    } else {
    
      const teamWala = await strapi.query("current-round").find({
        arena_id: arena_id,
        team: "wala",
      });
      const teamMeron = await strapi.query("current-round").find({
        arena_id: arena_id,
        team: "meron",
      });

      // const worker = new Worker(workerPath, {workerData: {teamWala, teamMeron, currentRoundBet, roundStatus}});
      // worker.on('message', (message) => {
      //     // console.log('testing all bets124567899', message.data)
      //   if (message.type === 'results') {
      //     const results = message.data;
      //     // console.log('neltest', results);
         
      //     return results;
      //   }
            
    
      // });



      // ----------------------------------------------------

      const addAllIntegers = (array) => {
        let sum = 0;
        array.forEach((element) => {
          sum += Number(element.amount);
        });
        return sum;
      };
      const allWalaTotal = addAllIntegers(teamWala);
      const allMeronTotal = addAllIntegers(teamMeron);
      const currentRoundTeam =
        currentRoundBet.team === "meron" ? allMeronTotal : allWalaTotal;
        const meronAndWalaTotal = Number(allWalaTotal + allMeronTotal);
        const dividedToChoosenTeam = Number(meronAndWalaTotal / currentRoundTeam);
        const walaWinningAmount =
          Number(dividedToChoosenTeam) * Number(currentRoundBet.amount);
        const plasadaRate = roundStatus.plasadaRate / 100;
        const tongAmount = walaWinningAmount * plasadaRate;
        const totalPayout = walaWinningAmount - tongAmount;
        const returnData = {
          totalPayout,
          team: currentRoundBet.team,
          betAmount: currentRoundBet.amount,
          totalWala: allWalaTotal,
          totalMeron: allMeronTotal
        };

        return returnData
    }

//----

//----




// var io = require("socket.io")(strapi.server, {
//   cors: {
//     origin: "http://localhost:3000",
//     // origin: [
//     //   "https://sglive-tjper.ondigitalocean.app",
//     //   "https://www.s-warrior.live",
//     //   "https://s-warrior.live",
//     // ],
//     methods: ["GET", "POST"],
//     allowedHeaders: ["my-custom-header"],
//     credentials: true,
//   },
// });

// io.on("connection", async function (socket) {
//   socket.heartbeatTimeout = 60000;
  


  

//   socket.on("getTotalBets", (data) => {
//     console.log('worker threads', data)
//     // try {
//     //   // const roundStatus = await strapi.query("arenas").findOne({
//     //   //   id: data.arena_id,
//     //   // });
//     //   const teamWala = await strapi.query("current-round").find({
//     //     arena_id: data.arena_id,
//     //     team: "wala",
//     //   });
//     //   const teamMeron = await strapi.query("current-round").find({
//     //     arena_id: data.arena_id,
//     //     team: "meron",
//     //   });
//     //   const addAllIntegers = (array) => {
//     //     let sum = 0;
//     //     array.forEach((element) => {
//     //       sum += Number(element.amount);
//     //     });
//     //     return sum;
//     //   };
//     //   const allWalaTotal = addAllIntegers(teamWala);
//     //   const allMeronTotal = addAllIntegers(teamMeron);

//     //   io.emit('recieve_all_bets', allMeronTotal, allWalaTotal)
   
//     // }catch (error){
//     //   console.log(error)
//     // }

//   })





//     })



  }
}


  //-------------------------------------------------------------------------------------------------------------------------------------------------
  
//   getCurrentPayout: async (ctx) => {

//     const {user_id, arena_id} = await ctx.params
//     // const result = await new Promise((resolve, reject) => {
//     //   worker.on('message', resolve);
//     //   worker.on('error', reject);
//     //   // worker.postMessage({ , params: {user_id, arena_id}});
//     // });
//     ctx.body = result;
//     return result;
//   }
// }


//---------------------------------------------------------------------------------------------------------------

