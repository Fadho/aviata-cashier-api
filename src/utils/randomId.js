const generateRandomId = () => {
  const timestamp = new Date().getTime(); // Get current timestamp
  const randomNum = Math.floor(Math.random() * 10000); // Generate a random number between 0 and 9999
  const randomId = timestamp.toString() + randomNum.toString(); // Concatenate timestamp and random number
  return randomId;
};

module.exports = generateRandomId;
