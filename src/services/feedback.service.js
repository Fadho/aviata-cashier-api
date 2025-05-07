const { Feedback } = require('../models');

const createFeedback = async (feedbackBody) => {
  return Feedback.create(feedbackBody);
};

/**
 * Query for feedbacks
 * @param {Object} filter - Mongo filter
 * @param {Object} options - Query options
 * @param {string} [options.sortBy] - Sort option in the format: sortField:(desc|asc)
 * @param {number} [options.limit] - Maximum number of results per page (default = 10)
 * @param {number} [options.page] - Current page (default = 1)
 * @returns {Promise<QueryResult>}
 */
const queryFeedbacks = async (filter, options, startDate, endDate) => {
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
  const feedbacks = await Feedback.paginate(filter, options);
  return feedbacks;
};

const getFeedbacks = async (filter, options) => {
  const feedbacks = await Feedback.find(filter, options);
  return feedbacks;
};

/**
 * Get transferHistory by id
 * @param {ObjectId} id
 * @returns {Promise<Feedback>}
 */
const getFeedbackById = async (id) => {
  return Feedback.findById(id).populate('wallets');
};

module.exports = {
  createFeedback,
  queryFeedbacks,
  getFeedbackById,
  getFeedbacks,
};
