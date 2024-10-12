const {parentPort, workerData} = require('worker_threads')





            
if(workerData=== null){
  console.log('Initializing')   
}else{
const { teamWala, teamMeron, currentRoundBet, roundStatus } = workerData;
// console.log(currentRoundBet)
// console.log(roundStatus)
// const addAllIntegers = (array) => {
//   let sum = 0;
//   array.forEach((element) => {
//     sum += Number(element.amount);
//   });
//   return sum;
// };
// const allWalaTotal = addAllIntegers(teamWala);
// const allMeronTotal = addAllIntegers(teamMeron);
// const currentRoundTeam =
//   currentRoundBet.team === "meron" ? allMeronTotal : allWalaTotal;
//   const meronAndWalaTotal = Number(allWalaTotal + allMeronTotal);
//   const dividedToChoosenTeam = Number(meronAndWalaTotal / currentRoundTeam);
//   const walaWinningAmount =
//     Number(dividedToChoosenTeam) * Number(currentRoundBet.amount);
//   const plasadaRate = roundStatus.plasadaRate / 100;
//   const tongAmount = walaWinningAmount * plasadaRate;
//   const totalPayout = walaWinningAmount - tongAmount;
//   const returnData = {
//     totalPayout,
//     team: currentRoundBet.team,
//     betAmount: currentRoundBet.amount,
//     totalWala: allWalaTotal,
//     totalMeron: allMeronTotal
//   };
  parentPort.postMessage({type: 'results', data: returnData, merontotal: allMeronTotal, walatotal: allWalaTotal});
   
}




    



