/**
 * Collects the result of any express-validator chains that ran before it and,
 * if anything failed, short-circuits with a 400 in the app's standard shape.
 * Put validator chains on a route, then `validate` last, then the controller.
 */
const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({ success: false, error: errors.array()[0].msg });
};

module.exports = { validate };
