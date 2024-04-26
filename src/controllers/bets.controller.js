/* eslint-disable no-restricted-syntax */
/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { betsService, userService } = require('../services');

const createBetPlaced = catchAsync(async (req, res) => {
  const { result, stake, winnings, selections, cashierId } = req.body;
  const betPlaced = await betsService.createBetPlaced(result, stake, winnings, selections, cashierId);
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

const getBetHistory = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, username, betType, clientType } = req.query;
    if ((!startDate || !endDate) && !username && !betType && !clientType) {
      const betHistory = await betsService.getBetHistory({});

      const mappedBetHistory = await Promise.all(
        betHistory.map(async (bet) => {
          if (bet.result === 'loss')
            return {
              ticketId: bet.id,
              stake: bet.stake,
              result: bet.result,
              date: bet.createdAt,
              winnings: 0,
              cashier: bet.cashierId,
              selections: bet.selections,
            };
          return {
            ticketId: bet.id,
            stake: bet.stake,
            result: bet.result,
            date: bet.createdAt,
            winnings: bet.winnings,
            cashier: bet.cashierId,
            selections: bet.selections,
          };
        })
      );
      return res.status(httpStatus.CREATED).send(mappedBetHistory);
    }
    if (startDate && endDate) {
      if (username) {
        const user = await userService.getUserByUsername(username);
        if (!user) {
          throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
        }
        const betHistory = await betsService.getBetHistory({ cashierId: user.id, startDate, endDate });
        const mappedBetHistory = await Promise.all(
          betHistory.map(async (bet) => {
            if (bet.result === 'loss')
              return {
                ticketId: bet.id,
                stake: bet.stake,
                result: bet.result,
                date: bet.createdAt,
                winnings: 0,
                cashier: bet.cashierId,
                selections: bet.selections,
              };
            return {
              ticketId: bet.id,
              stake: bet.stake,
              result: bet.result,
              date: bet.createdAt,
              winnings: bet.winnings,
              cashier: bet.cashierId,
              selections: bet.selections,
            };
          })
        );
        return res.status(httpStatus.CREATED).send(mappedBetHistory);
      }
      if (clientType) {
        const user = await userService.getUserByRole(clientType);
        if (!user.length) {
          throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
        }
        const bets = await Promise.all(
          user.map(async (userItem) => {
            const betHistory = await betsService.getBetHistory({ cashierId: userItem.id, startDate, endDate });
            const mappedBetHistory = await Promise.all(
              betHistory.map(async (bet) => {
                if (bet.result === 'loss')
                  return {
                    ticketId: bet.id,
                    stake: bet.stake,
                    result: bet.result,
                    date: bet.createdAt,
                    winnings: 0,
                    cashier: bet.cashierId,
                    selections: bet.selections,
                  };
                return {
                  ticketId: bet.id,
                  stake: bet.stake,
                  result: bet.result,
                  date: bet.createdAt,
                  winnings: bet.winnings,
                  cashier: bet.cashierId,
                  selections: bet.selections,
                };
              })
            );
            return mappedBetHistory;
          })
        );
        const flattenedArray = [].concat(...bets);

        return res.status(httpStatus.CREATED).send(flattenedArray);
      }
      if (betType) {
        const betHistory = await betsService.getBetHistory({ startDate, endDate, betType });
        const mappedBetHistory = await Promise.all(
          betHistory.map(async (bet) => {
            if (bet.result === 'loss')
              return {
                ticketId: bet.id,
                stake: bet.stake,
                result: bet.result,
                date: bet.createdAt,
                winnings: 0,
                cashier: bet.cashierId,
                selections: bet.selections,
              };
            return {
              ticketId: bet.id,
              stake: bet.stake,
              result: bet.result,
              date: bet.createdAt,
              winnings: bet.winnings,
              cashier: bet.cashierId,
              selections: bet.selections,
            };
          })
        );

        return res.status(httpStatus.CREATED).send(mappedBetHistory);
      }
      const betHistory = await betsService.getBetHistory({ startDate, endDate });

      const mappedBetHistory = await Promise.all(
        betHistory.map(async (bet) => {
          if (bet.result === 'loss')
            return {
              ticketId: bet.id,
              stake: bet.stake,
              result: bet.result,
              date: bet.createdAt,
              winnings: 0,
              cashier: bet.cashierId,
              selections: bet.selections,
            };
          return {
            ticketId: bet.id,
            stake: bet.stake,
            result: bet.result,
            date: bet.createdAt,
            winnings: bet.winnings,
            cashier: bet.cashierId,
            selections: bet.selections,
          };
        })
      );
      return res.status(httpStatus.CREATED).send(mappedBetHistory);
    }
    if (username) {
      const user = await userService.getUserByUsername(username);
      if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
      }
      const betHistory = await betsService.getBetHistory({ cashierId: user.id });
      const mappedBetHistory = await Promise.all(
        betHistory.map(async (bet) => {
          if (bet.result === 'loss')
            return {
              ticketId: bet.id,
              stake: bet.stake,
              result: bet.result,
              date: bet.createdAt,
              winnings: 0,
              cashier: bet.cashierId,
              selections: bet.selections,
            };
          return {
            ticketId: bet.id,
            stake: bet.stake,
            result: bet.result,
            date: bet.createdAt,
            winnings: bet.winnings,
            cashier: bet.cashierId,
            selections: bet.selections,
          };
        })
      );
      return res.status(httpStatus.CREATED).send(mappedBetHistory);
    }
    if (clientType) {
      const user = await userService.getUserByRole(clientType);
      if (!user.length) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
      }
      const bets = await Promise.all(
        user.map(async (userItem) => {
          const betHistory = await betsService.getBetHistory({ cashierId: userItem.id });
          const mappedBetHistory = await Promise.all(
            betHistory.map(async (bet) => {
              if (bet.result === 'loss')
                return {
                  ticketId: bet.id,
                  stake: bet.stake,
                  result: bet.result,
                  date: bet.createdAt,
                  winnings: 0,
                  cashier: bet.cashierId,
                  selections: bet.selections,
                };
              return {
                ticketId: bet.id,
                stake: bet.stake,
                result: bet.result,
                date: bet.createdAt,
                winnings: bet.winnings,
                cashier: bet.cashierId,
                selections: bet.selections,
              };
            })
          );
          return mappedBetHistory;
        })
      );
      const flattenedArray = [].concat(...bets);

      return res.status(httpStatus.CREATED).send(flattenedArray);
    }
    if (betType) {
      const betHistory = await betsService.getBetHistory({ betType });
      const mappedBetHistory = await Promise.all(
        betHistory.map(async (bet) => {
          if (bet.result === 'loss')
            return {
              ticketId: bet.id,
              stake: bet.stake,
              result: bet.result,
              date: bet.createdAt,
              winnings: 0,
              cashier: bet.cashierId,
              selections: bet.selections,
            };
          return {
            ticketId: bet.id,
            stake: bet.stake,
            result: bet.result,
            date: bet.createdAt,
            winnings: bet.winnings,
            cashier: bet.cashierId,
            selections: bet.selections,
          };
        })
      );

      return res.status(httpStatus.CREATED).send(mappedBetHistory);
    }
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const getGamingActivity = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, username, betType, clientType } = req.query;
    if ((!startDate || !endDate) && !username && !betType && !clientType) {
      const betHistory = await betsService.getBetHistory({});
      const cashierData = {};

      for (const bet of betHistory) {
        const cashier = await userService.getUserById(bet.cashierId);

        if (!cashierData[cashier.name]) {
          cashierData[cashier.name] = {
            winnings: 0,
            numberOfBets: 0,
            totalStake: 0,
          };
        }

        cashierData[cashier.name].totalStake += bet.stake;
        cashierData[cashier.name].winnings += bet.winnings;
        cashierData[cashier.name].numberOfBets = betHistory.length;
      }

      const mappedBetHistory = Object.values(cashierData);
      const winnings = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.winnings, 0);

      const totalStake = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
      const response = {
        numberOfBets: betHistory.length,
        winnings,
        ggr: (Number(winnings) / Number(totalStake)) * 100,
      };

      return res.status(httpStatus.CREATED).send(response);
    }

    if (startDate && endDate) {
      if (username) {
        const user = await userService.getUserByUsername(username);
        if (!user) {
          throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
        }
        const betHistory = await betsService.getBetHistory({ cashierId: user.id, startDate, endDate });
        const cashierData = {};

        for (const bet of betHistory) {
          const cashier = await userService.getUserById(bet.cashierId);

          if (!cashierData[cashier.name]) {
            cashierData[cashier.name] = {
              winnings: 0,
              numberOfBets: 0,
              totalStake: 0,
            };
          }

          cashierData[cashier.name].totalStake += bet.stake;
          cashierData[cashier.name].winnings += bet.winnings;

          cashierData[cashier.name].numberOfBets = betHistory.length;
        }

        const bets = Object.values(cashierData);

        const winnings = bets.reduce((accumulator, obj) => accumulator + obj.winnings, 0);
        const numberOfBets = bets.reduce((accumulator, obj) => accumulator + obj.numberOfBets, 0);
        const totalStake = bets.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
        const response = {
          numberOfBets,
          winnings,
          ggr: (Number(winnings) / Number(totalStake)) * 100,
        };
        return res.status(httpStatus.CREATED).send(response);
      }
      if (clientType) {
        const user = await userService.getUserByRole(clientType);
        if (!user.length) {
          throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
        }
        const bets = await Promise.all(
          user.map(async (userItem) => {
            const betHistory = await betsService.getBetHistory({ cashierId: userItem.id, startDate, endDate });

            const sumofStakes = betHistory.reduce((accumulator, obj) => {
              return accumulator + obj.stake;
            }, 0);
            const winCount = betHistory.reduce((count, bet) => {
              return count + bet.winnings;
            }, 0);

            return {
              winnings: winCount,
              totalStake: sumofStakes,
              numberOfBets: betHistory.length,
            };
          })
        );
        const winnings = bets.reduce((accumulator, obj) => accumulator + obj.winnings, 0);
        const numberOfBets = bets.reduce((accumulator, obj) => accumulator + obj.numberOfBets, 0);
        const totalStake = bets.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
        const response = {
          numberOfBets,
          winnings,
          ggr: (Number(winnings) / Number(totalStake)) * 100,
        };
        return res.status(httpStatus.CREATED).send(response);
      }
      if (betType) {
        const betHistory = await betsService.getBetHistory({ startDate, endDate, betType });
        const cashierData = {};

        for (const bet of betHistory) {
          const cashier = await userService.getUserById(bet.cashierId);

          if (!cashierData[cashier.name]) {
            cashierData[cashier.name] = {
              winnings: 0,
              numberOfBets: 0,
              totalStake: 0,
            };
          }

          cashierData[cashier.name].totalStake += bet.stake;
          cashierData[cashier.name].winnings += bet.winnings;

          cashierData[cashier.name].numberOfBets = betHistory.length;
        }

        const mappedBetHistory = Object.values(cashierData);
        // eslint-disable-next-line no-unused-vars

        const winnings = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.winnings, 0);

        const totalStake = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
        const response = {
          numberOfBets: betHistory.length,
          winnings,
          ggr: (Number(winnings) / Number(totalStake)) * 100,
        };

        return res.status(httpStatus.CREATED).send(response);
      }
      const betHistory = await betsService.getBetHistory({ startDate, endDate });
      const cashierData = {};

      for (const bet of betHistory) {
        const cashier = await userService.getUserById(bet.cashierId);

        if (!cashierData[cashier.name]) {
          cashierData[cashier.name] = {
            winnings: 0,
            numberOfBets: 0,
            totalStake: 0,
          };
        }

        cashierData[cashier.name].totalStake += bet.stake;
        cashierData[cashier.name].winnings += bet.winnings;
        cashierData[cashier.name].numberOfBets = betHistory.length;
      }

      const mappedBetHistory = Object.values(cashierData);
      const winnings = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.winnings, 0);

      const totalStake = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
      const response = {
        numberOfBets: betHistory.length,
        winnings,
        ggr: (Number(winnings) / Number(totalStake)) * 100,
      };

      return res.status(httpStatus.CREATED).send(response);
    }
    if (username) {
      const user = await userService.getUserByUsername(username);
      if (!user) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
      }
      const betHistory = await betsService.getBetHistory({ cashierId: user.id });
      const cashierData = {};

      for (const bet of betHistory) {
        const cashier = await userService.getUserById(bet.cashierId);

        if (!cashierData[cashier.name]) {
          cashierData[cashier.name] = {
            winnings: 0,
            numberOfBets: 0,
            totalStake: 0,
          };
        }

        cashierData[cashier.name].totalStake += bet.stake;
        cashierData[cashier.name].winnings += bet.winnings;

        cashierData[cashier.name].numberOfBets = betHistory.length;
      }

      const bets = Object.values(cashierData);

      const winnings = bets.reduce((accumulator, obj) => accumulator + obj.winnings, 0);
      const numberOfBets = bets.reduce((accumulator, obj) => accumulator + obj.numberOfBets, 0);
      const totalStake = bets.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
      const response = {
        numberOfBets,
        winnings,
        ggr: (Number(winnings) / Number(totalStake)) * 100,
      };
      return res.status(httpStatus.CREATED).send(response);
    }
    if (clientType) {
      const user = await userService.getUserByRole(clientType);
      if (!user.length) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
      }
      const bets = await Promise.all(
        user.map(async (userItem) => {
          const betHistory = await betsService.getBetHistory({ cashierId: userItem.id });

          const sumofStakes = betHistory.reduce((accumulator, obj) => {
            return accumulator + obj.stake;
          }, 0);
          const winCount = betHistory.reduce((count, bet) => {
            return count + bet.winnings;
          }, 0);

          return {
            winnings: winCount,
            totalStake: sumofStakes,
            numberOfBets: betHistory.length,
          };
        })
      );
      const winnings = bets.reduce((accumulator, obj) => accumulator + obj.winnings, 0);
      const numberOfBets = bets.reduce((accumulator, obj) => accumulator + obj.numberOfBets, 0);
      const totalStake = bets.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
      const response = {
        numberOfBets,
        winnings,
        ggr: (Number(winnings) / Number(totalStake)) * 100,
      };
      return res.status(httpStatus.CREATED).send(response);
    }
    if (betType) {
      const betHistory = await betsService.getBetHistory({ betType });
      const cashierData = {};

      for (const bet of betHistory) {
        const cashier = await userService.getUserById(bet.cashierId);

        if (!cashierData[cashier.name]) {
          cashierData[cashier.name] = {
            winnings: 0,
            numberOfBets: 0,
            totalStake: 0,
          };
        }

        cashierData[cashier.name].totalStake += bet.stake;
        cashierData[cashier.name].winnings += bet.winnings;

        cashierData[cashier.name].numberOfBets = betHistory.length;
      }

      const mappedBetHistory = Object.values(cashierData);

      const winnings = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.winnings, 0);

      const totalStake = mappedBetHistory.reduce((accumulator, obj) => accumulator + obj.totalStake, 0);
      const response = {
        numberOfBets: betHistory.length,
        winnings,
        ggr: (Number(winnings) / Number(totalStake)) * 100,
      };

      return res.status(httpStatus.CREATED).send(response);
    }
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const getAccountingReports = catchAsync(async (req, res) => {
  try {
    const { startDate, endDate, betType, clientType } = req.query;
    if ((!startDate || !endDate) && !betType && !clientType) {
      const betHistory = await betsService.getBetHistory({});

      const cashierData = {};
      // eslint-disable-next-line no-restricted-syntax
      for (const bet of betHistory) {
        const cashier = await userService.getUserById(bet.cashierId);

        if (!cashierData[cashier.name]) {
          cashierData[cashier.name] = {
            totalWinnings: 0,
            totalStake: 0,
            name: cashier.name,
            clientType: cashier.role,
            availableBalance: cashier.wallet,
          };
        }

        cashierData[cashier.name].totalWinnings += bet.winnings;
        cashierData[cashier.name].totalStake += bet.stake;
      }
      let mappedBetHistory = Object.values(cashierData);
      mappedBetHistory = mappedBetHistory.map((item) => ({
        ...item,
        profit: Number(item.totalWinnings) - Number(item.totalStake),
      }));

      return res.status(httpStatus.CREATED).send(mappedBetHistory);
    }
    if (startDate && endDate) {
      if (clientType) {
        const user = await userService.getUserByRole(clientType);
        if (!user.length) {
          throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
        }
        const bets = await Promise.all(
          user.map(async (userItem) => {
            const betHistory = await betsService.getBetHistory({ cashierId: userItem.id, startDate, endDate });

            const totalStake = betHistory.reduce((accumulator, obj) => accumulator + obj.stake, 0);
            const totalWinnings = betHistory.reduce((count, bet) => count + bet.winnings, 0);

            return {
              totalWinnings,
              totalStake,
              name: userItem.name,
              clientType,
              profit: Number(totalWinnings) - Number(totalStake),
              availableBalance: userItem.wallet,
            };
          })
        );
        return res.status(httpStatus.CREATED).send(bets);
      }
      if (betType) {
        const betHistory = await betsService.getBetHistory({ betType, startDate, endDate });

        const cashierData = {};

        for (const bet of betHistory) {
          const cashier = await userService.getUserById(bet.cashierId);

          if (!cashierData[cashier.name]) {
            cashierData[cashier.name] = {
              totalWinnings: 0,
              totalStake: 0,
              name: cashier.name,
              clientType: cashier.role,
              availableBalance: cashier.wallet,
            };
          }

          cashierData[cashier.name].totalStake += bet.stake;
          cashierData[cashier.name].totalWinnings += bet.winnings;
        }

        let mappedBetHistory = Object.values(cashierData);
        mappedBetHistory = mappedBetHistory.map((item) => ({
          ...item,
          profit: Number(item.totalWinnings) - Number(item.totalStake),
        }));

        return res.status(httpStatus.CREATED).send(mappedBetHistory);
      }
      const betHistory = await betsService.getBetHistory({ startDate, endDate });

      const cashierData = {};
      // eslint-disable-next-line no-restricted-syntax
      for (const bet of betHistory) {
        const cashier = await userService.getUserById(bet.cashierId);

        if (!cashierData[cashier.name]) {
          cashierData[cashier.name] = {
            totalWinnings: 0,
            totalStake: 0,
            name: cashier.name,
            clientType: cashier.role,
            availableBalance: cashier.wallet,
          };
        }

        cashierData[cashier.name].totalStake += bet.stake;
        cashierData[cashier.name].totalWinnings += bet.winnings;
      }
      let mappedBetHistory = Object.values(cashierData);
      mappedBetHistory = mappedBetHistory.map((item) => ({
        ...item,
        profit: Number(item.totalWinnings) - Number(item.totalStake),
      }));

      return res.status(httpStatus.CREATED).send(mappedBetHistory);
    }
    if (clientType) {
      const user = await userService.getUserByRole(clientType);
      if (!user.length) {
        throw new ApiError(httpStatus.NOT_FOUND, 'Bet Record by ClientType not found');
      }
      const bets = await Promise.all(
        user.map(async (userItem) => {
          const betHistory = await betsService.getBetHistory({ cashierId: userItem.id });

          const totalStake = betHistory.reduce((accumulator, obj) => accumulator + obj.stake, 0);
          const totalWinnings = betHistory.reduce((count, bet) => count + bet.winnings, 0);

          return {
            totalWinnings,
            totalStake,
            name: userItem.name,
            profit: Number(totalWinnings) - Number(totalStake),

            clientType,
            availableBalance: userItem.wallet,
          };
        })
      );
      return res.status(httpStatus.CREATED).send(bets);
    }
    if (betType) {
      const betHistory = await betsService.getBetHistory({ betType });

      const cashierData = {};

      for (const bet of betHistory) {
        const cashier = await userService.getUserById(bet.cashierId);

        if (!cashierData[cashier.name]) {
          cashierData[cashier.name] = {
            totalWinnings: 0,
            totalStake: 0,
            name: cashier.name,
            clientType: cashier.role,
            availableBalance: cashier.wallet,
          };
        }

        cashierData[cashier.name].totalStake += bet.stake;
        cashierData[cashier.name].totalWinnings += bet.winnings;
      }
      let mappedBetHistory = Object.values(cashierData);
      mappedBetHistory = mappedBetHistory.map((item) => ({
        ...item,
        profit: Number(item.totalWinnings) - Number(item.totalStake),
      }));

      return res.status(httpStatus.CREATED).send(mappedBetHistory);
    }
  } catch (error) {
    throw new ApiError(httpStatus.NOT_FOUND, error.message);
  }
});

const getBetPlacedById = catchAsync(async (req, res) => {
  try {
    const { id } = req.params;
    const betPlaced = await betsService.getBetPlacedById(id);
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

module.exports = {
  createBetPlaced,
  fetchBetPlaced,
  getBetPlacedById,
  getBetHistory,
  getAccountingReports,
  getGamingActivity,
  cancelTicket,
};
