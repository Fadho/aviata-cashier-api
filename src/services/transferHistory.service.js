const { TransferHistory } = require('../models');

const createTransferHistory = async (transferHistoryBody) => {
  return TransferHistory.create(transferHistoryBody);
};

/**
 * Query for transferHistorys
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryTransferHistorys = async (filter, options, startDate, endDate) => {
  const startDateWithoutTime = new Date(startDate);
  startDateWithoutTime.setHours(0, 0, 0, 0);
  const endDateWithoutTime = new Date(endDate);
  endDateWithoutTime.setHours(0, 0, 0, 0);
  endDateWithoutTime.setDate(endDateWithoutTime.getDate() + 1);

  let dateFilter = {};
  if (startDate && endDate) {
    dateFilter = {
      ...(startDate &&
        endDate && {
          updatedAt: {
            $gte: startDateWithoutTime,
            $lte: endDateWithoutTime,
          },
        }),
      ...filter,
    };
    // eslint-disable-next-line no-param-reassign
    filter = dateFilter;
  }
  const transferHistorys = await TransferHistory.paginate(filter, options);
  return transferHistorys;
};

const getTransferHistorys = async (filter, options) => {
  const transferHistorys = await TransferHistory.find(filter, options);
  return transferHistorys;
};

/**
 * Get transferHistory by id
 * @param {ObjectId} id
 * @returns {Promise<TransferHistory>}
 */
const getTransferHistoryById = async (id) => {
  return TransferHistory.findById(id).populate('wallets');
};

module.exports = {
  createTransferHistory,
  queryTransferHistorys,
  getTransferHistoryById,
  getTransferHistorys,
};
