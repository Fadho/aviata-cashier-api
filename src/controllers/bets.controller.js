const httpStatus = require('http-status');
const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const { betsService, userService } = require('../services');

const createBetPlaced = catchAsync(async (req, res) => {
  const { result, stake, winnings, selections, cashierId } = req.body;
  const betPlaced = await betsService.createBetPlaced(result, stake, winnings, selections, cashierId);
  res.status(httpStatus.CREATED).send({ betPlaced });
});

const fetchBetPlaced = catchAsync(async (req, res) => {
  const betPlaced = await betsService.fetchBetPlaced();
  res.status(httpStatus.CREATED).send({ betPlaced });
});

const getBetHistory = catchAsync(async (req, res) => {
  const { startDate, endDate, username, betType, clientType } = req.query;
  if (username) {
    const user = await userService.getUserByUsername(username);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
    }
    const betHistory = await betsService.getBetHistory({ cashierId: user.id, startDate, endDate });
    const mappedBetHistory = await Promise.all(
      betHistory.map(async (bet) => {
        const cashier = await userService.getUserById(bet.cashierId);
        return {
          ticketId: bet.id,
          selection: bet.selection,
          cashier: cashier.id,
          stake: bet.stake,
          result: bet.result,
          date: bet.createdAt,
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
        const mappedBetHistory = betHistory.map(async (bet) => {
          const cashier = await userService.getUserById(bet.cashierId);

          return {
            ticketId: bet.id,
            selection: bet.selection,
            stake: bet.stake,
            cashier: cashier.id,
            result: bet.result,
            date: bet.createdAt,
          };
        });
        return mappedBetHistory;
      })
    );
    const flattenedArray = [].concat(...bets);

    return res.status(httpStatus.CREATED).send(flattenedArray);
  }
  const betHistory = await betsService.getBetHistory({ startDate, endDate, betType });
  const mappedBetHistory = betHistory.map(async (bet) => {
    const cashier = await userService.getUserById(bet.cashierId);

    return {
      ticketId: bet.id,
      selection: bet.selection,
      stake: bet.stake,
      cashier: cashier.id,

      result: bet.result,
      date: bet.createdAt,
    };
  });

  return res.status(httpStatus.CREATED).send(mappedBetHistory);
});

const getBetPlacedById = catchAsync(async (req, res) => {
  const id = req.params.betPlacedId;
  const betPlaced = await betsService.getBetPlacedById(id);
  if (!betPlaced) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Bet Placed Record not found');
  }
  res.status(httpStatus.CREATED).send({ betPlaced });
});

module.exports = { createBetPlaced, fetchBetPlaced, getBetPlacedById, getBetHistory };
