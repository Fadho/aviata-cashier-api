/* eslint-disable no-restricted-syntax */
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const pick = require('../utils/pick');
const { betsService, userService } = require('../services');

const createBetPlaced = catchAsync(async (req, res) => {
  const { result, stake, selections, cashierId, potentialWinnings, roundId } = req.body;
  const user = await userService.getUserById(cashierId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Cashier with provided ID not found');
  }
  if (user.wallet - stake < 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, 'bet cannot be placed, Insuffecient Funds');
  }
  await userService.updateUserById(cashierId, { wallet: user.wallet - stake });
  const betPlaced = await betsService.createBetPlaced(result, stake, selections, cashierId, potentialWinnings, roundId);
  res.status(httpStatus.CREATED).send(betPlaced);
});

const fetchBetPlaced = catchAsync(async (req, res) => {
  try {
    const betPlaced = await betsService.fetchBetPlaced();
    return res.status(httpStatus.CREATED).send(betPlaced);
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

// const getBetHistory = catchAsync(async (req, res) => {
//   try {
//     const { startDate, endDate, username, betType, clientType } = req.query;
//     let betHistory = [];
//     if ((!startDate || !endDate) && !username && !betType && !clientType) {
//       betHistory = await betsService.getBetHistory({});
//     }
//     if (startDate && endDate) {
//       if (username) {
//         const user = await userService.getUserByUsername(username);
//         if (!user) {
//           throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
//         }
//         betHistory = await betsService.getBetHistory({ cashierId: user.id, startDate, endDate });
//       }
//       if (clientType) {
//         const user = await userService.getUserByRole(clientType);
//         if (!user.length) {
//           throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
//         }
//         const bets = await Promise.all(
//           user.map(async (userItem) => {
//             betHistory = await betsService.getBetHistory({ cashierId: userItem.id, startDate, endDate });
//             const mappedBetHistory = await Promise.all(
//               betHistory.map(async (bet) => {
//                 if (bet.result === 'loss')
//                   return {
//                     ticketId: bet.ticketId,
//                     stake: bet.stake,
//                     result: bet.result,
//                     date: bet.createdAt,
//                     winnings: 0,
//                     cashier: bet.cashierId,
//                     selections: bet.selections,
//                   };
//                 return {
//                   ticketId: bet.ticketId,
//                   stake: bet.stake,
//                   result: bet.result,
//                   date: bet.createdAt,
//                   winnings: bet.winnings,
//                   cashier: bet.cashierId,
//                   selections: bet.selections,
//                 };
//               })
//             );
//             return mappedBetHistory;
//           })
//         );
//         const flattenedArray = [].concat(...bets);

//         return res.status(httpStatus.CREATED).send(flattenedArray);
//       }
//       if (betType) {
//         betHistory = await betsService.getBetHistory({ startDate, endDate, betType });
//       }
//       betHistory = await betsService.getBetHistory({ startDate, endDate });
//     }
//     if (username) {
//       const user = await userService.getUserByUsername(username);
//       if (!user) {
//         throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
//       }
//       betHistory = await betsService.getBetHistory({ cashierId: user.id });
//     }
//     if (clientType) {
//       const user = await userService.getUserByRole(clientType);
//       if (!user.length) {
//         throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
//       }
//       const bets = await Promise.all(
//         user.map(async (userItem) => {
//           betHistory = await betsService.getBetHistory({ cashierId: userItem.id });
//           const mappedBetHistory = await Promise.all(
//             betHistory.map(async (bet) => {
//               if (bet.result === 'loss')
//                 return {
//                   ticketId: bet.id,
//                   stake: bet.stake,
//                   result: bet.result,
//                   date: bet.createdAt,
//                   winnings: 0,
//                   cashier: bet.cashierId,
//                   selections: bet.selections,
//                 };
//               return {
//                 ticketId: bet.id,
//                 stake: bet.stake,
//                 result: bet.result,
//                 date: bet.createdAt,
//                 winnings: bet.winnings,
//                 cashier: bet.cashierId,
//                 selections: bet.selections,
//               };
//             })
//           );
//           return mappedBetHistory;
//         })
//       );
//       const flattenedArray = [].concat(...bets);

//       return res.status(httpStatus.CREATED).send(flattenedArray);
//     }
//     if (betType) {
//       betHistory = await betsService.getBetHistory({ betType });
//     }
//     const mappedBetHistory = await Promise.all(
//       betHistory.map(async (bet) => {
//         if (bet.result === 'loss')
//           return {
//             ticketId: bet.id,
//             stake: bet.stake,
//             result: bet.result,
//             date: bet.createdAt,
//             winnings: 0,
//             potentialWinnings: bet.potentialWinnings,
//             cashier: bet.cashierId,
//             selections: bet.selections,
//           };
//         return {
//           ticketId: bet.id,
//           stake: bet.stake,
//           result: bet.result,
//           date: bet.createdAt,
//           potentialWinnings: bet.potentialWinnings,
//           winnings: bet.potentialWinnings,
//           cashier: bet.cashierId,
//           selections: bet.selections,
//         };
//       })
//     );

//     return res.status(httpStatus.CREATED).send(mappedBetHistory);
//   } catch (error) {
//     throw new ApiError(httpStatus.NOT_FOUND, error.message);
//   }
// });

const getBetHistory = catchAsync(async (req, res) => {
  const filter = pick(req.query, ['betType', 'cashierId', 'stake', 'payout']);
  const { startDate, endDate } = req.query;
  const options = pick(req.query, ['sortBy', 'limit', 'page', 'populate']);
  const result = await betsService.getBetHistoryReport(filter, options, startDate, endDate);
  res.send(result);
});

const getGamingActivity = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, username, betType, clientType } = req.query;
    let betHistory = [];
    let cancelledbetHistory = [];
    if ((!startDate || !endDate) && !username && !betType && !clientType) {
      betHistory = await betsService.getBetHistory({});
      cancelledbetHistory = await betsService.getCancelledBetHistory({});
    }

    if (startDate && endDate) {
      if (username) {
        const user = await userService.getUserByUsername(username);
        if (!user) {
          throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
        }
        betHistory = await betsService.getBetHistory({ cashierId: user.id, startDate, endDate });
        cancelledbetHistory = await betsService.getCancelledBetHistory({ cashierId: user.id, startDate, endDate });
      }
      if (clientType) {
        const user = await userService.getUserByRole(clientType);
        if (!user.length) {
          throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
        }
        const bets = await Promise.all(
          user.map(async (userItem) => {
            betHistory = await betsService.getBetHistory({ cashierId: userItem.id, startDate, endDate });
            cancelledbetHistory = await betsService.getCancelledBetHistory({ cashierId: userItem.id, startDate, endDate });

            const sumofStakes = betHistory.reduce((accumulator, obj) => accumulator + obj.stake, 0);
            const winCount = betHistory.reduce((count, bet) => count + bet.potentialWinnings, 0);

            return {
              potentialWinnings: winCount,
              totalStake: sumofStakes,
              numberOfBets: betHistory.length,
            };
          })
        );
        const reversal = cancelledbetHistory.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);
        const winnings = bets.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);
        const numberOfBets = bets.reduce((accumulator, obj) => accumulator + obj.numberOfBets, 0);
        const totalStake = bets.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
        const response = {
          numberOfBets,
          winnings,
          ggr: (Number(winnings) / Number(totalStake)) * 100,
          turnover: Number(((Number(totalStake) - Number(reversal) / Number(winnings)) * 100).toFixed(3)),
          margin: Number(((Number(totalStake) / Number(winnings)) * 100).toFixed(3)),
        };
        return res.status(httpStatus.CREATED).send(response);
      }
      if (betType) {
        betHistory = await betsService.getBetHistory({ startDate, endDate, betType });
        cancelledbetHistory = await betsService.getCancelledBetHistory({ startDate, endDate, betType });
      }
      betHistory = await betsService.getBetHistory({ startDate, endDate });
      cancelledbetHistory = await betsService.getCancelledBetHistory({ startDate, endDate });
    }
    if (username) {
      const user = await userService.getUserByUsername(username);
      if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
      }
      betHistory = await betsService.getBetHistory({ cashierId: user.id });
      cancelledbetHistory = await betsService.getCancelledBetHistory({ cashierId: user.id });
    }
    if (clientType) {
      const user = await userService.getUserByRole(clientType);
      if (!user.length) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
      }
      const bets = await Promise.all(
        user.map(async (userItem) => {
          betHistory = await betsService.getBetHistory({ cashierId: userItem.id });
          cancelledbetHistory = await betsService.getCancelledBetHistory({ cashierId: userItem.id });

          const sumofStakes = betHistory.reduce((accumulator, obj) => {
            return accumulator + obj.stake;
          }, 0);
          const winCount = betHistory.reduce((count, bet) => {
            return count + bet.potentialWinnings;
          }, 0);

          return {
            potentialWinnings: winCount,
            totalStake: sumofStakes,
            numberOfBets: betHistory.length,
          };
        })
      );
      const reversal = cancelledbetHistory.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);

      const winnings = bets.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);
      const numberOfBets = bets.reduce((accumulator, obj) => accumulator + obj.numberOfBets, 0);
      const totalStake = bets.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
      const response = {
        numberOfBets,
        winnings,
        ggr: (Number(winnings) / Number(totalStake)) * 100,
        turnover: Number(((Number(totalStake) - Number(reversal) / Number(winnings)) * 100).toFixed(3)),
        margin: Number(((Number(totalStake) / Number(winnings)) * 100).toFixed(2)),
      };
      return res.status(httpStatus.CREATED).send(response);
    }
    if (betType) {
      betHistory = await betsService.getBetHistory({ betType });
      cancelledbetHistory = await betsService.getCancelledBetHistory({ betType });
    }

    const cashierData = {};

    for (const bet of betHistory) {
      const cashier = await userService.getUserById(bet.cashierId);

      if (!cashierData[cashier.name]) {
        cashierData[cashier.name] = {
          potentialWinnings: 0,
          numberOfBets: 0,
          totalStake: 0,
        };
      }

      cashierData[cashier.name].totalStake += bet.stake;
      cashierData[cashier.name].potentialWinnings += bet.potentialWinnings;
      cashierData[cashier.name].numberOfBets = betHistory.length;
    }

    const mappedBetHistory = Object.values(cashierData);
    const winnings = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);
    const reversal = cancelledbetHistory.reduce((accumulator, obj) => accumulator + obj.potentialWinnings, 0);

    const totalStake = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
    const response = {
      numberOfBets: betHistory.length,
      winnings,
      ggr: Number(((Number(winnings) / Number(totalStake)) * 100).toFixed(3)),
      turnover: Number(((Number(totalStake) - Number(reversal) / Number(winnings)) * 100).toFixed(3)),
      margin: Number(((Number(totalStake) / Number(winnings)) * 100).toFixed(3)),
    };

    return res.status(httpStatus.CREATED).send(response);
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const getAccountingReports = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, betType, clientType, cashierId } = req.query;
    let betHistory = [];
    // if (clientType) {
    const user = await userService.getUsers({
      ...(clientType && { role: clientType }),
      ...(cashierId && { _id: cashierId }),
    });
    if (!user.length) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
    }
    const bets = await Promise.all(
      user.map(async (userItem) => {
        console.log(userItem);
        betHistory = await betsService.getBetHistory(
          { cashierId: userItem.id, ...(betType && { betType }) },
          startDate,
          endDate
        );

        const totalStake = betHistory.reduce((accumulator, obj) => accumulator + obj.stake, 0);
        const totalWinnings = betHistory.reduce((count, bet) => count + bet.winnings, 0);
        const totalClosedPayout = betHistory.reduce((count, bet) => {
          return bet.payout ? count + bet.winnings : count + 0;
        }, 0);
        const totalOpenPayout = betHistory.reduce((count, bet) => {
          return !bet.payout ? count + bet.winnings : count + 0;
        }, 0);

        console.log(betHistory);

        return {
          totalWinnings,
          totalStake,
          numberOfBets: betHistory.length,
          name: userItem.name,
          clientType,
          profit: Number(totalStake) - Number(totalWinnings),
          totalClosedPayout,
          totalOpenPayout,
          availableBalance: userItem.wallet,
        };
      })
    );
    return res.status(httpStatus.CREATED).send(bets);
    // }

    // const cashierData = {};
    // // eslint-disable-next-line no-restricted-syntax
    // for (const bet of betHistory) {
    //   const cashier = await userService.getUserById(bet.cashierId);

    //   if (!cashierData[cashier.name]) {
    //     cashierData[cashier.name] = {
    //       totalWinnings: 0,
    //       totalStake: 0,
    //       name: cashier.name,
    //       clientType: cashier.role,
    //       availableBalance: cashier.wallet,
    //     };
    //   }

    //   cashierData[cashier.name].totalWinnings += bet.winnings;
    //   cashierData[cashier.name].totalStake += bet.stake;
    // }
    // let mappedBetHistory = Object.values(cashierData);
    // mappedBetHistory = mappedBetHistory.map((item) => ({
    //   ...item,
    //   profit: Number(item.totalStake) - Number(item.totalWinnings),
    // }));

    return res.status(httpStatus.CREATED).send(mappedBetHistory);
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const getBetPlacedById = catchAsync(async (req, res) => {
  try {
    const betPlaced = await betsService.getBetPlacedById(req.params.id);
    if (!betPlaced) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record not found');
    }
    res.status(httpStatus.CREATED).send(betPlaced);
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const cancelTicket = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const betPlaced = await betsService.getBetPlacedById(id);
    if (!betPlaced) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record not found');
    }
    const betCancelled = await betsService.cancelTicket(id);

    res.status(httpStatus.CREATED).send(betCancelled);
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const cashoutTicket = catchAsync(async (req, res) => {
  try {
    const { roundId, odd } = req.body;
    await betsService.updateBetsAndCalculateWinnings(roundId, odd);
    res.status(httpStatus.CREATED).send({ message: 'Bets updated successfully' });
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const payoutTicket = catchAsync(async (req, res) => {
  try {
    const { ticket, message } = await betsService.payoutTicket(req.params.id);

    if (ticket) return res.status(httpStatus.CREATED).send({ ticket, message });
    return res.status(httpStatus.NOT_FOUND).send({ message });
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
  getBetHistory,
  getAccountingReports,
  getGamingActivity,
  cancelTicket,
  cashoutTicket,
  payoutTicket,
};
