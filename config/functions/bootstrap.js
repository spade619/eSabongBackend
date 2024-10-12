"use strict";

/**
 * An asynchronous bootstrap function that runs before
 * your application gets started.
 *
 * This gives you an opportunity to set up your data model,
 * run jobs, or perform some special logic.
 *
 * See more details here: https://strapi.io/documentation/developer-docs/latest/setup-deployment-guides/configurations.html#bootstrap
 */

module.exports = () => {
  var io = require("socket.io")(strapi.server, {
    cors: {
      // origin: "http://localhost:3000",
      origin: [
        "https://sglive-tjper.ondigitalocean.app",
        "https://www.s-warrior.live", 
        "https://s-warrior.live",
      ],
      methods: ["GET", "POST"],
      allowedHeaders: ["my-custom-header"],
      credentials: true,
    },
  });

  io.setMaxListeners(20);

  
// ---------------------------START----------------------------------------------
const DistributeCommissions = async (percentage, tongAmount,
  commision, itemID, session, roomID, gameHistroyID, outcomeType,
  playerID, agentID, commissionPoints) =>{
  const commisionSubAmount = percentage * tongAmount;

  const userComms = Number(commision)

  const totalUserComms = userComms + commissionPoints

  await strapi
    .query("user", "users-permissions")
    .update(
      { id: itemID },
      // { commision: totalUserComms },
      { $inc: { commision: userComms} },
      { session }
    );

  await strapi.query("commission-history").create(
    {
      arena_id: roomID,
      game_history_id: gameHistroyID,
    //  commision: commisionSubAmount,
      commision: commision,
      type: outcomeType,
      player_id: playerID,
      agent_id: agentID,
    },
    { session }
  );
}

// --------------------------------------------------------------------------

const CancelGame = async(roomID, currentRoundNumber, session) => {
  const allPlayers = await strapi.query("current-round").find(
    {
      arena_id: roomID,
      round: Number(currentRoundNumber),
    },
    null,
    { session }
  );

    if (allPlayers.length > 0){
      await Promise.all(
        allPlayers.map(async (player) => {

          const user = await strapi
          .query("user", "users-permissions")
          .findOne({ id: player.user_id.id });

          const userPoints = parseFloat(player.amount) + user.points 
          //console.log("user current points", user.points )
          //console.log("player amount", parseFloat(player.amount))
          //console.log('Returned userPoints',userPoints)

          // ** Player User History Insert
          await strapi.query("betting-logs").create(
            {
              type: "cancel",
              round: currentRoundNumber,
              betAmount: userPoints,
              team: player.team,
              arena_id: roomID,
              user_id: player.user_id.id,
            },
            { session }
          );

          // ** return bet points
          await strapi
          .query("user", "users-permissions")
          .update(
            { id: player.user_id.id },
            { points: userPoints},
            { session }
          );
        })
      );
    }
}


// -----------------------------------------END---------------------------------------------------------




  io.on("connection", function (socket) {
    socket.heartbeatTimeout = 60000;





    // ** JOIN ROOM
    socket.on("join_room", async (data) => {
      await socket.join(data.arena_id);
      await socket.emit("join_room_response", {
        success: true, 
        arena:data.arena_id
      });

      // await io.to(data.arena_id).emit("join_room_response", {
      //   success: true, 
      //   arena: data.arena_id
      // });
    });



    socket.on("RefreshDrawBalance", (data) => {
      io.to(data.arena_id).emit('refreshDrawBalance', data)
    })

    //GET USER INFO

    socket.on("get_user_info", async (data) => {
      try {
        const response = await strapi.query("user", "users-permissions").findOne({
          id: data
        });

        await socket.emit("recieve_user_info", response);
      } catch (error) {
        console.log(error);
      }
    });

    //get arena
    socket.on("get_arena", async (data) => {
      try {
        const response = await strapi.query("arenas").findOne({
          id: data.arena_id,
        });

        await io.in(data.arena_id).emit("get_arena_outcome", response);
      } catch (error) {
        console.log(error);
      }
    });

    // ** Get Betting History
    socket.on("get_game_history", async (data) => {
      try {
        const response = await strapi.query("game-history").find({
          arena_id: data.arena_id,
          _sort: "round:ASC",
        });

        await io.in(data.arena_id).emit("get_game_history_outcome", response);
      } catch (error) {
        console.log(error);
      }
    });

    // ** Get Current Round Bets FOR OVERALL BETS IN MERON AND WALA
    socket.on("getArenaOverallBetsInitalLoad", async (data) => {
    try {
      const roundStatus = await strapi.query("arenas").findOne({
        id: data
      });
      const teamWala = await strapi.query("current-round").find({
        arena_id: data,
        team: "wala",
      });
      const teamMeron = await strapi.query("current-round").find({
        arena_id: data,
        team: "meron",
      });
      const addAllIntegers = (array) => {
        let sum = 0;
        array.forEach((element) => {
          sum += Number(element.amount);
        });
        return sum;
      };
      const allWalaTotal = addAllIntegers(teamWala);
      const allMeronTotal = addAllIntegers(teamMeron);

      const meronAndWalaTotal = Number(allWalaTotal + allMeronTotal);

      const dividedToWala = Number(meronAndWalaTotal / allWalaTotal);
      const dividedToMeron = Number(meronAndWalaTotal / allMeronTotal);

      const walaWinningAmount = dividedToWala * 100;
      const meronWinningAmount = dividedToMeron * 100;

      const plasadaRate = roundStatus.plasadaRate / 100;

      const walaTongAmount = walaWinningAmount * plasadaRate;
      const meronTongAmount = meronWinningAmount * plasadaRate;
      const finalWalaPayout = walaTongAmount - walaWinningAmount;
      const finalMeronPayout = meronTongAmount - meronWinningAmount;

      const response = {
          teamWala: finalWalaPayout,
          teamMeron: finalMeronPayout,
          totalWala: allWalaTotal,
          totalMeron: allMeronTotal,
          walaTongAmount,
          meronTongAmount,
        };

      // await socket.in(data).emit("self_recieve_all_bets", response);
      await socket.emit("recieve_all_bets", response);
    } catch (error) {
      console.log(error);
    }

    });
    // ** Get Current Round Bets FOR OVERALL BETS IN MERON AND WALA
    socket.on("getArenaOverallBets", async (data) => {
      // console.log('this is te overall bets', data)
      try {
        const roundStatus = await strapi.query("arenas").findOne({
          id: data
        });
        const teamWala = await strapi.query("current-round").find({
          arena_id: data,
          team: "wala",
        });
        const teamMeron = await strapi.query("current-round").find({
          arena_id: data,
          team: "meron",
        });
        const addAllIntegers = (array) => {
          let sum = 0;
          array.forEach((element) => {
     
            sum += Number(element.amount);
            
          });
          return sum;
        };
        // console.log('this is grom get arena overall bets', teamWala)
        const allWalaTotal = addAllIntegers(teamWala);
        const allMeronTotal = addAllIntegers(teamMeron);
        const meronAndWalaTotal = Number(allWalaTotal + allMeronTotal);
        const dividedToWala = Number(meronAndWalaTotal / allWalaTotal);
        const dividedToMeron = Number(meronAndWalaTotal / allMeronTotal);
        const walaWinningAmount = dividedToWala * 100;
        const meronWinningAmount = dividedToMeron * 100;
        const plasadaRate = roundStatus.plasadaRate / 100;
        const walaTongAmount = walaWinningAmount * plasadaRate;
        const meronTongAmount = meronWinningAmount * plasadaRate;
        const finalWalaPayout = walaTongAmount - walaWinningAmount;
        const finalMeronPayout = meronTongAmount - meronWinningAmount;
        const response = {
          teamWala: finalWalaPayout,
          teamMeron: finalMeronPayout,
          totalWala: allWalaTotal,
          totalMeron: allMeronTotal,
          walaTongAmount,
          meronTongAmount,
        };
          // console.log('for meron', teamMeron.arena_id.round)
          // console.log('for wala', teamWala.arena_id.round)
        await io.to(data).emit("recieve_all_bets", response);


      } catch (error) {
          console.log(error);
        }
    });
  
    // ** Get Current Round Bets
    socket.on("get_current_round_bets", async (data) => {
      try {
        const teamWala = await strapi.query("current-round").find({
          arena_id: data.arena_id,
          team: "wala",
        });
        const teamMeron = await strapi.query("current-round").find({
          arena_id: data.arena_id,
          team: "meron",
        });
        const addAllIntegers = (array) => {
          let sum = 0;
          array.forEach((element) => {
            sum += Number(element.amount);
          });
          return sum;
        };
        const allWalaTotal = addAllIntegers(teamWala);
        const allMeronTotal = addAllIntegers(teamMeron);

        const response = {
          totalWala: allWalaTotal,
          totalMeron: allMeronTotal,
        };
        await socket.emit("get_current_round_bets_outcome", response);
      } catch (error) {
        console.log(error);
      }
    });

    // ** Get Round Status
    socket.on("get_round_status", async (data) => {
      //console.log('this shit triggered', data)
      try {
        const roundStatus = await strapi
          .query("arenas")
          .findOne({ id: data.arena_id });

        await io.in(data.arena_id).emit("get_round_status_outcome", roundStatus);
      } catch (error) {
        console.log(error);
      }
    });

    // ** Get Current Outcome
    socket.on("get_current_outcome", async (data) => {
      try {
        const roundStatus = await strapi
          .query("arenas")
          .findOne({ id: data.arena_id });
        const roundNumber = roundStatus.round;
        const createdOutcome = await strapi
          .query("game-history")
          .model.findOne({
            arena_id: data.arena_id,
            round: roundNumber,
          });
        await io.in(data.arena_id).emit("get_current_outcome_response", createdOutcome);
      } catch (error) {
        console.log(error);
      }
    });

    // ** Round Status
    socket.on("round_status", async (data) => {
      try {
        const response = await strapi
          .query("arenas")
          .update({ id: data.arena_id }, { status: data.status });

        await io.in(data.arena_id).emit("round_status_outcome", response);
      } catch (error) {
        console.log(error);
      }
    });

    // ** Round Outcome
    socket.on("round_outcome", async (data) => {
      const session = await strapi.connections.default.startSession();
      if (data.arena_id) {
        try {
          await session.startTransaction();
          const roundStatus = await strapi.query("arenas").findOne({
            id: data.arena_id,
          });
          const roundNumber = roundStatus.round;

          const createdOutcome = await strapi
            .query("game-history")
            .model.findOne(
              {
                arena_id: data.arena_id,
                round: roundNumber,
              },
              null,
              { session }
            );

          if (createdOutcome) {
            await strapi.query("game-history").update(
              { arena_id: data.arena_id, round: roundNumber },
              {
                outcome: data.status,
                round: roundNumber,
              },
              { session }
            );

            await session.commitTransaction();
            session.endSession();

            await io.in(data.arena_id).emit("round_outcome_response", {
              success: true,
              status: "outcome updated",
              data: createdOutcome,
            });
          } else {
            const result = await strapi.query("game-history").create(
              {
                arena_id: data.arena_id,
                outcome: data.status,
                round: roundNumber,
              },
              { session }
            );

            await session.commitTransaction();
            session.endSession();

            await io.in(data.arena_id).emit("round_outcome_response", {
              success: true,
              status: "outcome created",
              data: createdOutcome,
            });
          }
        } catch (error) {
          await session.abortTransaction();
          session.endSession();
          await io.in(data.arena_id).emit("round_outcome_response", {
            success: false,
            status: "error",
          });
          throw error;
        }
      } else {
        await io.in(data.arena_id).emit("round_outcome_response", {
          success: false,
          message: "arena not found",
        });
      }
    });


    // ----------------------------------------ROUND PAYOUT------------------------------------------------- 

    socket.on("payout_round", async (data) => {
     
      const session = await strapi.connections.default.startSession();
      // const roundStatus = await strapi.query("round-status").findOne();

      const roomID = data.payoutData.arena_id;
      const currentRoundNumber = data.payoutData.round;
      const outcome = data.payoutData.outcome;
      const historyID = data.payoutData.historyID;
      const plasada = data.payoutData.plasada;
      const tieRate = data.payoutData.tieRate
      const adminID = data.payoutData.adminID
        //console.log('PayoutRoundDataAdminID IS???', adminID )
      if (outcome !== "") {
        try{
          // Start a transaction
          await session.startTransaction();
  
          // Find All Game Winners
          const winners = await strapi.query("current-round").find(
            {
              team: outcome,
              arena_id: roomID,
              round: Number(currentRoundNumber),
            },
            null,
            { session }
          );
        



          // Find All Game Losers
          const losers = await strapi.query("current-round").find(
            {
              team: {
                $ne: outcome,
              },
              arena_id: roomID,
              round: Number(currentRoundNumber),
            },
            null,
            { session }
          );

          //console.log('gameLosers', losers )

          const addAllIntegers = (array) => {
            let sum = 0;
            array.forEach((element) => {
              sum += Number(element.amount);
            });
            return sum;
          };

          const gameOutcomeType =
            outcome === "wala"
              ? "regular"
              : outcome === "meron"
              ? "regular"
              : outcome === "draw"
              ? "draw"
              : "cancel";
          
          const allWinnersTotal = addAllIntegers(winners);
          const allLosersTotal = addAllIntegers(losers);

          //  WE HAVE WINNERS AND LOSERS TO LIMIT QUERY
          if (outcome === "meron" || outcome === 'wala'){



                    
            if (allWinnersTotal > 0 && allLosersTotal > 0){


              console.log('payoutRoundData & and it started', data)


                // -------- this is for the winners add points-------------------------

              
                  //  ------delete current round data--------------
                  await strapi.query("current-round").delete({
                    arena_id: roomID,
                    round: Number(currentRoundNumber),
                  });
                  
                        //---unlock the round payout-----
                await io.in(roomID).emit("round_payout_outcome", {
                  success: true,
                });

                //---first-----map to all winners------------------
                winners.map(async (wins) => {
                      // ----second----query to find all winners------------------
                      const user = await strapi
                      .query("user", "users-permissions")
                      .findOne({ id: wins.user_id.id }, null, { session });
                      // ----winning amount calculation--------
                const winAndLoseTotal = Number(
                  allWinnersTotal + allLosersTotal
                );
                const dividedToWinners = Number(
                  winAndLoseTotal / allWinnersTotal
                );

                const winningAmount = Number(dividedToWinners * wins.amount);
                const plasadaRate = plasada / 100;

                const tongAmount = winningAmount * plasadaRate;
                const totalPayout = winningAmount - tongAmount;

                const totalAmount = Number(user.points + totalPayout);
              
                  
                    // ---third----query to add winners points
                    
                    await strapi
                      .query("user", "users-permissions")
                      .update(
                        { id: user.id },
                        { points: totalAmount },
                        { session }
                      );



                        // --------refresh player balance
                        io.to(roomID).emit(`refresh_player_balance`, 'refreshYouWin')
                  })




                

                 // -----------end  of winners add points--------------------








              // Payout Winners & commission distribution
              await Promise.all(
                winners.map(async (wins) => {
                  const user = await strapi
                    .query("user", "users-permissions")
                    .findOne({ id: wins.user_id.id }, null, { session });
    
                  const UserModel =
                    strapi.connections.default.models.UsersPermissionsUser;
                  const RoleModel =
                    strapi.connections.default.models.UsersPermissionsRole;
    
                  const referrerUser = await UserModel.findOne({
                    _id: user.id,
                  }).populate({
                    path: "referrer",
                    model: UserModel,
                    populate: [
                      {
                        path: "referrer",
                        model: UserModel,
                        populate: {
                          path: "referrer",
                          model: UserModel,
                          populate: {
                            path: "referrer",
                            model: UserModel,
                            populate: {
                              path: "referrer",
                              model: UserModel,
                            },
                          },
                        },
                      },
                      {
                        path: "role",
                        model: RoleModel,
                      },
                    ],
                  });
    
                  const data = [
                    {
                      user: referrerUser,
                      firstReferrer: referrerUser.referrer,
                      secondReferrer: referrerUser.referrer?.referrer,
                      thirdReferrer: referrerUser.referrer?.referrer?.referrer,
                      fourthReferrer:
                        referrerUser.referrer?.referrer?.referrer?.referrer,
                      fifthReferrer:
                        referrerUser.referrer?.referrer?.referrer?.referrer
                          ?.referrer,
                    },
                  ];
    
                  if (outcome === "draw") {

                            
                   
                   
                  
                     
                  } else { // Winner Regular Payout
                    
                    const winAndLoseTotal = Number(
                      allWinnersTotal + allLosersTotal
                    );
                    const dividedToWinners = Number(
                      winAndLoseTotal / allWinnersTotal
                    );
    
                    const winningAmount = Number(dividedToWinners * wins.amount);
                    const plasadaRate = plasada / 100;
    
                    const tongAmount = winningAmount * plasadaRate;
                    const totalPayout = winningAmount - tongAmount;
    
                    const totalAmount = Number(user.points + totalPayout);
    
                    // ** Agent Commission Distribution Start
                    let commissionArray = []

                    let commissionPercentage = []
                    
                    data.forEach((level) => {

                      Object.keys(level)
                        .filter((key) => key !== "user")
                        .forEach(async (key) => {
                          const item = level[key];

                          if(item !== undefined){
                            
                            if (key === "firstReferrer") {
                              const percentageAmount = item.role.type === "financer" ? item.CommissionRate :
                              item.role.type === "sub" ? item.CommissionRate  : 
                              item.role.type === "master" ?  item.CommissionRate :
                              item.role.type === "gold" ?  item.CommissionRate  : 0

                              
                              console.log('----------------------------------------------------------------------------')
                              console.log('WINNER')
                              console.log('FIRST REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                              

                              commissionArray.push(level[key].CommissionRate)
                              commissionPercentage.push(item.CommissionRate)
                              console.log('testTing this is the Data inside', item.commision)
                              console.log('commissionRateArray', commissionArray)
                              console.log('commissionPercentageArray', commissionPercentage)
                              console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                              console.log('Agent Referrer: ', level[key]?.referrer?.username , level[key]?.referrer?.CommissionRate)
                              console.log('Distribution Commission Rate Given', item.CommissionRate)

                           
                              const commissionPercentageRate = percentageAmount * 0.01
                              const newCommission = commissionPercentageRate * wins.amount 
                              console.log('Plasada Rate', plasada)
                              console.log('bet ammount ', wins.amount)
                              console.log('distribution commission', newCommission)
                              console.log('------------0------------------------0----------------------------0--------')
                            
                              await DistributeCommissions(percentageAmount, tongAmount, newCommission,
                                item.id, session, roomID, historyID, gameOutcomeType, 
                                wins.user_id.id, item.id, item.commision)

                            } else if(key === "secondReferrer"){
                              if (item && item.username) {
                                if(level["secondReferrer"].username === "swarrioradmin"){
                                  console.log('----------------------------------------------------------------------------')
                                  console.log('WINNER')
                                  console.log('SECONDE REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  commissionArray.push(level[key].CommissionRate) 
                                  const percentageAmount5 = plasada - commissionArray[commissionArray.length -2]  

                                  console.log('commissionRateArray', commissionArray)
                                  console.log('commissionPercentageArray', commissionPercentage)
                                  console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                  console.log('Agent Referrer: ', level["firstReferrer"].username , level["firstReferrer"].CommissionRate)
                                  console.log('Distribution Commission Rate Given', percentageAmount5)
                                  const commissionPercentageRate5 = percentageAmount5 * 0.01
                                  const newCommission5 = commissionPercentageRate5 * wins.amount


                                  console.log('Plasada Rate', plasada)
                                  console.log('bet ammount commission', wins.amount)
                                  console.log('distribution commission', newCommission5)
                                  console.log('------------0------------------------0----------------------------0--------')
                                  await DistributeCommissions(percentageAmount5, tongAmount, newCommission5 ,
                                    item.id, session, roomID, historyID, gameOutcomeType, 
                                    wins.user_id.id, item.id, item.commision)
                                  
                                }else{
                                console.log('2nd Refferer superADmin',level["secondReferrer"].username)
                                console.log('----------------------------------------------------------------------------')
                                console.log('WINNER')
                                  console.log('SECONDE REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  const percentageAmount1 = level["firstReferrer"].referrer.CommissionRate - level["firstReferrer"].CommissionRate
                          
                              commissionArray.push(level[key].CommissionRate)
                              commissionPercentage.push(percentageAmount1)
                              console.log('commissionRateArray', commissionArray)
                              console.log('commissionPercentageArray', commissionPercentage)
                              console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                              console.log('Agent Referrer: ', level["firstReferrer"].username , level["firstReferrer"].CommissionRate)
                              console.log('Distribution Commission Rate Given', percentageAmount1)
                              const commissionPercentageRate1 = percentageAmount1 * 0.01
                              const newCommission1 = commissionPercentageRate1 * wins.amount 
                              console.log('this is the tong amount', tongAmount)
                              console.log('this is the commission', item.commision)
                              console.log('bet ammount', wins.amount)
                          
                            console.log('Plasada Rate', plasada)
                              console.log('bet ammount commission', wins.amount)
                              console.log('distribution commission', newCommission1)
                             console.log('------------0------------------------0----------------------------0--------')

                              await DistributeCommissions(percentageAmount1, tongAmount, newCommission1 ,
                                item.id, session, roomID, historyID, gameOutcomeType, 
                                wins.user_id.id, item.id, item.commision)
                              }
                              }
                            }else if(key === "thirdReferrer" && level[key].username !== "swarrioradmin"){
                              if (item && item.username) {
                                console.log('----------------------------------------------------------------------------')
                                console.log('WINNER')
                                  console.log('THIRD REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  const percentageAmount2 = level["secondReferrer"].referrer.CommissionRate - level["secondReferrer"].CommissionRate
                          
                                  commissionArray.push(level[key].CommissionRate)
                                  commissionPercentage.push(percentageAmount2)
                                  console.log('commissionRateArray', commissionArray)
                                  console.log('commissionPercentageArray', commissionPercentage)
                                  console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                  console.log('Agent Referrer: ', level["secondReferrer"].username , level["secondReferrer"].CommissionRate)
                                  console.log('Distribution Commission Rate Given', percentageAmount2)
                                  console.log('this is the tong amount', tongAmount)
                                  console.log('this is the commission', item.commision)
                            
                                  const commissionPercentageRate2 = percentageAmount2 * 0.01
                                  const newCommission2 = commissionPercentageRate2 * wins.amount 
                            
                                  console.log('Plasada Rate', plasada)
                                  console.log('bet ammount commission', wins.amount)
                                  console.log('distribution commission', newCommission2)
                                      console.log('------------0------------------------0----------------------------0--------')    

                                      await DistributeCommissions(percentageAmount2, tongAmount, newCommission2,
                                        item.id, session, roomID, historyID, gameOutcomeType, 
                                        wins.user_id.id, item.id, item.commision)
                                      }
                            }else if(key ==="fourthReferrer" && level[key].username !== "swarrioradmin"){
                              if (item && item.username) {
                                console.log('----------------------------------------------------------------------------')
                                console.log('WINNER')
                                  console.log('FOURTH REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  const percentageAmount3 = level["thirdReferrer"].referrer.CommissionRate - level["thirdReferrer"].CommissionRate
                          
                                  commissionArray.push(level[key].CommissionRate)
                                  commissionPercentage.push(percentageAmount3)
                                  console.log('commissionRateArray', commissionArray)
                                  console.log('commissionPercentageArray',commissionPercentage)
                                  console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                  console.log('Agent Referrer: ', level["thirdReferrer"].username , level["thirdReferrer"].CommissionRate)
                                  console.log('Distribution Commission Rate Given', percentageAmount3)
    
                                  console.log('this is the tong amount', tongAmount)
                                  console.log('this is the commission', item.commision)
                               
                                  const commissionPercentageRate3 = percentageAmount3 * 0.01
                                  const newCommission3 = commissionPercentageRate3 * wins.amount 
                                  console.log('Plasada Rate', plasada)
                                  console.log('bet ammount commission', wins.amount)
                                  console.log('distribution commission', newCommission3)
                                          console.log('------------0------------------------0----------------------------0--------')    
                                          
                                          await DistributeCommissions(percentageAmount3, tongAmount, newCommission3 ,
                                            item.id, session, roomID, historyID, gameOutcomeType, 
                                            wins.user_id.id, item.id, item.commision)
                                          }
                            }else{
                             if (item && item.username) {
                              console.log('----------------------------------------------------------------------------')
                              console.log('WINNER')
                              console.log('LAST REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                              commissionArray.push(level[key].CommissionRate)
                                 
                                    const percentageAmount4 = plasada - commissionArray[commissionArray.length -2]
                              commissionPercentage.push(percentageAmount4)
                    
                              console.log('commissionRateArray', commissionArray)
                              console.log('commissionPercentageArray', commissionPercentage)
                              console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                              console.log('Agent Referrer: ', level[key]?.referrer?.username , level[key]?.referrer?.CommissionRate)
                              console.log('Distribution Commission Rate Given', percentageAmount4)
                                    

                              const commissionPercentageRate4 = percentageAmount4 * 0.01
                              const newCommission4 = commissionPercentageRate4 * wins.amount 
                              console.log('this is the tong amount', tongAmount)
                              console.log('this is the commission', item.commision)
                            
                              console.log('Plasada Rate', plasada)
                              console.log('bet ammount commission', wins.amount)
                                  console.log('distribution commission', newCommission4)
                                    console.log('------------0------------------------0----------------------------0--------')
                                  


                                    await DistributeCommissions(percentageAmount4, tongAmount, newCommission4,
                                      item.id, session, roomID, historyID, gameOutcomeType, 
                                      wins.user_id.id, item.id, item.commision)
                                  
                                    }
                                   
                                  
                             

                                 
                            }
                          }
                          
                        });
                    });
                    console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')
                    console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')
                    console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')
                    // ** Agent Commission Distribution End
    
                  
                  
                    // ** Winner User History Insert
                    await strapi.query("betting-logs").create(
                      {
                        type: "win",
                        round: currentRoundNumber,
                        betAmount: wins.amount,
                        team: wins.team,
                        arena_id: roomID,
                        user_id: wins.user_id.id,
                      },
                      { session }
                    );
    
                    // Winner user add points
                    // await strapi
                    //   .query("user", "users-permissions")
                    //   .update(
                    //     { id: user.id },
                    //     { points: totalAmount },
                    //     { session }
                    //   );
                  }
                })
                );
    
                // Deduct Losers Points
                await Promise.all(
                  losers.map(async (lost) => {
                    const user = await strapi

                      .query("user", "users-permissions")
                      .findOne({ id: lost.user_id.id }, null, { session });
    
                    const UserModel =
                      strapi.connections.default.models.UsersPermissionsUser;
                    const RoleModel =
                      strapi.connections.default.models.UsersPermissionsRole;
    
                    const referrerUser = await UserModel.findOne({
                      _id: user.id,
                    }).populate({
                      path: "referrer",
                      model: UserModel,
                      populate: [
                        {
                          path: "referrer",
                          model: UserModel,
                          populate: {
                            path: "referrer",
                            model: UserModel,
                            populate: {
                              path: "referrer",
                              model: UserModel,
                              populate: {
                                path: "referrer",
                                model: UserModel,
                              },
                            },
                          },
                        },
                        {
                          path: "role",
                          model: RoleModel,
                        },
                      ],
                    });
    
                    const data = [
                      {
                        user: referrerUser,
                        firstReferrer: referrerUser.referrer,
                        secondReferrer: referrerUser.referrer?.referrer,
                        thirdReferrer: referrerUser.referrer?.referrer?.referrer,
                        fourthReferrer:
                          referrerUser.referrer?.referrer?.referrer?.referrer,
                        fifthReferrer:
                          referrerUser.referrer?.referrer?.referrer?.referrer
                            ?.referrer,
                      },
                    ];
    
                    const winAndLoseTotal = Number(allWinnersTotal + allLosersTotal);
                    const dividedToWinners = Number(
                      winAndLoseTotal / allWinnersTotal
                    );
                    const lostAmount = Number(dividedToWinners * lost.amount);
                    const plasadaRate = plasada / 100;
                    const tongAmount = lostAmount * plasadaRate;
                    const losersAmount = Number(lost.amount);
    
                    // ** Commission Distribution Start

                    let commissionArray = []

                    let commissionPercentage = []
    
                    data.forEach((level) => {
                      Object.keys(level)
                        .filter((key) => key !== "user")
                        .forEach(async (key) => {
                          const item = level[key];

                          if(item !== undefined){
                            if (key === "firstReferrer") {
                              const percentageAmount = item.role.type === "financer" ? item.CommissionRate :
                              item.role.type === "sub" ? item.CommissionRate  : 
                              item.role.type === "master" ? item.CommissionRate :
                              item.role.type === "gold" ? item.CommissionRate : 0

                              console.log('----------------------------------------------------------------------------')
                              console.log('LOSER')
                              console.log('FIRST REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                              

                              commissionArray.push(level[key].CommissionRate)
                              commissionPercentage.push(item.CommissionRate)
                              console.log('commissionRateArray', commissionArray)
                              console.log('commissionPercentageArray', commissionPercentage)
                              console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                              console.log('Agent Referrer: ', level[key]?.referrer?.username , level[key]?.referrer?.CommissionRate)
                              console.log('Distribution Commission Rate Given', item.CommissionRate)

                           
                              const commissionPercentageRate = percentageAmount * 0.01
                              const newCommission = commissionPercentageRate * lost.amount 
                              console.log('Plasada Rate', plasada)
                              console.log('bet ammount ', lost.amount)
                              console.log('distribution commission', newCommission)
                              console.log('------------0------------------------0----------------------------0--------')
                            
                              await DistributeCommissions(percentageAmount, tongAmount, newCommission,
                                item.id, session, roomID, historyID, gameOutcomeType, 
                                lost.user_id.id, item.id, item.commision)
      
                              // await DistributeCommissions(percentageAmount, tongAmount, item.commision,
                              //   item.id, session, roomID, historyID, gameOutcomeType, 
                              //   lost.user_id.id, item.id)
                            }  else if(key === "secondReferrer"){
                              if (item && item.username) {
                                if(level["secondReferrer"].username === "swarrioradmin"){
                                  console.log('----------------------------------------------------------------------------')
                                  console.log('LOSER')
                                  console.log('SECONDE REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  commissionArray.push(level[key].CommissionRate) 
                                  const percentageAmount5 = plasada - commissionArray[commissionArray.length -2]  

                                  console.log('commissionRateArray', commissionArray)
                                  console.log('commissionPercentageArray', commissionPercentage)
                                  console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                  console.log('Agent Referrer: ', level["firstReferrer"].username , level["firstReferrer"].CommissionRate)
                                  console.log('Distribution Commission Rate Given', percentageAmount5)
                                  const commissionPercentageRate5 = percentageAmount5 * 0.01
                                  const newCommission5 = commissionPercentageRate5 * lost.amount


                                  console.log('Plasada Rate', plasada)
                                  console.log('bet ammount commission', lost.amount)
                                  console.log('distribution commission', newCommission5)
                                  console.log('------------0------------------------0----------------------------0--------')
                                  await DistributeCommissions(percentageAmount5, tongAmount, newCommission5 ,
                                    item.id, session, roomID, historyID, gameOutcomeType, 
                                    lost.user_id.id, item.id, item.commision)
                                  
                                }else{
                                console.log('2nd Refferer superADmin',level["secondReferrer"].username)
                                console.log('----------------------------------------------------------------------------')
                                console.log('LOSER')
                                  console.log('SECONDE REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  const percentageAmount1 = level["firstReferrer"].referrer.CommissionRate - level["firstReferrer"].CommissionRate
                          
                              commissionArray.push(level[key].CommissionRate)
                              commissionPercentage.push(percentageAmount1)
                              console.log('commissionRateArray', commissionArray)
                              console.log('commissionPercentageArray', commissionPercentage)
                              console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                              console.log('Agent Referrer: ', level["firstReferrer"].username , level["firstReferrer"].CommissionRate)
                              console.log('Distribution Commission Rate Given', percentageAmount1)
                              const commissionPercentageRate1 = percentageAmount1 * 0.01
                              const newCommission1 = commissionPercentageRate1 * lost.amount 
                              console.log('this is the tong amount', tongAmount)
                              console.log('this is the commission', item.commision)
                              console.log('bet ammount', lost.amount)
                          
                            console.log('Plasada Rate', plasada)
                              console.log('bet ammount commission', lost.amount)
                              console.log('distribution commission', newCommission1)
                             console.log('------------0------------------------0----------------------------0--------')

                              await DistributeCommissions(percentageAmount1, tongAmount, newCommission1 ,
                                item.id, session, roomID, historyID, gameOutcomeType, 
                                lost.user_id.id, item.id, item.commision)
                              }
                              }
                            }else if(key === "thirdReferrer" && level[key].username !== "swarrioradmin"){
                              if (item && item.username) {
                                console.log('----------------------------------------------------------------------------')
                                console.log('LOSER')
                                  console.log('THIRD REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  const percentageAmount2 = level["secondReferrer"].referrer.CommissionRate - level["secondReferrer"].CommissionRate
                          
                                  commissionArray.push(level[key].CommissionRate)
                                  commissionPercentage.push(percentageAmount2)
                                  console.log('commissionRateArray', commissionArray)
                                  console.log('commissionPercentageArray', commissionPercentage)
                                  console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                  console.log('Agent Referrer: ', level["secondReferrer"].username , level["secondReferrer"].CommissionRate)
                                  console.log('Distribution Commission Rate Given', percentageAmount2)
                                  console.log('this is the tong amount', tongAmount)
                                  console.log('this is the commission', item.commision)
                            
                                  const commissionPercentageRate2 = percentageAmount2 * 0.01
                                  const newCommission2 = commissionPercentageRate2 * lost.amount 
                            
                                  console.log('Plasada Rate', plasada)
                                  console.log('bet ammount commission', lost.amount)
                                  console.log('distribution commission', newCommission2)
                                      console.log('------------0------------------------0----------------------------0--------')    

                                      await DistributeCommissions(percentageAmount2, tongAmount, newCommission2,
                                        item.id, session, roomID, historyID, gameOutcomeType, 
                                        lost.user_id.id, item.id, item.commision)
                                      }
                            }else if(key ==="fourthReferrer" && level[key].username !== "swarrioradmin"){
                              if (item && item.username) {
                                console.log('----------------------------------------------------------------------------')
                                console.log('LOSER')
                                  console.log('FOURTH REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  const percentageAmount3 = level["thirdReferrer"].referrer.CommissionRate - level["thirdReferrer"].CommissionRate
                          
                                  commissionArray.push(level[key].CommissionRate)
                                  commissionPercentage.push(percentageAmount3)
                                  console.log('commissionRateArray', commissionArray)
                                  console.log('commissionPercentageArray',commissionPercentage)
                                  console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                  console.log('Agent Referrer: ', level["thirdReferrer"].username , level["thirdReferrer"].CommissionRate)
                                  console.log('Distribution Commission Rate Given', percentageAmount3)
    
                                  console.log('this is the tong amount', tongAmount)
                                  console.log('this is the commission', item.commision)
                               
                                  const commissionPercentageRate3 = percentageAmount3 * 0.01
                                  const newCommission3 = commissionPercentageRate3 * lost.amount 
                                  console.log('Plasada Rate', plasada)
                                  console.log('bet ammount commission', lost.amount)
                                  console.log('distribution commission', newCommission3)
                                          console.log('------------0------------------------0----------------------------0--------')    
                                          
                                          await DistributeCommissions(percentageAmount3, tongAmount, newCommission3 ,
                                            item.id, session, roomID, historyID, gameOutcomeType, 
                                            lost.user_id.id, item.id, item.commision)
                                          }
                            }else{
                             if (item && item.username) {
                              console.log('----------------------------------------------------------------------------')
                              console.log('LOSER')
                              console.log('LAST REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                              commissionArray.push(level[key].CommissionRate)
                                 
                                    const percentageAmount4 = plasada - commissionArray[commissionArray.length -2]
                              commissionPercentage.push(percentageAmount4)
                    
                              console.log('commissionRateArray', commissionArray)
                              console.log('commissionPercentageArray', commissionPercentage)
                              console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                              console.log('Agent Referrer: ', level[key]?.referrer?.username , level[key]?.referrer?.CommissionRate)
                              console.log('Distribution Commission Rate Given', percentageAmount4)
                                    

                              const commissionPercentageRate4 = percentageAmount4 * 0.01
                              const newCommission4 = commissionPercentageRate4 * lost.amount 
                              console.log('this is the tong amount', tongAmount)
                              console.log('this is the commission', item.commision)
                            
                              console.log('Plasada Rate', plasada)
                              console.log('bet ammount commission', lost.amount)
                                  console.log('distribution commission', newCommission4)
                                    console.log('------------0------------------------0----------------------------0--------')
                                  


                                    await DistributeCommissions(percentageAmount4, tongAmount, newCommission4,
                                      item.id, session, roomID, historyID, gameOutcomeType, 
                                      lost.user_id.id, item.id, item.commision)
                                  
                                    } 
                            }



                          }
    
                          
                        });
                    });
    
                    // ** Commission Distribution End
                    console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')
                    console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')
                    console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')
    
                    // ** Lose Wallet Insertion
                    // const AdminLoseWallet = await strapi
                    //   .query("user", "users-permissions")
                    //   .findOne(
                    //     {
                    //       "role.type": "superadmin",
                    //     },
                    //     null,
                    //     { session }
                    //   );
    
                    // const lostWalletTotal = Number(
                    //   AdminLoseWallet.loseWallet +losersAmount
                    // );
    
                    // await strapi.query("user", "users-permissions").update(
                    //   {
                    //     id: AdminLoseWallet.id,
                    //   },
                    //   {
                    //     loseWallet: lostWalletTotal,
                    //   },
                    //   { session }
                    // );
    
                    // ** Lose User History Insert
                    await strapi.query("betting-logs").create(
                      {
                        type: "lose",
                        round: currentRoundNumber,
                        betAmount: lost.amount,
                        team: lost.team,
                        arena_id: roomID,
                        user_id: lost.user_id.id,
                      },
                      { session }
                    );
                  })
                );
            }else{
              //  cancel game here
              await CancelGame(roomID, currentRoundNumber, session)
            }
          }else if(outcome === 'draw'){
           
              //check if draw doesent have a winner
              if(winners.length === 0){


                    //  ------delete current round data--------------
                    await strapi.query("current-round").delete({
                      arena_id: roomID,
                      round: Number(currentRoundNumber),
                    });
                    
                          //---unlock the round payout-----
                  await io.in(roomID).emit("round_payout_outcome", {
                    success: true,
                  });

              await Promise.all(
                losers.map(async (lost) => {
                  const user = await strapi
                    .query("user", "users-permissions")
                    .findOne({ id: lost.user_id.id }, null, { session });
    
                  const UserModel =
                    strapi.connections.default.models.UsersPermissionsUser;
                  const RoleModel =
                    strapi.connections.default.models.UsersPermissionsRole;
    
                  const referrerUser = await UserModel.findOne({
                    _id: user.id,
                  }).populate({
                    path: "referrer",
                    model: UserModel,
                    populate: [
                      {
                        path: "referrer",
                        model: UserModel,
                        populate: {
                          path: "referrer",
                          model: UserModel,
                          populate: {
                            path: "referrer",
                            model: UserModel,
                            populate: {
                              path: "referrer",
                              model: UserModel,
                            },
                          },
                        },
                      },
                      {
                        path: "role",
                        model: RoleModel,
                      },
                    ],
                  });

                  const data = [
                    {
                      user: referrerUser,
                      firstReferrer: referrerUser.referrer,
                      secondReferrer: referrerUser.referrer?.referrer,
                      thirdReferrer: referrerUser.referrer?.referrer?.referrer,
                      fourthReferrer:
                        referrerUser.referrer?.referrer?.referrer?.referrer,
                      fifthReferrer:
                        referrerUser.referrer?.referrer?.referrer?.referrer
                          ?.referrer,
                    },
                  ];
    
                


                  // const loseAmount = lose.amount * tieRate;
                  const plasadaRate = plasada / 100;
      
                  const tongAmount = lost.amount * plasadaRate;
                  const totalPayout = lost.amount - tongAmount;
      
                  const totalAmount = Number(+user.points + +totalPayout);


                  //console.log('thisConsoleTriggered1', totalPayout)


                  let commissionArray = []

                  let commissionPercentage = []
                  // if(allLosersTotal > 0){
                      //console.log('allwinnersTriggered')
                    data.forEach((level) => {
                      Object.keys(level)
                        .filter((key) => key !== "user")
                        .forEach(async (key) => {
                          const item = level[key];


                          if(item !== undefined){
                            if (key === "firstReferrer") {
                              const percentageAmount = item.role.type === "financer" ? item.CommissionRate  :
                              item.role.type === "sub" ? item.CommissionRate  : 
                              item.role.type === "master" ? item.CommissionRate  :
                              item.role.type === "gold" ? item.CommissionRate  : 0
        
                              // await DistributeCommissions(percentageAmount, tongAmount, item.commision,
                              //   item.id, session, roomID, historyID, gameOutcomeType, 
                              //   lose.user_id.id, item.id)
                              console.log('----------------------------------------------------------------------------')
                              console.log('LOSER')
                              console.log('FIRST REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                              

                              commissionArray.push(level[key].CommissionRate)
                              commissionPercentage.push(item.CommissionRate)
                              console.log('commissionRateArray', commissionArray)
                              console.log('commissionPercentageArray', commissionPercentage)
                              console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                              console.log('Agent Referrer: ', level[key]?.referrer?.username , level[key]?.referrer?.CommissionRate)
                              console.log('Distribution Commission Rate Given', item.CommissionRate)

                           
                              const commissionPercentageRate = percentageAmount * 0.01
                              const newCommission = commissionPercentageRate * lost.amount 
                              console.log('Plasada Rate', plasada)
                              console.log('bet ammount ', lost.amount)
                              console.log('distribution commission', newCommission)
                              console.log('------------0------------------------0----------------------------0--------')
                            
                              await DistributeCommissions(percentageAmount, tongAmount, newCommission,
                                item.id, session, roomID, historyID, gameOutcomeType, 
                                lost.user_id.id, item.id, item.commision)
                            }else if(key === "secondReferrer"){
                              if (item && item.username) {
                                if(level["secondReferrer"].username === "swarrioradmin"){
                                  console.log('----------------------------------------------------------------------------')
                                  console.log('LOSER')
                                  console.log('SECONDE REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  commissionArray.push(level[key].CommissionRate) 
                                  const percentageAmount5 = plasada - commissionArray[commissionArray.length -2]  

                                  console.log('commissionRateArray', commissionArray)
                                  console.log('commissionPercentageArray', commissionPercentage)
                                  console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                  console.log('Agent Referrer: ', level["firstReferrer"].username , level["firstReferrer"].CommissionRate)
                                  console.log('Distribution Commission Rate Given', percentageAmount5)
                                  const commissionPercentageRate5 = percentageAmount5 * 0.01
                                  const newCommission5 = commissionPercentageRate5 * lost.amount


                                  console.log('Plasada Rate', plasada)
                                  console.log('bet ammount commission', lost.amount)
                                  console.log('distribution commission', newCommission5)
                                  console.log('------------0------------------------0----------------------------0--------')
                                  await DistributeCommissions(percentageAmount5, tongAmount, newCommission5 ,
                                    item.id, session, roomID, historyID, gameOutcomeType, 
                                    lost.user_id.id, item.id, item.commision)
                                  
                                }else{
                                console.log('2nd Refferer superADmin',level["secondReferrer"].username)
                                console.log('----------------------------------------------------------------------------')
                                console.log('LOSER')
                                  console.log('SECONDE REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  const percentageAmount1 = level["firstReferrer"].referrer.CommissionRate - level["firstReferrer"].CommissionRate
                          
                              commissionArray.push(level[key].CommissionRate)
                              commissionPercentage.push(percentageAmount1)
                              console.log('commissionRateArray', commissionArray)
                              console.log('commissionPercentageArray', commissionPercentage)
                              console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                              console.log('Agent Referrer: ', level["firstReferrer"].username , level["firstReferrer"].CommissionRate)
                              console.log('Distribution Commission Rate Given', percentageAmount1)
                              const commissionPercentageRate1 = percentageAmount1 * 0.01
                              const newCommission1 = commissionPercentageRate1 * lost.amount 
                              console.log('this is the tong amount', tongAmount)
                              console.log('this is the commission', item.commision)
                              console.log('bet ammount', lost.amount)
                          
                            console.log('Plasada Rate', plasada)
                              console.log('bet ammount commission', lost.amount)
                              console.log('distribution commission', newCommission1)
                             console.log('------------0------------------------0----------------------------0--------')

                              await DistributeCommissions(percentageAmount1, tongAmount, newCommission1 ,
                                item.id, session, roomID, historyID, gameOutcomeType, 
                                lost.user_id.id, item.id, item.commision)
                              }
                              }
                            }else if(key === "thirdReferrer" && level[key].username !== "swarrioradmin"){
                              if (item && item.username) {
                                console.log('----------------------------------------------------------------------------')
                                console.log('LOSER')
                                  console.log('THIRD REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  const percentageAmount2 = level["secondReferrer"].referrer.CommissionRate - level["secondReferrer"].CommissionRate
                          
                                  commissionArray.push(level[key].CommissionRate)
                                  commissionPercentage.push(percentageAmount2)
                                  console.log('commissionRateArray', commissionArray)
                                  console.log('commissionPercentageArray', commissionPercentage)
                                  console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                  console.log('Agent Referrer: ', level["secondReferrer"].username , level["secondReferrer"].CommissionRate)
                                  console.log('Distribution Commission Rate Given', percentageAmount2)
                                  console.log('this is the tong amount', tongAmount)
                                  console.log('this is the commission', item.commision)
                            
                                  const commissionPercentageRate2 = percentageAmount2 * 0.01
                                  const newCommission2 = commissionPercentageRate2 * lost.amount 
                            
                                  console.log('Plasada Rate', plasada)
                                  console.log('bet ammount commission', lost.amount)
                                  console.log('distribution commission', newCommission2)
                                      console.log('------------0------------------------0----------------------------0--------')    

                                      await DistributeCommissions(percentageAmount2, tongAmount, newCommission2,
                                        item.id, session, roomID, historyID, gameOutcomeType, 
                                        lost.user_id.id, item.id, item.commision)
                                      }
                            }else if(key ==="fourthReferrer" && level[key].username !== "swarrioradmin"){
                              if (item && item.username) {
                                console.log('----------------------------------------------------------------------------')
                                console.log('LOSER')
                                  console.log('FOURTH REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                  const percentageAmount3 = level["thirdReferrer"].referrer.CommissionRate - level["thirdReferrer"].CommissionRate
                          
                                  commissionArray.push(level[key].CommissionRate)
                                  commissionPercentage.push(percentageAmount3)
                                  console.log('commissionRateArray', commissionArray)
                                  console.log('commissionPercentageArray',commissionPercentage)
                                  console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                  console.log('Agent Referrer: ', level["thirdReferrer"].username , level["thirdReferrer"].CommissionRate)
                                  console.log('Distribution Commission Rate Given', percentageAmount3)
    
                                  console.log('this is the tong amount', tongAmount)
                                  console.log('this is the commission', item.commision)
                               
                                  const commissionPercentageRate3 = percentageAmount3 * 0.01
                                  const newCommission3 = commissionPercentageRate3 * lost.amount 
                                  console.log('Plasada Rate', plasada)
                                  console.log('bet ammount commission', lost.amount)
                                  console.log('distribution commission', newCommission3)
                                          console.log('------------0------------------------0----------------------------0--------')    
                                          
                                          await DistributeCommissions(percentageAmount3, tongAmount, newCommission3 ,
                                            item.id, session, roomID, historyID, gameOutcomeType, 
                                            lost.user_id.id, item.id, item.commision)
                                          }
                            }else{
                             if (item && item.username) {
                              console.log('----------------------------------------------------------------------------')
                              console.log('LOSER')
                              console.log('LAST REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                              commissionArray.push(level[key].CommissionRate)
                                 
                                    const percentageAmount4 = plasada - commissionArray[commissionArray.length -2]
                              commissionPercentage.push(percentageAmount4)
                    
                              console.log('commissionRateArray', commissionArray)
                              console.log('commissionPercentageArray', commissionPercentage)
                              console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                              console.log('Agent Referrer: ', level[key]?.referrer?.username , level[key]?.referrer?.CommissionRate)
                              console.log('Distribution Commission Rate Given', percentageAmount4)
                                    

                              const commissionPercentageRate4 = percentageAmount4 * 0.01
                              const newCommission4 = commissionPercentageRate4 * lost.amount 
                              console.log('this is the tong amount', tongAmount)
                              console.log('this is the commission', item.commision)
                            
                              console.log('Plasada Rate', plasada)
                              console.log('bet ammount commission', lost.amount)
                                  console.log('distribution commission', newCommission4)
                                    console.log('------------0------------------------0----------------------------0--------')
                                  


                                    await DistributeCommissions(percentageAmount4, tongAmount, newCommission4,
                                      item.id, session, roomID, historyID, gameOutcomeType, 
                                      lost.user_id.id, item.id, item.commision)
                                  
                                    } 
                            }


                          }           
                        });
                    });

                      // ** Commission Distribution End
                      console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')
                      console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')
                      console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')

                       // ** Lose User History Insert
                       await strapi.query("betting-logs").create(
                        {
                          type: "lose",
                          round: currentRoundNumber,
                          betAmount: lost.amount,
                          team: lost.team,
                          arena_id: roomID,
                          user_id: lost.user_id.id,
                        },
                        { session }
                      );


                              

                 
                  const response = await strapi.query("user", "users-permissions").findOne({
                    id: adminID
                  });


                  //adds all losers points and calculate tong amount to be deducted, the remaining points will be sent to superadmin points
                 
                   const overallTongAmount = allLosersTotal * plasadaRate
                   //console.log('overallTongAmount', overallTongAmount )
                   const totalPointsToBeAdded = allLosersTotal - overallTongAmount 
                   //console.log('totalPointsToBeAdded', totalPointsToBeAdded)
                   const addPointsToAdmin = response.points + totalPointsToBeAdded 
                   //console.log('addPointsToAdmin', addPointsToAdmin)
                    //add points to admin----------------------------------------------------
                    //console.log('winAAddedPoints', response.points)
              const adminAddedPoints = await strapi
                  .query("user", "users-permissions")
                  .update(
                    { id: adminID },
                    { points: addPointsToAdmin },
                    { session }
                  );

                  //console.log('draw has no winners this has triggered and ran', adminAddedPoints)

                }))
                  
              }else{

                //console.log('there is a winner')
          // Payout Winners--------------------------------------------------------------------------

          
                    //  ------delete current round data--------------
                    await strapi.query("current-round").delete({
                      arena_id: roomID,
                      round: Number(currentRoundNumber),
                    });
                    
                          //---unlock the round payout-----
                  await io.in(roomID).emit("round_payout_outcome", {
                    success: true,
                  });


                  // -----points distribution----
                
                  winners.map(async (wins) => {
                    // ----second----query to find all winners------------------
                    const user = await strapi
                    .query("user", "users-permissions")
                    .findOne({ id: wins.user_id.id }, null, { session });
                    // ----winning amount calculation--------
                    const winnerAmount = wins.amount * tieRate;
                    const plasadaRate = plasada / 100;
        
                    const tongAmount = winnerAmount * plasadaRate;
                    const totalPayout = winnerAmount - tongAmount;
        
                    const totalAmount = Number(+user.points + +totalPayout);

                          // ** Winner user Add points
                  const winAddedPoints = await strapi
                  .query("user", "users-permissions")
                  .update(
                    { id: user.id },
                    { points: totalAmount },
                    { session }
                  );

                      // --------refresh player balance
                      io.to(roomID).emit(`refresh_player_balance`, 'refreshYouWin')
  
                  })
                  // ----------end of points distribution-----------

              await Promise.all(
                winners.map(async (wins) => {
                  const user = await strapi
                    .query("user", "users-permissions")
                    .findOne({ id: wins.user_id.id }, null, { session });
    
                  const UserModel =
                    strapi.connections.default.models.UsersPermissionsUser;
                  const RoleModel =
                    strapi.connections.default.models.UsersPermissionsRole;
    
                  const referrerUser = await UserModel.findOne({
                    _id: user.id,
                  }).populate({
                    path: "referrer",
                    model: UserModel,
                    populate: [
                      {
                        path: "referrer",
                        model: UserModel,
                        populate: {
                          path: "referrer",
                          model: UserModel,
                          populate: {
                            path: "referrer",
                            model: UserModel,
                            populate: {
                              path: "referrer",
                              model: UserModel,
                            },
                          },
                        },
                      },
                      {
                        path: "role",
                        model: RoleModel,
                      },
                    ],
                  });
    
                  const data = [
                    {
                      user: referrerUser,
                      firstReferrer: referrerUser.referrer,
                      secondReferrer: referrerUser.referrer?.referrer,
                      thirdReferrer: referrerUser.referrer?.referrer?.referrer,
                      fourthReferrer:
                        referrerUser.referrer?.referrer?.referrer?.referrer,
                      fifthReferrer:
                        referrerUser.referrer?.referrer?.referrer?.referrer
                          ?.referrer,
                    },
                  ];


                  const winnerAmount = wins.amount * tieRate;
                  const plasadaRate = plasada / 100;
      
                  const tongAmount = winnerAmount * plasadaRate;
                  const totalPayout = winnerAmount - tongAmount;
      
                  const totalAmount = Number(+user.points + +totalPayout);


                  //console.log('thisConsoleTriggered2', totalAmount)


                  if(allWinnersTotal > 0){
                      //console.log('allwinnersTriggered')
                      let commissionArray = []

                      let commissionPercentage = []

                    data.forEach((level) => {
                      Object.keys(level)
                        .filter((key) => key !== "user")
                        .forEach(async (key) => {
                          const item = level[key];
                            if(item !== undefined){
                              if (key === "firstReferrer") {
                                const percentageAmount = item.role.type === "financer" ? item.CommissionRate :
                                item.role.type === "sub" ? item.CommissionRate: 
                                item.role.type === "master" ? item.CommissionRate :
                                item.role.type === "gold" ? item.CommissionRate : 0
          

                                console.log('----------------------------------------------------------------------------')
                                console.log('WINNER')
                                console.log('FIRST REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                
  
                                commissionArray.push(level[key].CommissionRate)
                                commissionPercentage.push(item.CommissionRate)
                                console.log('commissionRateArray', commissionArray)
                                console.log('commissionPercentageArray', commissionPercentage)
                                console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                console.log('Agent Referrer: ', level[key]?.referrer?.username , level[key]?.referrer?.CommissionRate)
                                console.log('Distribution Commission Rate Given', item.CommissionRate)
  
                             
                                const commissionPercentageRate = percentageAmount * 0.01
                                const newCommission = commissionPercentageRate * wins.amount 
                                console.log('Plasada Rate', plasada)
                                console.log('bet ammount ', wins.amount)
                                console.log('distribution commission', newCommission)
                                console.log('------------0------------------------0----------------------------0--------')
                              
                                await DistributeCommissions(percentageAmount, tongAmount, newCommission,
                                  item.id, session, roomID, historyID, gameOutcomeType, 
                                  wins.user_id.id, item.id, item.commision)
        
                                // await DistributeCommissions(percentageAmount, tongAmount, item.commision,
                                //   item.id, session, roomID, historyID, gameOutcomeType, 
                                //   wins.user_id.id, item.id)



                              }else if(key === "secondReferrer"){
                                if (item && item.username) {
                                  if(level["secondReferrer"].username === "swarrioradmin"){
                                    console.log('----------------------------------------------------------------------------')
                                    console.log('WINNER')
                                    console.log('SECONDE REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                    commissionArray.push(level[key].CommissionRate) 
                                    const percentageAmount5 = plasada - commissionArray[commissionArray.length -2]  
  
                                    console.log('commissionRateArray', commissionArray)
                                    console.log('commissionPercentageArray', commissionPercentage)
                                    console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                    console.log('Agent Referrer: ', level["firstReferrer"].username , level["firstReferrer"].CommissionRate)
                                    console.log('Distribution Commission Rate Given', percentageAmount5)
                                    const commissionPercentageRate5 = percentageAmount5 * 0.01
                                    const newCommission5 = commissionPercentageRate5 * wins.amount
  
  
                                    console.log('Plasada Rate', plasada)
                                    console.log('bet ammount commission', wins.amount)
                                    console.log('distribution commission', newCommission5)
                                    console.log('------------0------------------------0----------------------------0--------')
                                    await DistributeCommissions(percentageAmount5, tongAmount, newCommission5 ,
                                      item.id, session, roomID, historyID, gameOutcomeType, 
                                      wins.user_id.id, item.id, item.commision)
                                    
                                  }else{
                                  console.log('2nd Refferer superADmin',level["secondReferrer"].username)
                                  console.log('----------------------------------------------------------------------------')
                                  console.log('WINNER')
                                    console.log('SECONDE REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                    const percentageAmount1 = level["firstReferrer"].referrer.CommissionRate - level["firstReferrer"].CommissionRate
                            
                                commissionArray.push(level[key].CommissionRate)
                                commissionPercentage.push(percentageAmount1)
                                console.log('commissionRateArray', commissionArray)
                                console.log('commissionPercentageArray', commissionPercentage)
                                console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                console.log('Agent Referrer: ', level["firstReferrer"].username , level["firstReferrer"].CommissionRate)
                                console.log('Distribution Commission Rate Given', percentageAmount1)
                                const commissionPercentageRate1 = percentageAmount1 * 0.01
                                const newCommission1 = commissionPercentageRate1 * wins.amount 
                                console.log('this is the tong amount', tongAmount)
                                console.log('this is the commission', item.commision)
                                console.log('bet ammount', wins.amount)
                            
                              console.log('Plasada Rate', plasada)
                                console.log('bet ammount commission', wins.amount)
                                console.log('distribution commission', newCommission1)
                               console.log('------------0------------------------0----------------------------0--------')
  
                                await DistributeCommissions(percentageAmount1, tongAmount, newCommission1 ,
                                  item.id, session, roomID, historyID, gameOutcomeType, 
                                  wins.user_id.id, item.id, item.commision)
                                }
                                }
                              }else if(key === "thirdReferrer" && level[key].username !== "swarrioradmin"){
                                if (item && item.username) {
                                  console.log('----------------------------------------------------------------------------')
                                  console.log('WINNER')
                                    console.log('THIRD REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                    const percentageAmount2 = level["secondReferrer"].referrer.CommissionRate - level["secondReferrer"].CommissionRate
                            
                                    commissionArray.push(level[key].CommissionRate)
                                    commissionPercentage.push(percentageAmount2)
                                    console.log('commissionRateArray', commissionArray)
                                    console.log('commissionPercentageArray', commissionPercentage)
                                    console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                    console.log('Agent Referrer: ', level["secondReferrer"].username , level["secondReferrer"].CommissionRate)
                                    console.log('Distribution Commission Rate Given', percentageAmount2)
                                    console.log('this is the tong amount', tongAmount)
                                    console.log('this is the commission', item.commision)
                              
                                    const commissionPercentageRate2 = percentageAmount2 * 0.01
                                    const newCommission2 = commissionPercentageRate2 * wins.amount 
                              
                                    console.log('Plasada Rate', plasada)
                                    console.log('bet ammount commission', wins.amount)
                                    console.log('distribution commission', newCommission2)
                                        console.log('------------0------------------------0----------------------------0--------')    
  
                                        await DistributeCommissions(percentageAmount2, tongAmount, newCommission2,
                                          item.id, session, roomID, historyID, gameOutcomeType, 
                                          wins.user_id.id, item.id, item.commision)
                                        }
                              }else if(key ==="fourthReferrer" && level[key].username !== "swarrioradmin"){
                                if (item && item.username) {
                                  console.log('----------------------------------------------------------------------------')
                                  console.log('WINNER')
                                    console.log('FOURTH REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                    const percentageAmount3 = level["thirdReferrer"].referrer.CommissionRate - level["thirdReferrer"].CommissionRate
                            
                                    commissionArray.push(level[key].CommissionRate)
                                    commissionPercentage.push(percentageAmount3)
                                    console.log('commissionRateArray', commissionArray)
                                    console.log('commissionPercentageArray',commissionPercentage)
                                    console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                    console.log('Agent Referrer: ', level["thirdReferrer"].username , level["thirdReferrer"].CommissionRate)
                                    console.log('Distribution Commission Rate Given', percentageAmount3)
      
                                    console.log('this is the tong amount', tongAmount)
                                    console.log('this is the commission', item.commision)
                                 
                                    const commissionPercentageRate3 = percentageAmount3 * 0.01
                                    const newCommission3 = commissionPercentageRate3 * wins.amount 
                                    console.log('Plasada Rate', plasada)
                                    console.log('bet ammount commission', wins.amount)
                                    console.log('distribution commission', newCommission3)
                                            console.log('------------0------------------------0----------------------------0--------')    
                                            
                                            await DistributeCommissions(percentageAmount3, tongAmount, newCommission3 ,
                                              item.id, session, roomID, historyID, gameOutcomeType, 
                                              wins.user_id.id, item.id, item.commision)
                                            }
                              }else{
                               if (item && item.username) {
                                console.log('----------------------------------------------------------------------------')
                                console.log('WINNER')
                                console.log('LAST REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                commissionArray.push(level[key].CommissionRate)
                                   
                                      const percentageAmount4 = plasada - commissionArray[commissionArray.length -2]
                                commissionPercentage.push(percentageAmount4)
                      
                                console.log('commissionRateArray', commissionArray)
                                console.log('commissionPercentageArray', commissionPercentage)
                                console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                console.log('Agent Referrer: ', level[key]?.referrer?.username , level[key]?.referrer?.CommissionRate)
                                console.log('Distribution Commission Rate Given', percentageAmount4)
                                      
  
                                const commissionPercentageRate4 = percentageAmount4 * 0.01
                                const newCommission4 = commissionPercentageRate4 * wins.amount 
                                console.log('this is the tong amount', tongAmount)
                                console.log('this is the commission', item.commision)
                              
                                console.log('Plasada Rate', plasada)
                                console.log('bet ammount commission', wins.amount)
                                    console.log('distribution commission', newCommission4)
                                      console.log('------------0------------------------0----------------------------0--------')
                                    
  
  
                                      await DistributeCommissions(percentageAmount4, tongAmount, newCommission4,
                                        item.id, session, roomID, historyID, gameOutcomeType, 
                                        wins.user_id.id, item.id, item.commision)
                                    
                                      }
                                     
                                    
                               
  
                                   
                              }
                            }
                         
                        });
                    });

                      // ** Commission Distribution End
                      console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')
                      console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')
                      console.log('----------------------------------------------------------------------------------------Distrubution end----------------------------------------------------')
      
                        // const winnerOutcome = 'win'
      
                  //   // ** Winner user Add points
                  // const winAddedPoints = await strapi
                  //     .query("user", "users-permissions")
                  //     .update(
                  //       { id: user.id },
                  //       { points: totalAmount },
                  //       { session }
                  //     );
                      //console.log('winAAddedPoints', winAddedPoints)

                         
                    // ** Winner User History Insert
                    await strapi.query("betting-logs").create(
                      {
                        type: "win",
                        round: currentRoundNumber,
                        betAmount: wins.amount,
                        team: wins.team,
                        arena_id: roomID,
                        user_id: wins.user_id.id,
                      },
                      { session }
                    );


                    // ---------------------------------------------------------------------

                           // Deduct Losers Points
                await Promise.all(
                  losers.map(async (lost) => {
                    const user = await strapi
                      .query("user", "users-permissions")
                      .findOne({ id: lost.user_id.id }, null, { session });
    
                    const UserModel =
                      strapi.connections.default.models.UsersPermissionsUser;
                    const RoleModel =
                      strapi.connections.default.models.UsersPermissionsRole;
    
                    const referrerUser = await UserModel.findOne({
                      _id: user.id,
                    }).populate({
                      path: "referrer",
                      model: UserModel,
                      populate: [
                        {
                          path: "referrer",
                          model: UserModel,
                          populate: {
                            path: "referrer",
                            model: UserModel,
                            populate: {
                              path: "referrer",
                              model: UserModel,
                              populate: {
                                path: "referrer",
                                model: UserModel,
                              },
                            },
                          },
                        },
                        {
                          path: "role",
                          model: RoleModel,
                        },
                      ],
                    });
    
                    const data = [
                      {
                        user: referrerUser,
                        firstReferrer: referrerUser.referrer,
                        secondReferrer: referrerUser.referrer?.referrer,
                        thirdReferrer: referrerUser.referrer?.referrer?.referrer,
                        fourthReferrer:
                          referrerUser.referrer?.referrer?.referrer?.referrer,
                        fifthReferrer:
                          referrerUser.referrer?.referrer?.referrer?.referrer
                            ?.referrer,
                      },
                    ];
    
                    const winAndLoseTotal = Number(allWinnersTotal + allLosersTotal);
                    const dividedToWinners = Number(
                      winAndLoseTotal / allWinnersTotal
                    );
                    const lostAmount = Number(dividedToWinners * lost.amount);
                    const plasadaRate = plasada / 100;
                    const tongAmount = lostAmount * plasadaRate;
                    const losersAmount = Number(lost.amount);
    
                    // ** Commission Distribution Start
    
                    let commissionArray = []

                  let commissionPercentage = []
                    data.forEach((level) => {
                      Object.keys(level)
                        .filter((key) => key !== "user")
                        .forEach(async (key) => {
                          const item = level[key];
                          if(item !== undefined){
                          if (key === "firstReferrer") {
                            const percentageAmount = item.role.type === "financer" ? item.CommissionRate :
                            item.role.type === "sub" ? item.CommissionRate : 
                            item.role.type === "master" ? item.CommissionRate :
                            item.role.type === "gold" ? item.CommissionRate : 0
    
                            // await DistributeCommissions(percentageAmount, tongAmount, item.commision,
                            //   item.id, session, roomID, historyID, gameOutcomeType, 
                            //   lost.user_id.id, item.id)
                            console.log('----------------------------------------------------------------------------')
                            console.log('LOSER')
                            console.log('FIRST REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                            

                            commissionArray.push(level[key].CommissionRate)
                            commissionPercentage.push(item.CommissionRate)
                            console.log('commissionRateArray', commissionArray)
                            console.log('commissionPercentageArray', commissionPercentage)
                            console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                            console.log('Agent Referrer: ', level[key]?.referrer?.username , level[key]?.referrer?.CommissionRate)
                            console.log('Distribution Commission Rate Given', item.CommissionRate)

                         
                            const commissionPercentageRate = percentageAmount * 0.01
                            const newCommission = commissionPercentageRate * lost.amount 
                            console.log('Plasada Rate', plasada)
                            console.log('bet ammount ', lost.amount)
                            console.log('distribution commission', newCommission)
                            console.log('------------0------------------------0----------------------------0--------')
                            await DistributeCommissions(percentageAmount, tongAmount, newCommission ,
                              item.id, session, roomID, historyID, gameOutcomeType, 
                              lost.user_id.id, item.id, item.commision)
                          } else if(key === "secondReferrer"){
                            if (item && item.username) {
                              if(level["secondReferrer"].username === "swarrioradmin"){
                                console.log('----------------------------------------------------------------------------')
                                console.log('LOSER')
                                console.log('SECONDE REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                commissionArray.push(level[key].CommissionRate) 
                                const percentageAmount5 = plasada - commissionArray[commissionArray.length -2]  

                                console.log('commissionRateArray', commissionArray)
                                console.log('commissionPercentageArray', commissionPercentage)
                                console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                console.log('Agent Referrer: ', level["firstReferrer"].username , level["firstReferrer"].CommissionRate)
                                console.log('Distribution Commission Rate Given', percentageAmount5)
                                const commissionPercentageRate5 = percentageAmount5 * 0.01
                                const newCommission5 = commissionPercentageRate5 * lost.amount


                                console.log('Plasada Rate', plasada)
                                console.log('bet ammount commission', lost.amount)
                                console.log('distribution commission', newCommission5)
                                console.log('------------0------------------------0----------------------------0--------')
                                await DistributeCommissions(percentageAmount5, tongAmount, newCommission5 ,
                                  item.id, session, roomID, historyID, gameOutcomeType, 
                                  lost.user_id.id, item.id, item.commision)
                                
                              }else{
                              console.log('2nd Refferer superADmin',level["secondReferrer"].username)
                              console.log('----------------------------------------------------------------------------')
                              console.log('LOSER')
                                console.log('SECONDE REFFERER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                const percentageAmount1 = level["firstReferrer"].referrer.CommissionRate - level["firstReferrer"].CommissionRate
                        
                            commissionArray.push(level[key].CommissionRate)
                            commissionPercentage.push(percentageAmount1)
                            console.log('commissionRateArray', commissionArray)
                            console.log('commissionPercentageArray', commissionPercentage)
                            console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                            console.log('Agent Referrer: ', level["firstReferrer"].username , level["firstReferrer"].CommissionRate)
                            console.log('Distribution Commission Rate Given', percentageAmount1)
                            const commissionPercentageRate1 = percentageAmount1 * 0.01
                            const newCommission1 = commissionPercentageRate1 * lost.amount 
                            console.log('this is the tong amount', tongAmount)
                            console.log('this is the commission', item.commision)
                            console.log('bet ammount', lost.amount)
                        
                          console.log('Plasada Rate', plasada)
                            console.log('bet ammount commission', lost.amount)
                            console.log('distribution commission', newCommission1)
                           console.log('------------0------------------------0----------------------------0--------')

                            await DistributeCommissions(percentageAmount1, tongAmount, newCommission1 ,
                              item.id, session, roomID, historyID, gameOutcomeType, 
                              lost.user_id.id, item.id, item.commision)
                            }
                            }
                          }else if(key === "thirdReferrer" && level[key].username !== "swarrioradmin"){
                            if (item && item.username) {
                              console.log('----------------------------------------------------------------------------')
                              console.log('LOSER')
                                console.log('THIRD REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                const percentageAmount2 = level["secondReferrer"].referrer.CommissionRate - level["secondReferrer"].CommissionRate
                        
                                commissionArray.push(level[key].CommissionRate)
                                commissionPercentage.push(percentageAmount2)
                                console.log('commissionRateArray', commissionArray)
                                console.log('commissionPercentageArray', commissionPercentage)
                                console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                console.log('Agent Referrer: ', level["secondReferrer"].username , level["secondReferrer"].CommissionRate)
                                console.log('Distribution Commission Rate Given', percentageAmount2)
                                console.log('this is the tong amount', tongAmount)
                                console.log('this is the commission', item.commision)
                          
                                const commissionPercentageRate2 = percentageAmount2 * 0.01
                                const newCommission2 = commissionPercentageRate2 * lost.amount 
                          
                                console.log('Plasada Rate', plasada)
                                console.log('bet ammount commission', lost.amount)
                                console.log('distribution commission', newCommission2)
                                    console.log('------------0------------------------0----------------------------0--------')    

                                    await DistributeCommissions(percentageAmount2, tongAmount, newCommission2,
                                      item.id, session, roomID, historyID, gameOutcomeType, 
                                      lost.user_id.id, item.id, item.commision)
                                    }
                          }else if(key ==="fourthReferrer" && level[key].username !== "swarrioradmin"){
                            if (item && item.username) {
                              console.log('----------------------------------------------------------------------------')
                              console.log('LOSER')
                                console.log('FOURTH REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                                const percentageAmount3 = level["thirdReferrer"].referrer.CommissionRate - level["thirdReferrer"].CommissionRate
                        
                                commissionArray.push(level[key].CommissionRate)
                                commissionPercentage.push(percentageAmount3)
                                console.log('commissionRateArray', commissionArray)
                                console.log('commissionPercentageArray',commissionPercentage)
                                console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                                console.log('Agent Referrer: ', level["thirdReferrer"].username , level["thirdReferrer"].CommissionRate)
                                console.log('Distribution Commission Rate Given', percentageAmount3)
  
                                console.log('this is the tong amount', tongAmount)
                                console.log('this is the commission', item.commision)
                             
                                const commissionPercentageRate3 = percentageAmount3 * 0.01
                                const newCommission3 = commissionPercentageRate3 * lost.amount 
                                console.log('Plasada Rate', plasada)
                                console.log('bet ammount commission', lost.amount)
                                console.log('distribution commission', newCommission3)
                                        console.log('------------0------------------------0----------------------------0--------')    
                                        
                                        await DistributeCommissions(percentageAmount3, tongAmount, newCommission3 ,
                                          item.id, session, roomID, historyID, gameOutcomeType, 
                                          lost.user_id.id, item.id, item.commision)
                                        }
                          }else{
                           if (item && item.username) {
                            console.log('----------------------------------------------------------------------------')
                            console.log('LOSER')
                            console.log('LAST REFERRER RAN!!!!!!!!!!!!!!!!!!!!!!!!!!!')
                            commissionArray.push(level[key].CommissionRate)
                               
                                  const percentageAmount4 = plasada - commissionArray[commissionArray.length -2]
                            commissionPercentage.push(percentageAmount4)
                  
                            console.log('commissionRateArray', commissionArray)
                            console.log('commissionPercentageArray', commissionPercentage)
                            console.log('Agent name: ', level[key].username , level[key].CommissionRate)
                            console.log('Agent Referrer: ', level[key]?.referrer?.username , level[key]?.referrer?.CommissionRate)
                            console.log('Distribution Commission Rate Given', percentageAmount4)
                                  

                            const commissionPercentageRate4 = percentageAmount4 * 0.01
                            const newCommission4 = commissionPercentageRate4 * lost.amount 
                            console.log('this is the tong amount', tongAmount)
                            console.log('this is the commission', item.commision)
                          
                            console.log('Plasada Rate', plasada)
                            console.log('bet ammount commission', lost.amount)
                                console.log('distribution commission', newCommission4)
                                  console.log('------------0------------------------0----------------------------0--------')
                                


                                  await DistributeCommissions(percentageAmount4, tongAmount, newCommission4,
                                    item.id, session, roomID, historyID, gameOutcomeType, 
                                    lost.user_id.id, item.id, item.commision)
                                
                                  } 
                          }

                        }

                        });
                    });
    
                    // ** Commission Distribution End
    
                    // ** Lose Wallet Insertion
                    const AdminLoseWallet = await strapi
                      .query("user", "users-permissions")
                      .findOne(
                        {
                          "role.type": "superadmin",
                        },
                        null,
                        { session }
                      );
    
                    const lostWalletTotal = Number(
                      AdminLoseWallet.loseWallet +losersAmount
                    );
    
                    await strapi.query("user", "users-permissions").update(
                      {
                        id: AdminLoseWallet.id,
                      },
                      {
                        loseWallet: lostWalletTotal,
                      },
                      { session }
                    );
    
                    // ** Lose User History Insert
                    await strapi.query("betting-logs").create(
                      {
                        type: "lose",
                        round: currentRoundNumber,
                        betAmount: lost.amount,
                        team: lost.team,
                        arena_id: roomID,
                        user_id: lost.user_id.id,
                      },
                      { session }
                    );
                  })
                );
    

                  }
              

             

                  }))

              }


         


           
          }
          else{ //  cancel here
            await CancelGame(roomID, currentRoundNumber, session)
          }
          
         // Clear Current Round Data
          await strapi.query("current-round").delete({
            arena_id: roomID,
            round: Number(currentRoundNumber),
          });

          io.to(roomID).emit('refresh_player_balance', 'refreshYouWin')
          // Commit the transaction
          await session.commitTransaction();
          session.endSession();
          await io.in(roomID).emit("round_payout_outcome", {
            success: true,
          });
        }
        catch(error){
          console.error(error);
          // If an error occurred, abort the whole transaction and undo any changes that might have happened
          await session.abortTransaction();
          session.endSession();
          throw error;
        }
        finally {
          session.endSession();
        }
      }
      else {
        await io.in(roomID).emit("round_payout_outcome", {
          success: false,
          message: "latest round has no game outcome created yet.",
        });
      }
    });















    // ** Round Settings
    socket.on("round_settings", async (data) => {
      try {
        const roundStatus = await strapi
          .query("arenas")
          .findOne({ id: data.arena_id });

        const nextRoundNumber = roundStatus.round + 1;

        const updatedRoundNumber = await strapi
          .query("arenas")
          .update({ id: data.arena_id }, { round: nextRoundNumber });

        await io
          .in(data.arena_id)
          .emit("round_settings_next_outcome", updatedRoundNumber);
      } catch (error) {
        console.log(error);
      }
    });

    // ** Round Number
    socket.on("round_number", async (data) => {
      try {
        const latestCustomRound = await strapi
          .query("arenas")
          .update({ id: data.arena_id }, { round: data.customRound });

        await io
          .in(data.arena_id)
          .emit("round_settings_next_outcome", latestCustomRound);
      } catch (error) {
        console.log(error);
      }
    });
    



    // ** Game Betting
    socket.on("betting", async (data) => {
    //  console.log('this is the betting', data)
      try {
        const currentArenaStatus = await strapi.query("arenas").findOne({
          id: data.arena_id,
        });
        const user = await strapi
          .query("user", "users-permissions")
          .findOne({ id: data.user_id });

        if (data.amount  > parseInt(user.points)){
          await socket.emit("Betting_Failed", {
            success: false,
            status: "error",
          });
          return false;
        }
        if (currentArenaStatus.status === "open") {
          const isBettingExist = await strapi
            .query("current-round")
            .findOne({ user_id: data.user_id, arena_id: data.arena_id });
          
          if (isBettingExist) {
            await strapi.query("current-round").update(
              { id: isBettingExist.id },
              {
                team: data.team,
                amount: data.amount,
                arena_id: data.arena_id,
                round: currentArenaStatus.round,
                ghostMode: data.ghostMode
              }
            );
          } else {
            await strapi.query("current-round").create({
              arena_id: data.arena_id,
              user_id: data.user_id,
              team: data.team,
              amount: data.amount,
              round: currentArenaStatus.round,
              ghostMode: data.ghostMode
            });
          }

          const userBetHistory = await strapi
            .query("current-round")
            .model.findOne({
              user_id: data.user_id,
            });
          
            // --------------update user points deduct----------------------------------
            // //console.log('bettingSocket', userBetHistory)
            // //console.log('bettingSocket232', userBetHistory.amount)

            // //console.log('betAmount?????', user.points)

            const deductPlayerPoints = user.points - userBetHistory.amount 
      

           const deductUserPointsByBet = await strapi
            .query("user", "users-permissions")
            .update(
              { id: userBetHistory.user_id },
              { points: deductPlayerPoints },
             
            );

                //console.log('bet deducted', deductUserPointsByBet)
           
          socket.emit("my_current_bet_response", {
           
            response: userBetHistory,
          });

         
            io.to(data.arena_id).emit('refresh_player_balance', 'refresh')
          

         
          //console.log('vetResulkyt', userBetHistory)

          // ------------------DEDUCT PLAYER POINTS BY HIS BET AMOUNT--------------------------

          // -----------------------------------------------------------------------------------
        } else {
          //console.log("round is still closed");
        }
      } catch (error) {
        console.log(error);
      }
    });


    // --------------------fake Bet Socket-----------------------
    socket.on("fakebet", async (data) => {
          // console.log('this is from fakebet', data)
          // io.to(data.arena_id).emit('betfake', data.amount)
        
         // io.to(data.arena_id).emit('refresh_player_balance', 'refresh')
        // if(data.ghostMode === true){
        //  const ghostPlayer = await strapi.query("current-round").find({
        //   arena_id: data.arena_id,
        //   user_id: data.user_id
        // });
        // console.log('this is the ghost player', ghostPlayer)
    //  }
     
        // const teamMeron = await strapi.query("current-round").find({
        //   arena_id: data,
        //   team: "meron",
        // });

        if(data.ghostMode === true){
        if(data.team === 'meron'){
          const response = {
            teamWala: 0,
            teamMeron: 0,
            totalWala: 0,
            totalMeron: data.amount * 5,
           
          };
              io.to(data.arena_id).emit('betfake', response)
        }else if(data.team === 'wala'){
          const response = {
            teamWala: 0,
            teamMeron: 0,
            totalWala: data.amount * 5,
            totalMeron: 0,
           
          };
              io.to(data.arena_id).emit('betfake', response)
        }
      }

    })

    // -------------------------------fakebet Initial page load-------------------------

    socket.on("fakebetInitial", async (data) => {
        
      const ghostUser = await strapi.query("current-round").find({
          arena_id: data,
          ghostMode: true
        });


        io.to(data).emit('fakeBetInitialLoad', ghostUser)
    })

   



  });
};